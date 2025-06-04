# Converting to an Electron GUI Application

This guide outlines the steps to convert the terminal-based LLM agent into an Electron desktop application.

## Overview

Electron allows you to build cross-platform desktop applications using JavaScript, HTML, and CSS. The existing terminal agent can be adapted to run in an Electron window, providing a more user-friendly interface while retaining all the functionality.

## Requirements

- Node.js and npm (already installed)
- Basic knowledge of HTML, CSS, and JavaScript
- Understanding of the existing codebase

## Implementation Steps

### 1. Add Electron Dependencies

```bash
npm install --save-dev electron electron-builder
```

### 2. Update package.json

Add Electron-specific scripts and configuration:

```json
{
  "scripts": {
    "start": "electron .",
    "build": "tsc && electron-builder",
    "dev": "tsc && electron ."
  },
  "main": "dist/electron.js",
  "build": {
    "appId": "com.yourname.llm-terminal",
    "productName": "LLM Terminal",
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "directories": {
      "buildResources": "assets"
    }
  }
}
```

### 3. Create Electron Main Process File

Create `src/electron.ts`:

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { executeShellCommand } from './tools/shell';
import { editFile } from './tools/file';
import { toolDefinitions } from './tools/definitions';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Set up IPC handlers for communication with renderer
ipcMain.handle('send-message', async (event, message) => {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || ''
  });

  try {
    // Initialize conversation with system message
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI terminal assistant that can run shell commands and edit files in the user's project.`
      },
      {
        role: 'user',
        content: message
      }
    ];

    // Process conversation turns
    let waitingForToolResult = true;
    let finalResponse = null;

    while (waitingForToolResult) {
      // Call the API
      const response = await client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        temperature: 0.7,
        system: messages[0].content as string,
        messages: messages.slice(1),
        tools: toolDefinitions
      });

      const lastMessage = response.content[0];

      if (lastMessage.type === 'text') {
        // Regular text response
        finalResponse = lastMessage.text;
        waitingForToolResult = false;
      } else if (lastMessage.type === 'tool_use') {
        // Tool use request
        const toolName = lastMessage.name;
        const toolInput = lastMessage.input;

        // Add tool use to messages
        messages.push({
          role: 'assistant',
          content: [lastMessage]
        });

        // Execute the tool
        try {
          const toolResult = await executeToolCall(toolName, toolInput);

          // Send intermediate update to UI
          mainWindow?.webContents.send('tool-execution', {
            tool: toolName,
            input: toolInput,
            result: toolResult
          });

          // Add tool result to messages
          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_call_id: lastMessage.id,
              content: toolResult
            }]
          });

          // Continue the loop to get the next model response
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error occurred';

          // Add error result to messages
          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_call_id: lastMessage.id,
              content: { error: errorMessage }
            }]
          });
        }
      } else {
        // Unexpected response type
        finalResponse = `Unexpected response type: ${lastMessage.type}`;
        waitingForToolResult = false;
      }
    }

    return { response: finalResponse };
  } catch (error) {
    console.error('Error processing request:', error);
    return { error: 'Error processing request' };
  }
});

