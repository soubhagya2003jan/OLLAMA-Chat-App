import os
import logging
import requests
import uuid
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "ollama-chat-secret-key")
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///ollama_chat.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
db.init_app(app)

OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "http://localhost:11434")

with app.app_context():
    import models
    db.create_all()

@app.route('/')
def index():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    return render_template('index.html')

@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        response = requests.get(f"{OLLAMA_API_URL}/api/tags")
        if response.status_code == 200:
            models = response.json().get('models', [])
            return jsonify(models)
        else:
            logger.error(f"Failed to fetch models: {response.status_code} - {response.text}")
            return jsonify({"error": f"Failed to fetch models: {response.status_code}"}), 500
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Ollama API: {str(e)}")
        return jsonify({"error": f"Could not connect to Ollama API at {OLLAMA_API_URL}. Is Ollama running?"}), 500

@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    try:
        from models import Conversation

        conversations = Conversation.query.order_by(Conversation.created_at.desc()).all()

        result = []
        for conv in conversations:
            result.append({
                'id': conv.id,
                'title': conv.title,
                'created_at': conv.created_at.isoformat()
            })

        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching conversations: {str(e)}")
        return jsonify({"error": "Failed to fetch conversations"}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    try:
        from models import Conversation, Message

        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404

        messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.created_at).all()

        message_list = []
        for msg in messages:
            message_list.append({
                'role': msg.role,
                'content': msg.content,
                'model': msg.model,
                'created_at': msg.created_at.isoformat()
            })

        result = {
            'id': conversation.id,
            'title': conversation.title,
            'created_at': conversation.created_at.isoformat(),
            'messages': message_list
        }

        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching conversation: {str(e)}")
        return jsonify({"error": "Failed to fetch conversation"}), 500

@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    try:
        from models import Conversation

        conversation = Conversation()
        db.session.add(conversation)
        db.session.commit()

        return jsonify({
            'id': conversation.id,
            'title': conversation.title,
            'created_at': conversation.created_at.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating conversation: {str(e)}")
        return jsonify({"error": "Failed to create conversation"}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['PUT'])
def update_conversation(conversation_id):
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    title = data.get('title')
    if not title:
        return jsonify({"error": "Title is required"}), 400

    try:
        from models import Conversation

        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404

        conversation.title = title
        db.session.commit()

        return jsonify({
            'id': conversation.id,
            'title': conversation.title,
            'created_at': conversation.created_at.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating conversation: {str(e)}")
        return jsonify({"error": "Failed to update conversation"}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    try:
        from models import Conversation

        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404

        db.session.delete(conversation)
        db.session.commit()

        return jsonify({"message": "Conversation deleted successfully"})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting conversation: {str(e)}")
        return jsonify({"error": "Failed to delete conversation"}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    model = data.get('model')
    message = data.get('message')
    conversation_id = data.get('conversation_id')

    if not model or not message:
        return jsonify({"error": "Model and message are required"}), 400

    try:
        from models import Conversation, Message

        conversation = None
        if conversation_id:
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return jsonify({"error": "Conversation not found"}), 404
        else:
            title = message[:50] + ('...' if len(message) > 50 else '')
            conversation = Conversation(title=title)
            db.session.add(conversation)
            db.session.commit()

        user_message = Message(
            role='user',
            content=message,
            model=model,
            conversation_id=conversation.id
        )
        db.session.add(user_message)
        db.session.commit()

        payload = {
            "model": model,
            "prompt": message,
            "stream": False
        }

        response = requests.post(f"{OLLAMA_API_URL}/api/generate", json=payload)

        if response.status_code == 200:
            result = response.json()
            ai_response = result.get('response', '')

            assistant_message = Message(
                role='assistant',
                content=ai_response,
                model=model,
                conversation_id=conversation.id
            )
            db.session.add(assistant_message)

            if conversation.messages.count() <= 2:
                words = message.split()
                title = ' '.join(words[:5]) + ('...' if len(words) > 5 else '')
                conversation.title = title

            db.session.commit()

            return jsonify({
                "response": ai_response,
                "model": model,
                "conversation_id": conversation.id
            })
        else:
            logger.error(f"Ollama API error: {response.status_code} - {response.text}")
            db.session.delete(user_message)
            db.session.commit()
            return jsonify({"error": f"Error from Ollama API: {response.text}"}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Ollama API: {str(e)}")
        return jsonify({"error": "Could not connect to Ollama API. Is Ollama running?"}), 500
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error processing chat: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)