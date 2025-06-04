document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const fileExplorer = document.getElementById('file-explorer');
  const fileTree = document.getElementById('file-tree');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const toggleConfigBtn = document.getElementById('toggle-config');
  const refreshTreeBtn = document.getElementById('refresh-tree');
  const configPanel = document.getElementById('config-panel');
  const saveConfigBtn = document.getElementById('save-config');
  const temperatureSlider = document.getElementById('config-temperature');
  const temperatureValue = document.getElementById('temperature-value');
  const customCommandsList = document.getElementById('custom-commands-list');
  const addCommandBtn = document.getElementById('add-command-button');
  const addCommandModal = document.getElementById('add-command-modal');
  const saveCommandBtn = document.getElementById('save-command-btn');
  const cancelCommandBtn = document.getElementById('cancel-command-btn');
  const directoryDisplay = document.createElement('div');
  directoryDisplay.id = 'current-directory';
  directoryDisplay.className = 'directory-display';

  // Add directory display to DOM
  document.querySelector('.chat-header').prepend(directoryDisplay);

  let isProcessing = false;
  let thinkingIndicator = null;
  let currentDirectory = '';
  let fileTreeData = null;
  let projectConfig = null;
  let customCommands = {};

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
  toggleConfigBtn.addEventListener('click', toggleConfigPanel);
  refreshTreeBtn.addEventListener('click', refreshFileTree);

  // Config panel event listeners
  saveConfigBtn.addEventListener('click', saveConfiguration);
  temperatureSlider.addEventListener('input', updateTemperatureDisplay);

  // Custom commands event listeners
  addCommandBtn.addEventListener('click', showAddCommandModal);
  saveCommandBtn.addEventListener('click', saveCustomCommand);
  cancelCommandBtn.addEventListener('click', hideAddCommandModal);
  
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

  // Get initial directory and load configuration
  window.api.getCurrentDirectory().then(directory => {
    updateDirectoryDisplay(directory);
    loadFileTree();
    loadProjectConfig();
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

    // Create a more descriptive header based on the tool type
    let toolTitle;

    switch(data.tool) {
      case 'run_shell':
        toolTitle = 'Executing Shell Command';
        break;
      case 'edit_file':
        toolTitle = 'Editing File';
        break;
      case 'change_directory':
        toolTitle = 'Changing Directory';
        break;
      case 'bookmark_directory':
        toolTitle = 'Saving Directory Bookmark';
        break;
      case 'use_bookmark':
        toolTitle = 'Using Bookmark';
        break;
      case 'list_bookmarks':
        toolTitle = 'Listing Bookmarks';
        break;
      case 'remove_bookmark':
        toolTitle = 'Removing Bookmark';
        break;
      case 'show_history':
        toolTitle = 'Showing Command History';
        break;
      case 'clear_history':
        toolTitle = 'Clearing History';
        break;
      case 'repeat_command':
        toolTitle = 'Repeating Command';
        break;
      case 'get_config':
        toolTitle = 'Getting Project Configuration';
        break;
      case 'update_config':
        toolTitle = 'Updating Configuration';
        break;
      case 'add_custom_command':
        toolTitle = 'Adding Custom Command';
        break;
      case 'run_custom_command':
        toolTitle = 'Running Custom Command';
        break;
      case 'remove_custom_command':
        toolTitle = 'Removing Custom Command';
        break;
      case 'browse_files':
        toolTitle = 'Browsing Files';
        break;
      case 'file_details':
        toolTitle = 'Getting File Details';
        break;
      case 'analyze_code':
        toolTitle = 'Analyzing Code';
        break;
      default:
        toolTitle = `Executing: ${data.tool}`;
    }

    // Create header
    const headerEl = document.createElement('div');
    headerEl.className = 'tool-header';
    headerEl.textContent = toolTitle;
    toolEl.appendChild(headerEl);

    // Create command/input display
    const commandEl = document.createElement('div');
    commandEl.className = 'tool-command';

    if (data.tool === 'run_shell') {
      commandEl.textContent = data.input.command;
    } else if (data.tool === 'edit_file') {
      commandEl.textContent = `File: ${data.input.path}`;
    } else if (data.tool === 'change_directory') {
      commandEl.textContent = `Path: ${data.input.path}`;
    } else if (data.tool === 'bookmark_directory') {
      commandEl.textContent = `Name: ${data.input.name}${data.input.path ? `, Path: ${data.input.path}` : ''}`;
    } else if (data.tool === 'use_bookmark') {
      commandEl.textContent = `Bookmark: ${data.input.name}`;
    } else if (data.tool === 'list_bookmarks') {
      commandEl.textContent = `Listing all bookmarks`;
    } else if (data.tool === 'remove_bookmark') {
      commandEl.textContent = `Name: ${data.input.name}`;
    } else if (data.tool === 'show_history') {
      commandEl.textContent = `Limit: ${data.input.limit || 'default'}${data.input.search ? `, Search: "${data.input.search}"` : ''}${data.input.current_dir_only ? ', Current directory only' : ''}`;
    } else if (data.tool === 'clear_history') {
      commandEl.textContent = data.input.entry_id ? `Entry ID: ${data.input.entry_id}` : 'All history';
    } else if (data.tool === 'repeat_command') {
      commandEl.textContent = data.input.command_id ? `Command ID: ${data.input.command_id}` : `Index: ${data.input.index}`;
    } else if (data.tool === 'get_config') {
      commandEl.textContent = `Getting current project configuration`;
    } else if (data.tool === 'update_config') {
      commandEl.textContent = `Settings: ${JSON.stringify(data.input.settings, null, 2)}`;
    } else if (data.tool === 'add_custom_command') {
      commandEl.textContent = `Name: ${data.input.name}, Description: ${data.input.description}`;
    } else if (data.tool === 'run_custom_command') {
      commandEl.textContent = `Command: ${data.input.name}`;
    } else if (data.tool === 'remove_custom_command') {
      commandEl.textContent = `Command: ${data.input.name}`;
    } else {
      commandEl.textContent = JSON.stringify(data.input, null, 2);
    }

    toolEl.appendChild(commandEl);

    // Add placeholder for output if it's a shell command
    if (data.tool === 'run_shell') {
      const outputPlaceholder = document.createElement('div');
      outputPlaceholder.className = 'tool-output';
      outputPlaceholder.textContent = 'Running command...';
      toolEl.appendChild(outputPlaceholder);
    }

    chatContainer.appendChild(toolEl);
    scrollToBottom();
  }
  
  function addToolExecutionResult(data) {
    // Try to find existing tool execution element
    // Instead of using Date.now() (which will almost never match),
    // find the last tool execution element for this specific tool
    const allToolEls = document.querySelectorAll('.tool-execution');
    let toolEl = null;

    // Start from the end (most recent) and find the matching tool element
    for (let i = allToolEls.length - 1; i >= 0; i--) {
      const el = allToolEls[i];
      const header = el.querySelector('.tool-header');

      // Match based on tool type in the header
      if (header && getToolTypeFromHeader(header.textContent) === data.tool) {
        toolEl = el;
        break;
      }
    }

    // If still not found, fall back to the last element
    if (!toolEl) {
      toolEl = document.querySelector('.tool-execution:last-child');
    }

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

  // Helper function to get tool type from header text
  function getToolTypeFromHeader(headerText) {
    if (headerText.includes('Shell Command')) return 'run_shell';
    if (headerText.includes('Editing File')) return 'edit_file';
    if (headerText.includes('Changing Directory')) return 'change_directory';
    if (headerText.includes('Saving Directory Bookmark')) return 'bookmark_directory';
    if (headerText.includes('Using Bookmark')) return 'use_bookmark';
    if (headerText.includes('Listing Bookmarks')) return 'list_bookmarks';
    if (headerText.includes('Removing Bookmark')) return 'remove_bookmark';
    if (headerText.includes('Showing Command History')) return 'show_history';
    if (headerText.includes('Clearing History')) return 'clear_history';
    if (headerText.includes('Repeating Command')) return 'repeat_command';
    if (headerText.includes('Getting Project Configuration')) return 'get_config';
    if (headerText.includes('Updating Configuration')) return 'update_config';
    if (headerText.includes('Adding Custom Command')) return 'add_custom_command';
    if (headerText.includes('Running Custom Command')) return 'run_custom_command';
    if (headerText.includes('Removing Custom Command')) return 'remove_custom_command';
    if (headerText.includes('Browsing Files')) return 'browse_files';
    if (headerText.includes('Getting File Details')) return 'file_details';
    if (headerText.includes('Analyzing Code')) return 'analyze_code';

    // Extract tool name from default format "Executing: tool_name"
    const match = headerText.match(/Executing: (\w+)/);
    return match ? match[1] : '';
  }
  
  function updateToolExecutionContent(toolEl, data) {
    // Clear any existing placeholder output
    const existingOutput = toolEl.querySelector('.tool-output');
    if (existingOutput && existingOutput.textContent === 'Running command...') {
      existingOutput.remove();
    }

    // Create status indicator
    let statusEl = toolEl.querySelector('.tool-status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.className = 'tool-status';
      // Insert status after the header but before command
      const headerEl = toolEl.querySelector('.tool-header');
      if (headerEl && headerEl.nextSibling) {
        toolEl.insertBefore(statusEl, headerEl.nextSibling);
      } else {
        toolEl.appendChild(statusEl);
      }
    }

    // Update status based on result
    if (data.result && data.result.success === false) {
      statusEl.textContent = '❌ Failed';
      statusEl.style.color = '#d9534f';
    } else {
      statusEl.textContent = '✅ Success';
      statusEl.style.color = '#28a745';
    }

    // Display result based on tool type
    if (data.tool === 'run_shell') {
      // Create or update output element
      let outputEl = toolEl.querySelector('.tool-output');
      if (!outputEl) {
        outputEl = document.createElement('div');
        outputEl.className = 'tool-output';
        toolEl.appendChild(outputEl);
      }
      outputEl.textContent = data.result.stdout;

      // Add stderr if present
      if (data.result.stderr) {
        let errorEl = toolEl.querySelector('.tool-error');
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'tool-error';
          toolEl.appendChild(errorEl);
        }
        errorEl.textContent = data.result.stderr;
      }
    } else if (data.tool === 'edit_file') {
      // Create or update result element
      let resultEl = toolEl.querySelector('.tool-output');
      if (!resultEl) {
        resultEl = document.createElement('div');
        resultEl.className = 'tool-output';
        toolEl.appendChild(resultEl);
      }
      resultEl.textContent = data.result.message;
    } else if (data.tool === 'change_directory' || data.tool === 'use_bookmark') {
      // Create or update result element
      let resultEl = toolEl.querySelector('.tool-output');
      if (!resultEl) {
        resultEl = document.createElement('div');
        resultEl.className = 'tool-output';
        toolEl.appendChild(resultEl);
      }
      resultEl.textContent = data.result.message;

      // Update directory display if successful
      if (data.result.success && data.result.newDirectory) {
        updateDirectoryDisplay(data.result.newDirectory);
      }
    } else if (data.tool === 'bookmark_directory' || data.tool === 'remove_bookmark' ||
               data.tool === 'clear_history' || data.tool === 'repeat_command' ||
               data.tool === 'add_custom_command' || data.tool === 'run_custom_command') {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';
      resultEl.textContent = data.result.message;
      toolEl.appendChild(resultEl);

      // For run_custom_command, show the command output if available
      if (data.tool === 'run_custom_command' && data.result.output) {
        const outputEl = document.createElement('div');
        outputEl.className = 'tool-output-detail';
        outputEl.textContent = data.result.output;
        toolEl.appendChild(outputEl);
      }
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
    } else if (data.tool === 'get_config' && data.result.config) {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';

      const configTable = document.createElement('table');
      configTable.className = 'config-table';

      // Add header row
      const headerRow = document.createElement('tr');
      const headerSetting = document.createElement('th');
      headerSetting.textContent = 'Setting';
      const headerValue = document.createElement('th');
      headerValue.textContent = 'Value';
      headerRow.appendChild(headerSetting);
      headerRow.appendChild(headerValue);
      configTable.appendChild(headerRow);

      // Add configuration entries
      Object.entries(data.result.config).forEach(([key, value]) => {
        if (key !== 'customCommands') { // Handle custom commands separately
          const row = document.createElement('tr');

          const settingCell = document.createElement('td');
          settingCell.className = 'config-setting';
          settingCell.textContent = key;

          const valueCell = document.createElement('td');
          valueCell.className = 'config-value';

          // Format the value based on its type
          if (Array.isArray(value)) {
            valueCell.textContent = value.join(', ');
          } else if (typeof value === 'object' && value !== null) {
            valueCell.textContent = JSON.stringify(value, null, 2);
          } else {
            valueCell.textContent = String(value);
          }

          row.appendChild(settingCell);
          row.appendChild(valueCell);
          configTable.appendChild(row);
        }
      });

      resultEl.textContent = 'Project Configuration:';
      resultEl.appendChild(configTable);

      // Handle custom commands if present
      if (data.result.config.customCommands && Object.keys(data.result.config.customCommands).length > 0) {
        const commandsHeader = document.createElement('div');
        commandsHeader.className = 'config-section-header';
        commandsHeader.textContent = 'Custom Commands:';
        resultEl.appendChild(commandsHeader);

        const commandsList = document.createElement('ul');
        commandsList.className = 'custom-commands-list';

        Object.entries(data.result.config.customCommands).forEach(([name, cmdData]) => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${name}</strong>: ${cmdData.description}<br><code>${cmdData.command}</code>`;
          commandsList.appendChild(li);
        });

        resultEl.appendChild(commandsList);
      }

      toolEl.appendChild(resultEl);
    } else if (data.tool === 'update_config') {
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-output';
      resultEl.textContent = data.result.message;

      if (data.result.success && data.result.config) {
        const updatedSettings = document.createElement('div');
        updatedSettings.className = 'updated-settings';

        const settingsList = document.createElement('ul');
        Object.keys(data.input.settings).forEach(key => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${key}</strong>: ${JSON.stringify(data.input.settings[key])}`;
          settingsList.appendChild(li);
        });

        updatedSettings.textContent = 'Updated settings:';
        updatedSettings.appendChild(settingsList);
        resultEl.appendChild(updatedSettings);
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
    loadProjectConfig();
  });

  // Handle configuration updates
  window.api.onConfigUpdated((config) => {
    projectConfig = config;
    updateConfigUI();
  });

  // Handle custom commands updates
  window.api.onCustomCommandsUpdated(() => {
    loadCustomCommands();
  });

  // Configuration functions
  function toggleConfigPanel() {
    configPanel.classList.toggle('visible');
    if (configPanel.classList.contains('visible') && !projectConfig) {
      loadProjectConfig();
    }
  }

  function loadProjectConfig() {
    window.api.getProjectConfig().then(result => {
      if (result.success && result.config) {
        projectConfig = result.config;
        updateConfigUI();
        loadCustomCommands();
      }
    });
  }

  function updateConfigUI() {
    if (!projectConfig) return;

    // Update model selection
    const modelSelect = document.getElementById('config-model');
    if (modelSelect) {
      modelSelect.value = projectConfig.model || 'claude-3-5-sonnet-20240620';
    }

    // Update temperature
    const temperatureInput = document.getElementById('config-temperature');
    if (temperatureInput) {
      temperatureInput.value = projectConfig.temperature || 0.7;
      updateTemperatureDisplay();
    }

    // Update max tokens
    const maxTokensInput = document.getElementById('config-max-tokens');
    if (maxTokensInput) {
      maxTokensInput.value = projectConfig.maxTokens || 4000;
    }

    // Update display settings
    const showFileTreeInput = document.getElementById('config-show-file-tree');
    if (showFileTreeInput) {
      showFileTreeInput.checked = projectConfig.showFileTree !== false;
    }

    const maxFileTreeDepthInput = document.getElementById('config-max-file-tree-depth');
    if (maxFileTreeDepthInput) {
      maxFileTreeDepthInput.value = projectConfig.maxFileTreeDepth || 3;
    }

    const excludePatternsInput = document.getElementById('config-exclude-patterns');
    if (excludePatternsInput && projectConfig.excludePatterns) {
      excludePatternsInput.value = projectConfig.excludePatterns.join(',');
    }
  }

  function updateTemperatureDisplay() {
    temperatureValue.textContent = temperatureSlider.value;
  }

  function saveConfiguration() {
    const settings = {
      model: document.getElementById('config-model').value,
      temperature: parseFloat(document.getElementById('config-temperature').value),
      maxTokens: parseInt(document.getElementById('config-max-tokens').value),
      showFileTree: document.getElementById('config-show-file-tree').checked,
      maxFileTreeDepth: parseInt(document.getElementById('config-max-file-tree-depth').value)
    };

    // Handle exclude patterns
    const excludePatterns = document.getElementById('config-exclude-patterns').value;
    if (excludePatterns) {
      settings.excludePatterns = excludePatterns.split(',').map(p => p.trim());
    }

    // Suggest using the update_config tool
    const command = `Update the project configuration with these settings: ${JSON.stringify(settings, null, 2)}`;
    userInput.value = command;
    handleSendMessage();
  }

  // Custom commands functions
  function loadCustomCommands() {
    window.api.getCustomCommands().then(result => {
      if (result.success && result.commands) {
        customCommands = result.commands;
        renderCustomCommands();
      }
    });
  }

  function renderCustomCommands() {
    customCommandsList.innerHTML = '';

    if (Object.keys(customCommands).length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-commands-message';
      emptyMessage.textContent = 'No custom commands defined yet. Add one to get started.';
      customCommandsList.appendChild(emptyMessage);
      return;
    }

    Object.entries(customCommands).forEach(([name, command]) => {
      const commandItem = document.createElement('div');
      commandItem.className = 'custom-command-item';

      const commandHeader = document.createElement('div');
      commandHeader.className = 'custom-command-header';

      const commandName = document.createElement('div');
      commandName.className = 'custom-command-name';
      commandName.textContent = name;

      commandHeader.appendChild(commandName);
      commandItem.appendChild(commandHeader);

      const commandDescription = document.createElement('div');
      commandDescription.className = 'custom-command-description';
      commandDescription.textContent = command.description;
      commandItem.appendChild(commandDescription);

      const commandCode = document.createElement('div');
      commandCode.className = 'custom-command-code';
      commandCode.textContent = command.command;
      commandItem.appendChild(commandCode);

      const commandActions = document.createElement('div');
      commandActions.className = 'custom-command-actions';

      const runButton = document.createElement('button');
      runButton.className = 'custom-command-run';
      runButton.textContent = '▶ Run';
      runButton.addEventListener('click', () => {
        const runCommand = `Run the custom command "${name}"`;
        userInput.value = runCommand;
        handleSendMessage();
      });

      const deleteButton = document.createElement('button');
      deleteButton.className = 'custom-command-delete';
      deleteButton.textContent = '🗑️ Delete';
      deleteButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete the "${name}" command?`)) {
          const deleteCommand = `Remove the custom command "${name}"`;
          userInput.value = deleteCommand;
          handleSendMessage();
        }
      });

      commandActions.appendChild(runButton);
      commandActions.appendChild(deleteButton);
      commandItem.appendChild(commandActions);

      customCommandsList.appendChild(commandItem);
    });
  }

  function showAddCommandModal() {
    addCommandModal.style.display = 'block';
    document.getElementById('command-name').focus();
  }

  function hideAddCommandModal() {
    addCommandModal.style.display = 'none';
    document.getElementById('command-name').value = '';
    document.getElementById('command-description').value = '';
    document.getElementById('command-script').value = '';
  }

  function saveCustomCommand() {
    const name = document.getElementById('command-name').value.trim();
    const description = document.getElementById('command-description').value.trim();
    const command = document.getElementById('command-script').value.trim();

    if (!name || !description || !command) {
      alert('Please fill in all fields');
      return;
    }

    hideAddCommandModal();

    const addCommand = `Add a custom command named "${name}" with description "${description}" that runs: ${command}`;
    userInput.value = addCommand;
    handleSendMessage();
  }
});