async function executeToolCall(toolName: string, toolInput: any) {
  switch (toolName) {
    case 'run_shell':
      return await executeShellCommand(toolInput.command, process.cwd(), false);
      
    case 'edit_file':
      return await editFile(toolInput.path, toolInput.content, process.cwd());
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

### 4. Create Preload Script

Create `src/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  onToolExecution: (callback: (data: any) => void) => {
    ipcRenderer.on('tool-execution', (event, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('tool-execution');
    };
  }
});
```

### 5. Create HTML/CSS/JS for UI

Create `public/index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>LLM Terminal</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <div class="app-container">
      <div class="chat-container" id="chat-container">
        <div class="welcome-message">
          <h1>LLM Terminal</h1>
          <p>Ask me to run commands or edit files in your project.</p>
        </div>
      </div>
      <div class="input-container">
        <textarea id="user-input" placeholder="Type your request here..."></textarea>
        <button id="send-button">Send</button>
      </div>
    </div>
    <script src="renderer.js"></script>
  </body>
</html>
```

Create `public/styles.css`:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
  color: #333;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.welcome-message {
  text-align: center;
  padding: 20px;
  color: #666;
}

.message {
  margin-bottom: 15px;
  padding: 10px 15px;
  border-radius: 8px;
  max-width: 80%;
}

.user-message {
  background-color: #e1f5fe;
  margin-left: auto;
  border-bottom-right-radius: 0;
}

.assistant-message {
  background-color: #f1f1f1;
  margin-right: auto;
  border-bottom-left-radius: 0;
}

.tool-execution {
  background-color: #f9f9f9;
  padding: 10px;
  margin: 10px 0;
  border-left: 3px solid #4caf50;
  font-family: monospace;
}

.input-container {
  display: flex;
  gap: 10px;
}

#user-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: none;
  height: 60px;
  font-family: inherit;
}

#send-button {
  padding: 12px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

#send-button:hover {
  background-color: #45a049;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background-color: #f7f7f7;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}

code {
  font-family: monospace;
  background-color: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
}
```

Create `public/renderer.js`:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');

  // Add event listeners
  sendButton.addEventListener('click', handleSendMessage);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Register callback for tool execution events
  window.api.onToolExecution((data) => {
    addToolExecutionMessage(data);
  });

  function handleSendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    userInput.value = '';
    
    // Show thinking indicator
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'message assistant-message';
    thinkingEl.innerHTML = '<div class="thinking">Thinking...</div>';
    chatContainer.appendChild(thinkingEl);
    
    // Send to backend
    window.api.sendMessage(message)
      .then((result) => {
        // Remove thinking indicator
        chatContainer.removeChild(thinkingEl);
        
        if (result.error) {
          addErrorMessage(result.error);
        } else {
          addMessage(result.response, 'assistant');
        }
      })
      .catch((error) => {
        // Remove thinking indicator
        chatContainer.removeChild(thinkingEl);
        addErrorMessage('An error occurred while processing your request.');
        console.error(error);
      });
  }

  function addMessage(content, sender) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}-message`;
    
    // Convert markdown-like formatting
    const formattedContent = content
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    
    messageEl.innerHTML = formattedContent;
    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function addToolExecutionMessage(data) {
    const toolEl = document.createElement('div');
    toolEl.className = 'tool-execution';
    
    let content = `<strong>Executing ${data.tool}</strong><br>`;
    
    if (data.tool === 'run_shell') {
      content += `<strong>Command:</strong> ${data.input.command}<br>`;
      content += `<strong>Output:</strong><br><pre>${data.result.stdout || ''}</pre>`;
      
      if (data.result.stderr) {
        content += `<strong>Error:</strong><br><pre>${data.result.stderr}</pre>`;
      }
      
      content += `<strong>Exit code:</strong> ${data.result.exit_code}`;
    } else if (data.tool === 'edit_file') {
      content += `<strong>File:</strong> ${data.input.path}<br>`;
      content += `<strong>Action:</strong> ${data.result.message}`;
    }
    
    toolEl.innerHTML = content;
    chatContainer.appendChild(toolEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function addErrorMessage(errorText) {
    const errorEl = document.createElement('div');
    errorEl.className = 'message error-message';
    errorEl.textContent = errorText;
    chatContainer.appendChild(errorEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
```

### 6. Update tsconfig.json

Update to include Electron-specific settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

## Building and Running

1. Compile TypeScript:
   ```bash
   npm run build
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

3. Build for distribution:
   ```bash
   npm run build
   ```

## Next Steps

1. Add authentication for API keys
2. Implement persistent conversations
3. Add themes and customization options
4. Create a file browser panel
5. Add terminal output styling

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference)