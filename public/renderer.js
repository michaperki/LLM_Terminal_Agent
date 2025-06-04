document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const directoryDisplay = document.createElement('div');
  directoryDisplay.id = 'current-directory';
  directoryDisplay.className = 'directory-display';

  // Add directory display to DOM
  document.querySelector('.chat-header').appendChild(directoryDisplay);

  let isProcessing = false;
  let thinkingIndicator = null;
  let currentDirectory = '';
  
  // Register event listeners
  sendButton.addEventListener('click', handleSendMessage);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  // Register callback for API events
  window.api.onThinking((isThinking) => {
    if (isThinking && !thinkingIndicator) {
      addThinkingIndicator();
    } else if (!isThinking && thinkingIndicator) {
      removeThinkingIndicator();
    }
  });
  
  window.api.onAssistantMessage((message) => {
    addMessage(message, 'assistant');
  });
  
  window.api.onToolExecutionStart((data) => {
    addToolExecutionStart(data);
  });
  
  window.api.onToolExecutionResult((data) => {
    addToolExecutionResult(data);
  });
  
  window.api.onToolExecutionError((data) => {
    addToolExecutionError(data);
  });

  window.api.onDirectoryChanged((directory) => {
    updateDirectoryDisplay(directory);
  });

  // Get initial directory
  window.api.getCurrentDirectory().then(directory => {
    updateDirectoryDisplay(directory);
  });
  
  function handleSendMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input and set processing state
    userInput.value = '';
    isProcessing = true;
    sendButton.disabled = true;
    
    // Send to backend
    window.api.sendMessage(message)
      .then((result) => {
        isProcessing = false;
        sendButton.disabled = false;
        
        if (result.error) {
          addErrorMessage(result.error);
        } else if (result.response) {
          addMessage(result.response, 'assistant');
        }
      })
      .catch((error) => {
        isProcessing = false;
        sendButton.disabled = false;
        addErrorMessage('An error occurred while processing your request.');
        console.error(error);
      });
  }
  
  function addMessage(content, sender) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}-message`;
    
    // Convert markdown-like formatting
    const formattedContent = formatMessageContent(content);
    
    messageEl.innerHTML = formattedContent;
    chatContainer.appendChild(messageEl);
    scrollToBottom();
  }
  
  function addThinkingIndicator() {
    removeThinkingIndicator(); // Remove existing indicator if any
    
    thinkingIndicator = document.createElement('div');
    thinkingIndicator.className = 'thinking-indicator';
    thinkingIndicator.innerHTML = `
      <div class="thinking-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    
    chatContainer.appendChild(thinkingIndicator);
    scrollToBottom();
  }
  
  function removeThinkingIndicator() {
    if (thinkingIndicator && thinkingIndicator.parentNode) {
      thinkingIndicator.parentNode.removeChild(thinkingIndicator);
      thinkingIndicator = null;
    }
  }
  
  function addToolExecutionStart(data) {
    const toolEl = document.createElement('div');
    toolEl.className = 'tool-execution';
    toolEl.id = `tool-${Date.now()}`;
    
    let content = `<div class="tool-header">Executing: ${data.tool}</div>`;
    
    if (data.tool === 'run_shell') {
      content += `<div class="tool-command">${data.input.command}</div>`;
      content += `<div class="tool-output">Running command...</div>`;
    } else if (data.tool === 'edit_file') {
      content += `<div class="tool-command">Editing file: ${data.input.path}</div>`;
    } else if (data.tool === 'change_directory') {
      content += `<div class="tool-command">Changing directory to: ${data.input.path}</div>`;
    } else if (data.tool === 'bookmark_directory') {
      content += `<div class="tool-command">Bookmarking directory as: ${data.input.name}</div>`;
    } else if (data.tool === 'use_bookmark') {
      content += `<div class="tool-command">Changing to bookmarked directory: ${data.input.name}</div>`;
    } else if (data.tool === 'list_bookmarks') {
      content += `<div class="tool-command">Listing saved directory bookmarks</div>`;
    } else if (data.tool === 'remove_bookmark') {
      content += `<div class="tool-command">Removing bookmark: ${data.input.name}</div>`;
    }
    
    toolEl.innerHTML = content;
    chatContainer.appendChild(toolEl);
    scrollToBottom();
  }
  
  function addToolExecutionResult(data) {
    // Try to find existing tool execution element
    const toolEl = document.getElementById(`tool-${Date.now()}`) || 
                  document.querySelector('.tool-execution:last-child');
    
    if (!toolEl) {
      // Create new element if not found
      addToolExecutionStart(data);
      const newToolEl = document.querySelector('.tool-execution:last-child');
      updateToolExecutionContent(newToolEl, data);
    } else {
      updateToolExecutionContent(toolEl, data);
    }
    
    scrollToBottom();
  }
  
  function updateToolExecutionContent(toolEl, data) {
    if (data.tool === 'run_shell') {
      const outputEl = toolEl.querySelector('.tool-output');
      if (outputEl) {
        outputEl.textContent = data.result.stdout;
      } else {
        const newOutputEl = document.createElement('div');
        newOutputEl.className = 'tool-output';
        newOutputEl.textContent = data.result.stdout;
        toolEl.appendChild(newOutputEl);
      }

      if (data.result.stderr) {
        const errorEl = document.createElement('div');
        errorEl.className = 'tool-error';
        errorEl.textContent = data.result.stderr;
        toolEl.appendChild(errorEl);
      }
    } else if (data.tool === 'edit_file') {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';
      resultEl.textContent = data.result.message;
      toolEl.appendChild(resultEl);
    } else if (data.tool === 'change_directory' || data.tool === 'use_bookmark') {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';
      resultEl.textContent = data.result.message;
      toolEl.appendChild(resultEl);

      if (data.result.success && data.result.newDirectory) {
        updateDirectoryDisplay(data.result.newDirectory);
      }
    } else if (data.tool === 'bookmark_directory' || data.tool === 'remove_bookmark') {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';
      resultEl.textContent = data.result.message;
      toolEl.appendChild(resultEl);
    } else if (data.tool === 'list_bookmarks' && data.result.bookmarks) {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';

      if (data.result.bookmarks.length === 0) {
        resultEl.textContent = 'No bookmarks found.';
      } else {
        const bookmarksList = document.createElement('ul');
        bookmarksList.className = 'bookmarks-list';

        data.result.bookmarks.forEach(bookmark => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${bookmark.name}</strong>: ${bookmark.path}${bookmark.description ? ` - ${bookmark.description}` : ''}`;
          bookmarksList.appendChild(li);
        });

        resultEl.textContent = `Found ${data.result.bookmarks.length} bookmarks:`;
        resultEl.appendChild(bookmarksList);
      }

      toolEl.appendChild(resultEl);
    }
  }

  function updateDirectoryDisplay(directory) {
    currentDirectory = directory;
    const directoryEl = document.getElementById('current-directory');
    if (directoryEl) {
      directoryEl.textContent = `Working Directory: ${directory}`;
    }
  }
  
  function addToolExecutionError(data) {
    const toolEl = document.querySelector('.tool-execution:last-child');
    
    if (toolEl) {
      const errorEl = document.createElement('div');
      errorEl.className = 'tool-error';
      errorEl.textContent = data.error;
      toolEl.appendChild(errorEl);
    } else {
      const newToolEl = document.createElement('div');
      newToolEl.className = 'tool-execution';
      newToolEl.innerHTML = `
        <div class="tool-header">Error executing ${data.tool}</div>
        <div class="tool-error">${data.error}</div>
      `;
      chatContainer.appendChild(newToolEl);
    }
    
    scrollToBottom();
  }
  
  function addErrorMessage(errorText) {
    const errorEl = document.createElement('div');
    errorEl.className = 'message error-message';
    errorEl.textContent = errorText;
    chatContainer.appendChild(errorEl);
    scrollToBottom();
  }
  
  function formatMessageContent(content) {
    // Replace code blocks with <pre><code>
    let formatted = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Replace inline code with <code>
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Replace newlines with <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }
  
  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});