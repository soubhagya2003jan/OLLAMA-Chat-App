
# Ollama Chat Web Interface

A web-based chat interface for interacting with Ollama's large language models. Built with Flask, SQLite, and modern web technologies.

![image](https://github.com/user-attachments/assets/1f3b8a5d-4ec4-48fe-8e11-e059ac91a2bd)
## Features

- 🤖 Compatible with all Ollama models
- 💬 Persistent chat conversations
- 📱 Responsive design that works on desktop and mobile
- 🎨 Code syntax highlighting
- ✨ Markdown support
- 🧮 KaTeX math rendering
- 🔄 Real-time model switching
- 📝 Conversation management (rename, delete)
- 🎯 Clean and intuitive UI

## Prerequisites

Before running this application, you need:

1. Python 3.11 or higher
2. Ollama installed and running on your machine
3. The required Python packages (listed in requirements.txt)

## Installation & Setup

1. First, install Ollama by following instructions at [Ollama's website](https://ollama.ai)

2. Clone this repository:
   ```bash
   git clone <repository-url>
   cd ollama-chat
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Make sure Ollama is running in the background:
   ```bash
   ollama serve
   ```

2. In a new terminal, start the Flask application:
   ```bash
   python main.py
   ```

3. Open your web browser and visit:
   ```
   http://localhost:5000 or similar check your console when you execute the file
   ```

## Project Structure

```
ollama-chat/
├── static/              # Static assets
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── templates/          # HTML templates
├── app.py             # Main Flask application
├── models.py          # Database models
└── main.py            # Application entry point
```

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: SQLite with SQLAlchemy
- **Frontend**: HTML, CSS, JavaScript
- **UI Framework**: Bootstrap
- **Libraries**:
  - Marked.js (Markdown rendering)
  - Highlight.js (Code syntax highlighting)
  - KaTeX (Math rendering)
  - Font Awesome (Icons)

## API Endpoints

- `GET /api/models` - List available Ollama models
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/<id>` - Get specific conversation
- `POST /api/conversations` - Create new conversation
- `PUT /api/conversations/<id>` - Update conversation
- `DELETE /api/conversations/<id>` - Delete conversation
- `POST /api/chat` - Send message to model

## Troubleshooting

1. **No models showing up?**
   - Make sure Ollama is running (`ollama serve`)
   - Check if you have any models installed (`ollama list`)
   - Install a model if needed (`ollama pull mistral`)

2. **Can't connect to server?**
   - Verify Flask is running on terminal when you execute main.py
   - Check if another application is using port 5000
   - Make sure you're accessing the correct URL

## Contributing

Feel free to contribute to this project. Pull requests are welcome!
