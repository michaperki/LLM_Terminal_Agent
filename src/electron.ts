import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import os from 'os';
import { executeShellCommand } from './tools/shell';
import { editFile } from './tools/file';
import { changeDirectory, getCurrentDirectoryInfo } from './tools/dirTools';
import { addBookmark, getBookmark, listBookmarks, removeBookmark } from './tools/bookmarks';
import { addHistoryEntry, getHistory, clearHistory } from './tools/history';
import { toolDefinitions } from './tools/definitions';
import {
  browseFiles,
  getFileDetails,
  analyzeCode,
  getFileTree,
  getFilteredFileTree,
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

// Load config from .llmterminalrc file if it exists
const loadConfig = () => {
  const configPath = path.join(os.homedir(), '.llmterminalrc');
  try {
    const configData = fsSync.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch {
    return {};
  }
};

const config = loadConfig();
const defaultDir = config.defaultDirectory || process.cwd();

// Check if a path is allowed (e.g., prevent access to sensitive directories)
function isPathAllowed(dirPath: string): boolean {
  const restrictedPaths = [
    '/etc', '/var/lib', '/boot', '/usr/bin',
    'C:\\Windows', 'C:\\Program Files'
  ];

  const normalizedPath = path.normalize(dirPath);

  return !restrictedPaths.some(restricted =>
    normalizedPath === restricted ||
    normalizedPath.startsWith(`${restricted}${path.sep}`)
  );
}

// Current working directory for the project
let currentDirectory = defaultDir;

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

// Browser tool result types
interface FileBrowserResult {
  currentPath: string;
  items: Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
    extension: string;
  }>;
  error?: string;
}

interface FileDetailsResult {
  file: {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
    extension: string;
  } | null;
  content?: string;
  error?: string;
}

interface CodeAnalysisResult {
  language: string;
  lineCount: number;
  charCount: number;
  syntaxValid: boolean;
  imports: string[];
  functions: string[];
  classes: string[];
  error?: string;
}

// Git operation result
interface GitOperationResult {
  success: boolean;
  message: string;
  data?: any;
}

// Directory change result
interface DirectoryChangeResult {
  success: boolean;
  message: string;
  oldDirectory: string;
  newDirectory: string;
}

// Bookmark results
interface BookmarkResult {
  success: boolean;
  message: string;
  bookmarks?: Array<{
    name: string;
    path: string;
    description?: string;
    lastAccessed?: number;
  }>;
}

// History results
interface HistoryResult {
  success: boolean;
  message: string;
  entries?: Array<{
    id: string;
    timestamp: number;
    userInput: string;
    assistantResponse?: string;
    directory?: string;
    tools?: Array<{
      name: string;
      input: any;
      result: any;
    }>;
  }>;
}

// Combined tool result type
type ToolResult =
  | ShellResult
  | FileResult
  | FileBrowserResult
  | FileDetailsResult
  | CodeAnalysisResult
  | GitOperationResult
  | DirectoryChangeResult
  | BookmarkResult
  | HistoryResult;

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

// Handle directory selection
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Project Directory',
    defaultPath: currentDirectory
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedDir = result.filePaths[0];

    // Check if the directory is allowed
    if (!isPathAllowed(selectedDir)) {
      return {
        success: false,
        error: 'Access to this directory is restricted for security reasons'
      };
    }

    // Update current directory
    currentDirectory = selectedDir;

    // Save last used directory for future sessions
    const historyPath = path.join(os.homedir(), '.llmterminal_history');
    try {
      fsSync.writeFileSync(historyPath, JSON.stringify({ lastDir: selectedDir }));
    } catch {
      // Ignore errors in saving history
    }

    return {
      success: true,
      directory: selectedDir
    };
  }

  return {
    success: false,
    error: 'No directory selected'
  };
});

// Get current directory
ipcMain.handle('get-current-directory', () => {
  return currentDirectory;
});

