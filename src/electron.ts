import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { executeShellCommand } from './tools/shell';
import { editFile } from './tools/file';
import { toolDefinitions } from './tools/definitions';
import {
  browseFiles,
  getFileDetails,
  analyzeCode,
  getGitStatus,
  getGitCommits,
  createGitCommit,
  getGitDiff,
  gitCheckout,
  gitPull,
  gitPush
} from './tools/browser';

// Load environment variables
dotenv.config();

// Define types
type ShellResult = {
  stdout: string;
  stderr: string;
  exit_code: number;
};

type FileResult = {
  success: boolean;
  message: string;
  path: string;
  edit_type: string;
};

type ToolResult = ShellResult | FileResult;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recreate window on activation (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC communication for sending messages to the LLM
ipcMain.handle('send-message', async (event, message: string) => {
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    // Create system prompt
    const systemPrompt = `You are a helpful AI terminal assistant that can run shell commands and edit files in the user's project.
Working directory: ${process.cwd()}

IMPORTANT: You MUST USE TOOLS to complete user requests. DO NOT just think about using tools - actually use them.
When users ask for information about files or the system, ALWAYS use the appropriate tool.
When users want to create or modify files, ALWAYS use the edit_file tool.

You have access to the following tools:

Basic tools:
1. run_shell - Execute shell commands in the project directory
2. edit_file - Edit file contents using path and content

File browser tools:
3. browse_files - Browse files in a directory with optional filtering and sorting
4. file_details - Get details about a specific file, including its content
5. analyze_code - Analyze code in a file to extract information about its structure

Git operations:
6. git_status - Get the git status of the repository
7. git_commits - Get recent git commits
8. git_commit - Create a git commit
9. git_diff - Get the diff for a file or the entire repository
10. git_checkout - Perform a git checkout
11. git_pull - Perform a git pull
12. git_push - Perform a git push

- Be precise and helpful
- When executing commands, explain what you're doing
- Prefer direct solutions that require minimal user intervention
- Always prioritize security and safety - never execute dangerous commands
- When editing files, verify the changes carefully`;

    // Create message array
    const messages: Array<{role: 'user' | 'assistant', content: string}> = [
      {
        role: 'user',
        content: message
      }
    ];

    // Call the API and process tools
    let waitingForToolResult = true;
    let finalResponse = null;
    let conversation: Array<{role: 'user' | 'assistant', content: string}> = [...messages];

    while (waitingForToolResult) {
      // Send progress update to UI
      mainWindow?.webContents.send('thinking', true);

      // Call the API
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: conversation.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : msg.content
        })),
        tools: toolDefinitions as any
      });

      // Process the response
      if (response.content && response.content.length > 0) {
        // Find any tool use messages
        const toolUseMessages = response.content.filter((msg: any) => msg.type === 'tool_use');
        const textMessages = response.content.filter((msg: any) => msg.type === 'text');
        
        // Get the message to process
        const lastMessage = toolUseMessages.length > 0 ? toolUseMessages[0] : response.content[0];
        
        if (lastMessage.type === 'text') {
          // Regular text response
          finalResponse = lastMessage.text;
          waitingForToolResult = false;
          
          // Send the assistant's response to the UI
          mainWindow?.webContents.send('thinking', false);
          
        } else if (lastMessage.type === 'tool_use') {
          // Add explanation to conversation if there is one
          if (textMessages.length > 0 && 'text' in textMessages[0]) {
            // Send the assistant's explanation to the UI
            mainWindow?.webContents.send('assistant-message', textMessages[0].text);
          }

          // Add tool use to conversation
          conversation.push({
            role: 'assistant',
            content: JSON.stringify([lastMessage])
          });
          
          // Execute the tool
          try {
            // Send tool execution status to UI
            mainWindow?.webContents.send('tool-execution-start', {
              tool: lastMessage.name,
              input: lastMessage.input
            });
            
            // Execute the tool
            const toolResult = await executeToolCall(lastMessage.name, lastMessage.input);
            
            // Send tool execution result to UI
            mainWindow?.webContents.send('tool-execution-result', {
              tool: lastMessage.name,
              input: lastMessage.input,
              result: toolResult
            });
            
            // Add tool result to conversation
            conversation.push({
              role: 'user',
              content: JSON.stringify([{
                type: 'tool_result',
                tool_call_id: lastMessage.id,
                content: toolResult
              }])
            });
            
          } catch (error: any) {
            const errorMessage = error.message || 'Unknown error occurred';
            
            // Send error to UI
            mainWindow?.webContents.send('tool-execution-error', {
              tool: lastMessage.name,
              error: errorMessage
            });
            
            // Add error result to conversation
            conversation.push({
              role: 'user',
              content: JSON.stringify([{
                type: 'tool_result',
                tool_call_id: lastMessage.id,
                content: { error: errorMessage }
              }])
            });
          }
        } else {
          // Unexpected response type
          finalResponse = `Unexpected response type: ${lastMessage.type}`;
          waitingForToolResult = false;
        }
      } else {
        finalResponse = 'No response content from assistant';
        waitingForToolResult = false;
      }
    }

    return { response: finalResponse };
  } catch (error: any) {
    console.error('Error processing request:', error);
    return { error: error.message || 'Error processing request' };
  }
});

// Execute tool calls
async function executeToolCall(
  toolName: string,
  toolInput: any
): Promise<ToolResult> {
  const projectDir = process.cwd();

  switch (toolName) {
    case 'run_shell':
      return await executeShellCommand(toolInput.command, projectDir, false);

    case 'edit_file':
      return await editFile(toolInput.path, toolInput.content, projectDir);

    // File browser tools
    case 'browse_files':
      return await browseFiles(
        toolInput.directory,
        projectDir,
        {
          showHidden: toolInput.show_hidden,
          filter: toolInput.filter,
          sort: toolInput.sort,
          sortDirection: toolInput.sort_direction
        }
      );

    case 'file_details':
      return await getFileDetails(toolInput.path, projectDir);

    case 'analyze_code':
      return await analyzeCode(toolInput.path, projectDir);

    // Git operations
    case 'git_status':
      return await getGitStatus(projectDir);

    case 'git_commits':
      return await getGitCommits(projectDir, toolInput.count);

    case 'git_commit':
      return await createGitCommit(projectDir, toolInput.message, toolInput.files);

    case 'git_diff':
      return await getGitDiff(projectDir, toolInput.file);

    case 'git_checkout':
      return await gitCheckout(projectDir, toolInput.target, toolInput.create_branch);

    case 'git_pull':
      return await gitPull(projectDir, toolInput.remote, toolInput.branch);

    case 'git_push':
      return await gitPush(projectDir, toolInput.remote, toolInput.branch, toolInput.force);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}