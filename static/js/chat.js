    let currentModel = null;
    let currentConversationId = null;
    let chatHistory = [];
    let conversations = [];
    let isWaitingForResponse = false;
    let previousModelInConversation = null;

    
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.getElementById('chat-container');
    const modelSelector = document.getElementById('modelSelector');
    const modelList = document.getElementById('modelList');
    const statusMessage = document.getElementById('status-message');
    const messageTemplate = document.getElementById('message-template');
    const errorTemplate = document.getElementById('error-template');
    const conversationsList = document.getElementById('conversations-list');
    const conversationItemTemplate = document.getElementById('conversation-item-template');
    const modelChangeTemplate = document.getElementById('model-change-template');
    const newChatButton = document.getElementById('new-chat-btn');
    const currentModelIndicator = document.getElementById('current-model-indicator');
    const currentModelName = document.getElementById('current-model-name');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const showSidebarBtn = document.getElementById('show-sidebar-btn');
    const editTitleModal = new bootstrap.Modal(document.getElementById('editTitleModal'));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const conversationTitleInput = document.getElementById('conversationTitleInput');
    const editingConversationId = document.getElementById('editingConversationId');
    const deletingConversationId = document.getElementById('deletingConversationId');
    const saveTitleBtn = document.getElementById('saveTitleBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    
    document.addEventListener('DOMContentLoaded', () => {
        
        fetchModels();

        
        fetchConversations();

        
        setupEventListeners();

        
        configureMarkdown();
    });

    
    function fetchModels() {
        statusMessage.textContent = 'Connecting to Ollama...';

        fetch('/api/models')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch models (${response.status})`);
                }
                return response.json();
            })
            .then(models => {
                
                modelList.innerHTML = '';
                statusMessage.textContent = '';

                if (models.length === 0) {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = '<a class="dropdown-item text-center text-muted">No models found</a>';
                    modelList.appendChild(listItem);
                    statusMessage.textContent = 'No models available. Please install models with Ollama.';
                    return;
                }

                
                models.forEach(model => {
                    const listItem = document.createElement('li');
                    const modelName = model.name;

                    listItem.innerHTML = `<a class="dropdown-item">${modelName}</a>`;
                    listItem.querySelector('a').addEventListener('click', () => selectModel(modelName));

                    modelList.appendChild(listItem);
                });

                statusMessage.textContent = 'Select a model to start chatting';
            })
            .catch(error => {
                console.error('Error fetching models:', error);
                modelList.innerHTML = '<li><a class="dropdown-item text-danger">Error loading models</a></li>';
                statusMessage.textContent = `Error connecting to Ollama API: ${error.message}`;
                showError(`Failed to connect to Ollama. Is Ollama running locally?`);
            });
    }

    
    function setupEventListeners() {
        
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });

        
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
        });

        
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

       
        newChatButton.addEventListener('click', startNewConversation);

        
        setupSidebarToggle();
    }

    
    function configureMarkdown() {
        marked.setOptions({
            highlight: function(code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-',
            breaks: true,
            gfm: true
        });
    }

    
    function refreshCodeFormatting() {
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    
    function selectModel(modelName) {
        try {
            const oldModel = currentModel;
            currentModel = modelName;
            modelSelector.textContent = modelName;
            userInput.focus();

            currentModelName.textContent = modelName;
            currentModelIndicator.classList.remove('d-none');

            
            if (currentConversationId && oldModel && oldModel !== modelName) {
                addModelChangeIndicator(modelName);
                previousModelInConversation = modelName;
            }

            
            statusMessage.textContent = `Using model: ${modelName}`;
            setTimeout(() => {
                if (statusMessage.textContent === `Using model: ${modelName}`) {
                    statusMessage.textContent = '';
                }
            }, 3000);
        } catch (error) {
            console.error('Error selecting model:', error);
            showError(`Failed to select model: ${error.message}`);
        }
    }

    
    function fetchConversations() {
        fetch('/api/conversations')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch conversations (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                conversations = data;
                updateConversationsList();
            })
            .catch(error => {
                console.error('Error fetching conversations:', error);
                statusMessage.textContent = `Error loading conversations: ${error.message}`;
            });
    }

    
    function updateConversationsList() {
        
        const noConversationsPlaceholder = conversationsList.querySelector('.no-conversations');
        conversationsList.innerHTML = '';

        if (conversations.length === 0) {
            conversationsList.appendChild(noConversationsPlaceholder || createNoConversationsPlaceholder());
            return;
        }

        
        conversations.forEach(conversation => {
            const convNode = conversationItemTemplate.content.cloneNode(true);
            const convElement = convNode.querySelector('.conversation-item');

            convElement.setAttribute('data-id', conversation.id);
            convElement.querySelector('.conversation-title').textContent = conversation.title;

            
            if (currentConversationId === conversation.id) {
                convElement.classList.add('active');
            }

            
            convElement.addEventListener('click', () => loadConversation(conversation.id));

            conversationsList.appendChild(convElement);
        });
    }

    
    function createNoConversationsPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'no-conversations text-center p-3';
        placeholder.innerHTML = '<i class="fas fa-comment-dots mb-2"></i><br>No conversations yet';
        return placeholder;
    }

    
    function loadConversation(conversationId) {
        currentConversationId = conversationId;

        
        chatContainer.innerHTML = '';
        chatHistory = [];

        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-id') == conversationId) {
                item.classList.add('active');
            }
        });

        
        chatContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-light" role="status"></div><div class="mt-2">Loading conversation...</div></div>';

        
        fetch(`/api/conversations/${conversationId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch conversation (${response.status})`);
                }
                return response.json();
            })
            .then(conversation => {
                
                chatContainer.innerHTML = '';

                
                if (conversation.messages.length === 0) {
                    chatContainer.innerHTML = `
                        <div class="welcome-message">
                            <h4>New Conversation</h4>
                            <p>Select a model and start chatting!</p>
                        </div>
                    `;
                    return;
                }

                
                let lastModel = null;

                
                conversation.messages.forEach(message => {
                    
                    if (message.model && message.role === 'assistant' && lastModel && message.model !== lastModel) {
                        addModelChangeIndicator(message.model);
                    }

                    
                    if (message.role === 'assistant') {
                        const messageNode = messageTemplate.content.cloneNode(true);
                        const messageElement = messageNode.querySelector('.message');
                        messageElement.classList.add('bot-message');
                        
                        const avatar = messageElement.querySelector('.avatar');
                        avatar.innerHTML = '<i class="fas fa-robot"></i>';
                        
                        const messageContent = messageElement.querySelector('.message-text');
                        messageContent.innerHTML = marked.parse(message.content);
                        
                        
                        messageContent.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                        
                        chatContainer.appendChild(messageElement);
                    } else {
                        addMessageToChat(message.role, message.content);
                    }

                    
                    if (message.model) {
                        lastModel = message.model;
                        if (message === conversation.messages[conversation.messages.length - 1]) {
                            updateModelDisplay(message.model);
                        }
                    }

                    
                    chatHistory.push({
                        role: message.role,
                        content: message.content
                    });
                });

                
                previousModelInConversation = lastModel;

                
                if (currentModel && previousModelInConversation && currentModel !== previousModelInConversation) {
                    statusMessage.textContent = `Note: You're now using ${currentModel} instead of ${previousModelInConversation}`;
                    setTimeout(() => {
                        if (statusMessage.textContent.includes(`Note: You're now using`)) {
                            statusMessage.textContent = '';
                        }
                    }, 5000);
                }
            })
            .catch(error => {
                console.error('Error loading conversation:', error);
                chatContainer.innerHTML = '';
                showError(`Failed to load conversation: ${error.message}`);
            });
    }

    
    function updateModelDisplay(modelName) {
        if (!modelName) return;

        
        currentModel = modelName;
        modelSelector.textContent = modelName;

        
        currentModelName.textContent = modelName;
        currentModelIndicator.classList.remove('d-none');
    }

    
    function addModelChangeIndicator(modelName) {
        const indicatorNode = modelChangeTemplate.content.cloneNode(true);
        indicatorNode.querySelector('.model-name').textContent = modelName;
        chatContainer.appendChild(indicatorNode);
    }

    
    function startNewConversation() {
        
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h4>New Conversation</h4>
                <p>Select a model and start chatting!</p>
            </div>
        `;

        
        currentConversationId = null;
        chatHistory = [];
        previousModelInConversation = null;

        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });

        
        userInput.focus();
    }


    function sendMessage() {
        const message = userInput.value.trim();

        if (!message || isWaitingForResponse) {
            return;
        }

        if (!currentModel) {
            showError('Please select a model first');
            return;
        }

        
        addMessageToChat('user', message);

        
        userInput.value = '';
        userInput.style.height = 'auto';

        
        isWaitingForResponse = true;
        sendButton.disabled = true;
        showThinkingIndicator();

        
        if (currentConversationId && previousModelInConversation && currentModel !== previousModelInConversation) {
            addModelChangeIndicator(currentModel);
            previousModelInConversation = currentModel;
        }

        
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: currentModel,
                message: message,
                conversation_id: currentConversationId
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || `Error: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            
            removeThinkingIndicator();

            
            addMessageToChat('bot', data.response);

           
            chatHistory.push({
                role: 'user',
                content: message
            });
            chatHistory.push({
                role: 'assistant',
                content: data.response
            });

            
            if (!currentConversationId && data.conversation_id) {
                currentConversationId = data.conversation_id;
                fetchConversations();
            }

            
            updateModelDisplay(currentModel);
            refreshCodeFormatting();
        })
        .catch(error => {
            console.error('Error sending message:', error);
            removeThinkingIndicator();
            showError(`Failed to get a response: ${error.message}`);
        })
        .finally(() => {
            isWaitingForResponse = false;
            sendButton.disabled = false;
            userInput.focus();
        });
    }

    
    function addMessageToChat(role, content) {
        
        const messageNode = messageTemplate.content.cloneNode(true);
        const messageElement = messageNode.querySelector('.message');

        
        messageElement.classList.add(role === 'user' ? 'user-message' : 'bot-message');

        
        const avatar = messageElement.querySelector('.avatar');
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        
        const messageContent = messageElement.querySelector('.message-text');
        if (role === 'bot') {
            messageContent.innerHTML = marked.parse(content);

            
            messageContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            messageContent.textContent = content;
        }

        
        chatContainer.appendChild(messageElement);

        
        scrollToBottom();
    }

    
    function showThinkingIndicator() {
        const thinkingHTML = `
            <div class="message bot-message mb-4 thinking-indicator">
                <div class="d-flex align-items-start">
                    <div class="avatar me-3 rounded">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content thinking">
                        <div class="thinking-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        chatContainer.insertAdjacentHTML('beforeend', thinkingHTML);
        scrollToBottom();
    }

    
    function removeThinkingIndicator() {
        const indicator = document.querySelector('.thinking-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    
    function showError(message) {
        
        const errorNode = errorTemplate.content.cloneNode(true);
        const errorElement = errorNode.querySelector('.alert');

        
        errorElement.querySelector('.error-text').textContent = message;

        
        chatContainer.appendChild(errorElement);

        
        scrollToBottom();
    }

    
    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    
    confirmDeleteBtn.addEventListener('click', () => {
        const convoId = deletingConversationId.value;
        if (!convoId) return;

        fetch(`/api/conversations/${convoId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to delete conversation');
            deleteConfirmModal.hide();
            
            const deletedConvo = document.querySelector(`.conversation-item[data-id="${convoId}"]`);
            if (deletedConvo) deletedConvo.remove();
        
            currentConversationId = null;
            chatContainer.innerHTML = `
                <div class="welcome-message">
                    <h4>Welcome to Ollama Chat</h4>
                    <p>Select a model from the dropdown above and start chatting with your locally installed Ollama models.</p>
                </div>
            `;
            chatHistory = [];

            fetchConversations();
        })
        .catch(error => {
            console.error('Error deleting conversation:', error);
            showError('Failed to delete conversation');
        });
    });


    document.addEventListener('click', (e) => {

        if (e.target.closest('.delete-convo-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const convoItem = e.target.closest('.conversation-item');
            if (convoItem) {
                deletingConversationId.value = convoItem.getAttribute('data-id');
                deleteConfirmModal.show();
            }
        }


        if (e.target.closest('.edit-title-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const convoItem = e.target.closest('.conversation-item');
            if (convoItem) {
                const currentTitle = convoItem.querySelector('.conversation-title').textContent;
                editingConversationId.value = convoItem.getAttribute('data-id');
                conversationTitleInput.value = currentTitle;
                editTitleModal.show();
            }
        }
    });


    saveTitleBtn.addEventListener('click', () => {
        const convoId = editingConversationId.value;
        const newTitle = conversationTitleInput.value.trim();

        if (!convoId || !newTitle) return;

        fetch(`/api/conversations/${convoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: newTitle })
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to update title');
            editTitleModal.hide();
 
            const titleEl = document.querySelector(`.conversation-item[data-id="${convoId}"] .conversation-title`);
            if (titleEl) titleEl.textContent = newTitle;
        })
        .catch(error => {
            console.error('Error updating title:', error);
            showError('Failed to update conversation title');
        });
    });


    function setupSidebarToggle() {
        const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        const showSidebarBtn = document.getElementById('show-sidebar-btn');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');

        if (toggleSidebarBtn && showSidebarBtn && sidebar && mainContent) {
            toggleSidebarBtn.addEventListener('click', () => {
                sidebar.classList.add('sidebar-collapsed');
                mainContent.classList.add('main-content-expanded');
                showSidebarBtn.classList.remove('d-none');
            });

            showSidebarBtn.addEventListener('click', () => {
                sidebar.classList.remove('sidebar-collapsed');
                mainContent.classList.remove('main-content-expanded');
                showSidebarBtn.classList.add('d-none');
            });
        }
    }