// Get file tree
ipcMain.handle('get-file-tree', async (event, options = {}) => {
  try {
    const tree = await getFileTree(
      options.path || '',
      currentDirectory,
      {
        maxDepth: options.maxDepth || 3,
        showHidden: options.showHidden || false,
        excludePatterns: options.excludePatterns
      }
    );
    return { success: true, tree };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Get file content
ipcMain.handle('get-file-content', async (event, filePath) => {
  try {
    const resolvedPath = path.resolve(currentDirectory, filePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Handle IPC communication for sending messages to the LLM
ipcMain.handle('send-message', async (event, message: string) => {
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    // Create a history entry for this interaction
    const historyEntry: {
      userInput: string;
      directory: string;
      tools: Array<{name: string; input: any; result: any}>;
      assistantResponse?: string;
    } = {
      userInput: message,
      directory: currentDirectory,
      tools: []
    };

    // Create system prompt
    const systemPrompt = `You are a helpful AI terminal assistant that can run shell commands and edit files in the user's project.
Working directory: ${currentDirectory}

IMPORTANT: You MUST USE TOOLS to complete user requests. DO NOT just think about using tools - actually use them.
When users ask for information about files or the system, ALWAYS use the appropriate tool.
When users want to create or modify files, ALWAYS use the edit_file tool.

You have access to the following tools:

Basic tools:
1. change_directory - Change the current working directory for the session
2. run_shell - Execute shell commands in the project directory
3. edit_file - Edit file contents using path and content

Directory bookmarks:
4. bookmark_directory - Save current or specified directory as a named bookmark
5. use_bookmark - Change to a previously bookmarked directory
6. list_bookmarks - Show all saved directory bookmarks
7. remove_bookmark - Delete a saved bookmark

Command history:
8. show_history - Display previous commands and their results
9. clear_history - Clear command history (all or specific entry)
10. repeat_command - Repeat a previous command from history

File browser tools:
11. browse_files - Browse files in a directory with optional filtering and sorting
12. file_details - Get details about a specific file, including its content
13. analyze_code - Analyze code in a file to extract information about its structure

Git operations:
14. git_status - Get the git status of the repository
15. git_commits - Get recent git commits
16. git_commit - Create a git commit
17. git_diff - Get the diff for a file or the entire repository
18. git_checkout - Perform a git checkout
19. git_pull - Perform a git pull
20. git_push - Perform a git push

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

            // Track tool usage in history
            historyEntry.tools.push({
              name: lastMessage.name,
              input: lastMessage.input,
              result: toolResult
            });

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

    // Save history entry with assistant response
    if (finalResponse) {
      historyEntry.assistantResponse = finalResponse;
      addHistoryEntry(historyEntry);
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
  const projectDir = currentDirectory;

  switch (toolName) {
    case 'change_directory':
      const dirResult = await changeDirectory(toolInput.path, projectDir);
      if (dirResult.success) {
        // Update the current directory
        currentDirectory = dirResult.newDirectory;

        // Notify the renderer about the directory change
        mainWindow?.webContents.send('directory-changed', currentDirectory);

        // Save the last used directory
        const historyPath = path.join(os.homedir(), '.llmterminal_history');
        try {
          fsSync.writeFileSync(historyPath, JSON.stringify({ lastDir: currentDirectory }));
        } catch {
          // Ignore errors in saving history
        }
      }
      return dirResult;

    case 'bookmark_directory':
      const dirPath = toolInput.path || projectDir;
      const bookmark = addBookmark(toolInput.name, dirPath, toolInput.description);

      if (bookmark) {
        return {
          success: true,
          message: `Directory "${dirPath}" bookmarked as "${toolInput.name}"`
        };
      } else {
        return {
          success: false,
          message: `Failed to bookmark directory "${dirPath}"`
        };
      }

    case 'use_bookmark':
      const foundBookmark = getBookmark(toolInput.name);

      if (!foundBookmark) {
        return {
          success: false,
          message: `Bookmark "${toolInput.name}" not found`
        };
      }

      // Change to the bookmarked directory
      const bookmarkDirResult = await changeDirectory(foundBookmark.path, projectDir);
      if (bookmarkDirResult.success) {
        // Update the current directory
        currentDirectory = bookmarkDirResult.newDirectory;

        // Notify the renderer about the directory change
        mainWindow?.webContents.send('directory-changed', currentDirectory);

        // Save the last used directory
        const historyPath = path.join(os.homedir(), '.llmterminal_history');
        try {
          fsSync.writeFileSync(historyPath, JSON.stringify({ lastDir: currentDirectory }));
        } catch {
          // Ignore errors in saving history
        }
      }
      return bookmarkDirResult;

    case 'list_bookmarks':
      const bookmarks = listBookmarks();

      return {
        success: true,
        message: `Found ${bookmarks.length} bookmarks`,
        bookmarks
      };

    case 'remove_bookmark':
      const removed = removeBookmark(toolInput.name);

      return {
        success: removed,
        message: removed
          ? `Bookmark "${toolInput.name}" removed`
          : `Failed to remove bookmark "${toolInput.name}". Bookmark may not exist.`
      };

    case 'show_history':
      const limit = toolInput.limit || 10;
      const offset = toolInput.offset || 0;
      const search = toolInput.search;
      const currentDirOnly = toolInput.current_dir_only;

      const historyEntries = getHistory({
        limit,
        offset,
        search,
        directory: currentDirOnly ? projectDir : undefined
      });

      return {
        success: true,
        message: `Found ${historyEntries.length} history entries`,
        entries: historyEntries
      };

    case 'clear_history':
      if (!toolInput.entry_id && !toolInput.confirm) {
        return {
          success: false,
          message: "Clearing all history requires confirmation. Please set confirm: true to proceed."
        };
      }

      const clearedHistory = clearHistory(toolInput.entry_id);

      return {
        success: clearedHistory,
        message: clearedHistory
          ? toolInput.entry_id
            ? `History entry ${toolInput.entry_id} cleared`
            : "All command history cleared"
          : `Failed to clear history ${toolInput.entry_id ? 'entry ' + toolInput.entry_id : ''}`
      };

    case 'repeat_command':
      // Validate that we have either command_id or index, but not both
      if (!toolInput.command_id && !toolInput.index) {
        return {
          success: false,
          message: "You must provide either command_id or index to repeat a command"
        };
      }

      let historyEntry;

      if (toolInput.command_id) {
        // Find by ID
        const entries = getHistory();
        historyEntry = entries.find(entry => entry.id === toolInput.command_id);
      } else if (toolInput.index) {
        // Find by index
        const entries = getHistory({ limit: toolInput.index });
        historyEntry = entries[toolInput.index - 1];
      }

      if (!historyEntry) {
        return {
          success: false,
          message: "Could not find the specified command in history"
        };
      }

      // For Electron, we'll notify the renderer to repeat the command
      mainWindow?.webContents.send('repeat-command', historyEntry.userInput);

      return {
        success: true,
        message: `Repeating command: ${historyEntry.userInput}`
      };

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