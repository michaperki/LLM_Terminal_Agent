document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const fileExplorer = document.getElementById('file-explorer');
  const fileTree = document.getElementById('file-tree');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const refreshTreeBtn = document.getElementById('refresh-tree');
  const directoryDisplay = document.createElement('div');
  directoryDisplay.id = 'current-directory';
  directoryDisplay.className = 'directory-display';

  // Add directory display to DOM
  document.querySelector('.chat-header').appendChild(directoryDisplay);

  let isProcessing = false;
  let thinkingIndicator = null;
  let currentDirectory = '';
  let fileTreeData = null;
  
  // Register event listeners
  sendButton.addEventListener('click', handleSendMessage);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // File explorer event listeners
  toggleSidebarBtn.addEventListener('click', toggleSidebar);
  refreshTreeBtn.addEventListener('click', refreshFileTree);
  
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

  window.api.onRepeatCommand((command) => {
    // Fill the input field with the command
    userInput.value = command;
    // Automatically send the command
    handleSendMessage();
  });

  // Get initial directory
  window.api.getCurrentDirectory().then(directory => {
    updateDirectoryDisplay(directory);
    loadFileTree();
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
    } else if (data.tool === 'show_history') {
      content += `<div class="tool-command">Showing command history${data.input.limit ? ` (limit: ${data.input.limit})` : ''}${data.input.search ? ` matching: "${data.input.search}"` : ''}</div>`;
    } else if (data.tool === 'clear_history') {
      content += `<div class="tool-command">Clearing ${data.input.entry_id ? `history entry: ${data.input.entry_id}` : 'all command history'}</div>`;
    } else if (data.tool === 'repeat_command') {
      content += `<div class="tool-command">Repeating command: ${data.input.command_id ? `ID ${data.input.command_id}` : `#${data.input.index}`}</div>`;
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
    } else if (data.tool === 'bookmark_directory' || data.tool === 'remove_bookmark' ||
               data.tool === 'clear_history' || data.tool === 'repeat_command') {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';
      resultEl.textContent = data.result.message;
      toolEl.appendChild(resultEl);
    } else if (data.tool === 'show_history' && data.result.entries) {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';

      if (data.result.entries.length === 0) {
        resultEl.textContent = 'No history entries found.';
      } else {
        const historyList = document.createElement('ul');
        historyList.className = 'history-list';

        data.result.entries.forEach((entry, idx) => {
          const formattedDate = new Date(entry.timestamp).toLocaleString();
          const li = document.createElement('li');

          const header = document.createElement('div');
          header.className = 'history-entry-header';
          header.innerHTML = `<strong>#${idx + 1}</strong> (${formattedDate}) - <span class="history-id">${entry.id}</span>`;

          const command = document.createElement('div');
          command.className = 'history-command';
          command.textContent = entry.userInput;

          li.appendChild(header);
          li.appendChild(command);

          if (entry.tools && entry.tools.length > 0) {
            const toolsUsed = document.createElement('div');
            toolsUsed.className = 'history-tools';
            toolsUsed.textContent = `Tools used: ${entry.tools.map(t => t.name).join(', ')}`;
            li.appendChild(toolsUsed);
          }

          historyList.appendChild(li);
        });

        resultEl.textContent = `Found ${data.result.entries.length} history entries:`;
        resultEl.appendChild(historyList);
      }

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

  // File explorer functions
  function toggleSidebar() {
    fileExplorer.classList.toggle('collapsed');
  }

  function refreshFileTree() {
    loadFileTree();
  }

  function loadFileTree() {
    // Clear previous content
    fileTree.innerHTML = '<div class="loading">Loading file tree...</div>';

    // Get file tree from backend
    window.api.getFileTree({
      maxDepth: 3,
      showHidden: false
    }).then(result => {
      if (result.success && result.tree) {
        fileTreeData = result.tree;
        renderFileTree(result.tree);
      } else {
        fileTree.innerHTML = `<div class="error">Error loading file tree: ${result.error || 'Unknown error'}</div>`;
      }
    }).catch(error => {
      fileTree.innerHTML = `<div class="error">Error loading file tree: ${error.message || 'Unknown error'}</div>`;
    });
  }

  function renderFileTree(node, container = null) {
    if (!container) {
      // Root node, clear the container
      fileTree.innerHTML = '';
      container = fileTree;
    }

    // Create item element
    const itemEl = document.createElement('div');
    itemEl.className = 'file-tree-item';
    itemEl.dataset.path = node.path;
    itemEl.dataset.type = node.type;

    // Create toggle element for directories
    const toggleEl = document.createElement('span');
    toggleEl.className = 'file-tree-toggle';
    toggleEl.innerHTML = node.type === 'directory' ? '▶' : '';
    itemEl.appendChild(toggleEl);

    // Create icon element
    const iconEl = document.createElement('span');
    iconEl.className = 'file-tree-item-icon';

    if (node.type === 'directory') {
      iconEl.innerHTML = '📁';
    } else {
      // Choose icon based on file extension
      const extension = node.extension || '';
      if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
        iconEl.innerHTML = '📄';
      } else if (['html', 'htm', 'xml'].includes(extension)) {
        iconEl.innerHTML = '📄';
      } else if (['css', 'scss', 'sass', 'less'].includes(extension)) {
        iconEl.innerHTML = '📄';
      } else if (['json', 'yaml', 'yml', 'toml'].includes(extension)) {
        iconEl.innerHTML = '📄';
      } else if (['md', 'markdown', 'txt'].includes(extension)) {
        iconEl.innerHTML = '📄';
      } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
        iconEl.innerHTML = '🖼️';
      } else {
        iconEl.innerHTML = '📄';
      }
    }

    itemEl.appendChild(iconEl);

    // Create name element
    const nameEl = document.createElement('span');
    nameEl.className = 'file-tree-item-name';
    nameEl.textContent = node.name;
    itemEl.appendChild(nameEl);

    // Add to container
    container.appendChild(itemEl);

    // Add click handler
    itemEl.addEventListener('click', (e) => {
      e.stopPropagation();

      // Select the item
      document.querySelectorAll('.file-tree-item.selected').forEach(el => {
        el.classList.remove('selected');
      });
      itemEl.classList.add('selected');

      if (node.type === 'directory') {
        // Toggle directory expansion
        const childrenEl = itemEl.nextElementSibling;
        if (childrenEl && childrenEl.classList.contains('file-tree-children')) {
          const isExpanded = childrenEl.classList.toggle('expanded');
          toggleEl.classList.toggle('expanded', isExpanded);
        }
      } else {
        // Handle file click - suggest in input
        const relativePath = node.path;
        userInput.value = `Show me the contents of ${relativePath}`;
      }
    });

    // For directories with children
    if (node.type === 'directory' && node.children && node.children.length > 0) {
      // Create children container
      const childrenEl = document.createElement('div');
      childrenEl.className = 'file-tree-children';
      container.appendChild(childrenEl);

      // Render each child
      node.children.forEach(child => {
        renderFileTree(child, childrenEl);
      });

      // Add double-click handler to toggle expansion
      itemEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        childrenEl.classList.toggle('expanded');
        toggleEl.classList.toggle('expanded');
      });
    }
  }

  // Update file tree when directory changes
  window.api.onDirectoryChanged((directory) => {
    updateDirectoryDisplay(directory);
    loadFileTree();
  });
});