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
    } else if (data.tool === 'get_config') {
      content += `<div class="tool-command">Getting project configuration</div>`;
    } else if (data.tool === 'update_config') {
      content += `<div class="tool-command">Updating configuration settings: ${JSON.stringify(data.input.settings)}</div>`;
    } else if (data.tool === 'add_custom_command') {
      content += `<div class="tool-command">Adding custom command: ${data.input.name} (${data.input.description})</div>`;
    } else if (data.tool === 'run_custom_command') {
      content += `<div class="tool-command">Running custom command: ${data.input.name}</div>`;
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