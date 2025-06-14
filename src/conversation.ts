import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions } from './tools/definitions';
import { executeShellCommand } from './tools/shell';
import { editFile } from './tools/file';
import { changeDirectory } from './tools/dirTools';
import { addBookmark, getBookmark, listBookmarks, removeBookmark } from './tools/bookmarks';
import { addHistoryEntry, getHistory, clearHistory } from './tools/history';
import {
  getProjectConfig,
  saveProjectConfig,
  ProjectConfig,
  addCustomCommand,
  getCustomCommands
} from './config';
import readline from 'readline';
import path from 'path';

// Import browser tools
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

// Types
export interface ConversationOptions {
  model: string;
  provider: string;
  useSandbox: boolean;
  maxTokens: number;
  temperature: number;
  projectDir: string;
  debug: boolean;
}

interface Message {
  role: string;
  content: string | any[];
}

// Define tool result types
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

// Configuration result
interface ConfigResult {
  success: boolean;
  message: string;
  config?: ProjectConfig;
}

// Custom command result
interface CustomCommandResult {
  success: boolean;
  message: string;
  name?: string;
  description?: string;
  command?: string;
  output?: string;
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
  | HistoryResult
  | ConfigResult
  | CustomCommandResult;

export async function startConversation(options: ConversationOptions) {
  console.log(`Starting conversation with ${options.provider} using model ${options.model}`);
  console.log(`Project directory: ${options.projectDir}`);

  // Load project configuration
  const projectConfig = await getProjectConfig(options.projectDir);
  console.log(`Loaded project configuration with model: ${projectConfig.model}`);

  // Override options with project configuration
  options.model = projectConfig.model || options.model;
  options.maxTokens = projectConfig.maxTokens || options.maxTokens;
  options.temperature = projectConfig.temperature || options.temperature;

  // Initialize client based on provider
  const client = initializeClient(options);

  // Setup readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Initial system message
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are a helpful AI terminal assistant that can run shell commands and edit files in the user's project.
Working directory: ${options.projectDir}

IMPORTANT: You MUST USE TOOLS to complete user requests. DO NOT just think about using tools - actually use them.
When users ask for information about files or the system, ALWAYS use the appropriate tool.
When users want to create or modify files, ALWAYS use the edit_file tool.
Never stop after a diagnostic step (e.g. list_bookmarks) if the original task isn't finished. Continue invoking tools until the user's request is satisfied or you truly need clarification.

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

Project configuration:
8. get_config - Get configuration settings for the current project
9. update_config - Update configuration settings for the current project
10. add_custom_command - Add a custom command to the current project
11. run_custom_command - Run a custom command defined in the project

Command history:
12. show_history - Display previous commands and their results
13. clear_history - Clear command history (all or specific entry)
14. repeat_command - Repeat a previous command from history

File browser tools:
15. browse_files - Browse files in a directory with optional filtering and sorting
16. file_details - Get details about a specific file, including its content
17. analyze_code - Analyze code in a file to extract information about its structure

Git operations:
18. git_status - Get the git status of the repository
19. git_commits - Get recent git commits
20. git_commit - Create a git commit
21. git_diff - Get the diff for a file or the entire repository
22. git_checkout - Perform a git checkout
23. git_pull - Perform a git pull
24. git_push - Perform a git push

WORKFLOW GUIDANCE - For complex tasks, follow these steps:
1. PLAN: Identify all required steps before taking action
2. EXECUTE: Run each step in sequence, using appropriate tools
3. VERIFY: Check the result of each step before proceeding
4. ADAPT: If a step fails, adjust your approach based on error messages

Example multi-step workflows:
- When asked to update a file:
  1. First use browse_files to locate the file
  2. Then use file_details to examine the current content
  3. Plan your changes carefully based on the file structure and purpose
  4. Use edit_file to implement the change
  5. Verify the change was successful

- When exploring an unfamiliar codebase:
  1. Use browse_files to explore the directory structure
  2. Use analyze_code on key files to understand patterns
  3. Use file_details to examine specific implementations
  4. Make changes that follow existing patterns

- When setting up a new project feature:
  1. Use browse_files to understand the project structure
  2. Use file_details to examine related files
  3. Use analyze_code to understand dependencies
  4. Create needed files with edit_file
  5. Update existing files to connect the new feature
  6. Test the changes

- Be precise and helpful
- When executing commands, explain what you're doing
- Prefer direct solutions that require minimal user intervention
- Always prioritize security and safety - never execute dangerous commands
- When editing files, verify the changes carefully

Example 1: If user asks "What files are in this directory?", use run_shell tool with command "ls -la"
Example 2: If user asks "Create a new file", use edit_file tool with appropriate path and content
Example 3: If user asks "Let's look at another project", use change_directory tool to switch directories
Example 4: If user says "Bookmark this directory as 'project'", use bookmark_directory tool
Example 5: If user says "Go to my project directory", use use_bookmark tool with the bookmark name
Example 6: If user asks "Show my command history", use show_history tool
Example 7: If user says "Run the last command again", use repeat_command tool with index 1
Example 8: If user says "Update the model to claude-3-haiku", use update_config tool
Example 9: If user says "Add a build command", use add_custom_command tool

NEVER refuse to use tools when they would help complete the user's request.`
    }
  ];
  
  // Main conversation loop
  console.log('\nWelcome to LLM Terminal Agent. Type your request or "exit" to quit.');

  let conversationActive = true;
  let repeatCommandMode = false;
  let repeatCommandInput = '';

  while (conversationActive) {
    // Get user input, or use repeated command if in repeat mode
    let userInput;
    if (repeatCommandMode) {
      userInput = repeatCommandInput;
      repeatCommandMode = false;
      console.log(`\nYou (repeated): ${userInput}`);
    } else {
      userInput = await askQuestion(rl, '\nYou: ');
    }

    if (userInput.toLowerCase() === 'exit') {
      conversationActive = false;
      continue;
    }

    // Create a history entry for this interaction
    const historyEntry: {
      userInput: string;
      directory: string;
      tools: Array<{name: string; input: any; result: any}>;
      assistantResponse?: string;
    } = {
      userInput,
      directory: options.projectDir,
      tools: []
    };

    // Add user message
    messages.push({ role: 'user', content: userInput });

    try {
      const assistantResponse = await processChatTurn(client, messages, options, historyEntry);

      // Check if this was a repeat_command call
      const lastToolUsed = historyEntry.tools.length > 0 ? historyEntry.tools[historyEntry.tools.length - 1] : null;
      if (lastToolUsed && lastToolUsed.name === 'repeat_command' && lastToolUsed.result.success) {
        // Get the entry to repeat
        let entryToRepeat;
        if (lastToolUsed.input.command_id) {
          const entries = getHistory();
          entryToRepeat = entries.find(e => e.id === lastToolUsed.input.command_id);
        } else if (lastToolUsed.input.index) {
          const entries = getHistory({ limit: lastToolUsed.input.index });
          entryToRepeat = entries[lastToolUsed.input.index - 1];
        }

        if (entryToRepeat) {
          // Set up for next loop iteration to use this command
          repeatCommandMode = true;
          repeatCommandInput = entryToRepeat.userInput;
          continue; // Skip saving history for the repeat_command itself
        }
      }

      // Save completed history entry with assistant response
      if (assistantResponse) {
        historyEntry.assistantResponse = assistantResponse;
        addHistoryEntry(historyEntry);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      messages.push({
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      });
    }
  }
  
  rl.close();
  console.log('Goodbye!');
}

function initializeClient(options: ConversationOptions) {
  if (options.provider.toLowerCase() === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
    return anthropic;
  } else {
    // For demonstration, we're only implementing Anthropic
    // In a full implementation, add OpenAI client here
    throw new Error('Only Anthropic provider is currently supported');
  }
}

async function processChatTurn(client: any, messages: Message[], options: ConversationOptions, historyEntry?: any) {
  let waitingForToolResult = true;
  let assistantResponse = '';

  while (waitingForToolResult) {
    try {
      // Format messages for Anthropic API
      const systemMessage = messages[0].content as string;
      const userMessages = messages.slice(1).map(msg => {
        if (typeof msg.content === 'string') {
          return {
            role: msg.role,
            content: msg.content
          };
        } else {
          return msg;
        }
      });

      // Call the API
      const response = await client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        system: systemMessage,
        messages: userMessages,
        tools: toolDefinitions
      });

      // Process the response
      if (response.content && response.content.length > 0) {
        // Find any tool use messages
        const toolUseMessages = response.content.filter((msg: any) => msg.type === 'tool_use');

        // Get the appropriate message to process
        const lastMessage = toolUseMessages.length > 0 ? toolUseMessages[0] : response.content[0];

        if (lastMessage.type === 'text') {
          // Regular text response
          console.log(`\nAssistant: ${lastMessage.text}`);
          messages.push({ role: 'assistant', content: lastMessage.text });
          assistantResponse = lastMessage.text;
          waitingForToolResult = false;
        } else if (lastMessage.type === 'tool_use') {
          // First, output the assistant's explanation if there is one
          const textMessages = response.content.filter((msg: any) => msg.type === 'text');
          if (textMessages.length > 0) {
            console.log(`\nAssistant: ${textMessages[0].text}`);
            assistantResponse += textMessages[0].text + '\n';
          }

          // Execute the tool
          try {
            // Add the tool use to the messages
            messages.push({
              role: 'assistant',
              content: [lastMessage]
            });

            // Execute the tool
            const toolResult = await executeToolCall(lastMessage.name, lastMessage.input, options);

            // Track tool usage in history if provided
            if (historyEntry && historyEntry.tools) {
              historyEntry.tools.push({
                name: lastMessage.name,
                input: lastMessage.input,
                result: toolResult
              });
            }

            // Display the result to the user based on tool type
            if (lastMessage.name === 'run_shell') {
              const shellResult = toolResult as ShellResult;
              console.log(`\nCommand Output:\n${shellResult.stdout}`);
              if (shellResult.stderr) {
                console.log(`\nError Output:\n${shellResult.stderr}`);
              }
            } else if (lastMessage.name === 'edit_file') {
              const fileResult = toolResult as FileResult;
              console.log(`\nFile Operation Result: ${fileResult.message}`);
            }

            // Add the tool result to the messages
            messages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_call_id: lastMessage.id,
                content: toolResult
              }]
            });

            // If this is a repeat_command tool call, we need to continue the conversation
            if (lastMessage.name === 'repeat_command') {
              // Continue processing to handle the repeated command
              continue;
            }

            // Continue tool execution loop - don't stop after diagnostic steps
            // Only break the loop for pure text responses (handled above)
            continue;
          } catch (error: any) {
            console.error('Error executing tool:', error.message);
            const errorMessage = error.message || 'Unknown error occurred';

            // Add the tool use to the messages
            messages.push({
              role: 'assistant',
              content: [lastMessage]
            });

            // Add the error result to the messages
            messages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_call_id: lastMessage.id,
                content: { error: errorMessage }
              }]
            });

            // Stop waiting for tool result after error
            waitingForToolResult = false;
          }
        } else {
          // Unexpected response type
          console.log(`\nAssistant: (Unexpected response type: ${lastMessage.type})`);
          waitingForToolResult = false;
        }
      } else {
        console.log('\nAssistant: (No response content)');
        waitingForToolResult = false;
      }
    } catch (error) {
      console.error('API Error:', error);
      messages.push({
        role: 'assistant',
        content: 'Sorry, I encountered an error communicating with the AI service. Please try again.'
      });
      assistantResponse = 'Sorry, I encountered an error communicating with the AI service. Please try again.';
      waitingForToolResult = false;
    }
  }

  return assistantResponse;
}

async function executeToolCall(
  toolName: string,
  toolInput: any,
  options: ConversationOptions
): Promise<ToolResult> {
  switch (toolName) {
    case 'change_directory':
      console.log(`\n[Changing directory to: ${toolInput.path}]`);
      const dirResult = await changeDirectory(toolInput.path, options.projectDir);
      if (dirResult.success) {
        // Update the project directory in options
        options.projectDir = dirResult.newDirectory;
        console.log(`\nSuccessfully changed directory to: ${options.projectDir}`);
      }
      return dirResult;

    case 'bookmark_directory':
      console.log(`\n[Bookmarking directory as: ${toolInput.name}]`);
      const dirPath = toolInput.path || options.projectDir;
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
      console.log(`\n[Using bookmark: ${toolInput.name}]`);
      const foundBookmark = getBookmark(toolInput.name);

      if (!foundBookmark) {
        return {
          success: false,
          message: `Bookmark "${toolInput.name}" not found`
        };
      }

      // Change to the bookmarked directory
      const bookmarkDirResult = await changeDirectory(foundBookmark.path, options.projectDir);
      if (bookmarkDirResult.success) {
        // Update the project directory in options
        options.projectDir = bookmarkDirResult.newDirectory;
        console.log(`\nSuccessfully changed to bookmarked directory: ${options.projectDir}`);
      }
      return bookmarkDirResult;

    case 'list_bookmarks':
      console.log(`\n[Listing bookmarks]`);
      const bookmarks = listBookmarks();

      return {
        success: true,
        message: `Found ${bookmarks.length} bookmarks`,
        bookmarks
      };

    case 'remove_bookmark':
      console.log(`\n[Removing bookmark: ${toolInput.name}]`);
      const removed = removeBookmark(toolInput.name);

      return {
        success: removed,
        message: removed
          ? `Bookmark "${toolInput.name}" removed`
          : `Failed to remove bookmark "${toolInput.name}". Bookmark may not exist.`
      };

    case 'show_history':
      console.log(`\n[Showing command history]`);
      const limit = toolInput.limit || 10;
      const offset = toolInput.offset || 0;
      const search = toolInput.search;
      const currentDirOnly = toolInput.current_dir_only;

      const historyEntries = getHistory({
        limit,
        offset,
        search,
        directory: currentDirOnly ? options.projectDir : undefined
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

      console.log(`\n[Clearing ${toolInput.entry_id ? 'history entry: ' + toolInput.entry_id : 'all command history'}]`);
      const clearedHistory = clearHistory(toolInput.entry_id);

      return {
        success: clearedHistory,
        message: clearedHistory
          ? toolInput.entry_id
            ? `History entry ${toolInput.entry_id} cleared`
            : "All command history cleared"
          : `Failed to clear history ${toolInput.entry_id ? 'entry ' + toolInput.entry_id : ''}`
      };

    case 'get_config':
      console.log(`\n[Getting project configuration]`);
      try {
        const config = await getProjectConfig(options.projectDir);
        return {
          success: true,
          message: 'Project configuration retrieved successfully',
          config
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Error retrieving project configuration: ${error.message}`
        };
      }

    case 'update_config':
      console.log(`\n[Updating project configuration]`);
      try {
        const currentConfig = await getProjectConfig(options.projectDir);
        const updatedConfig = {
          ...currentConfig,
          ...toolInput.settings
        };

        const saveLocation = toolInput.save_location || 'local';
        const saved = await saveProjectConfig(options.projectDir, updatedConfig, saveLocation as 'local' | 'global');

        if (saved) {
          // Update current options with new config
          if (updatedConfig.model) options.model = updatedConfig.model;
          if (updatedConfig.maxTokens) options.maxTokens = updatedConfig.maxTokens;
          if (updatedConfig.temperature) options.temperature = updatedConfig.temperature;

          return {
            success: true,
            message: `Project configuration updated successfully and saved to ${saveLocation} location`,
            config: updatedConfig
          };
        } else {
          return {
            success: false,
            message: 'Failed to save project configuration'
          };
        }
      } catch (error: any) {
        return {
          success: false,
          message: `Error updating project configuration: ${error.message}`
        };
      }

    case 'add_custom_command':
      console.log(`\n[Adding custom command: ${toolInput.name}]`);
      try {
        const added = await addCustomCommand(
          options.projectDir,
          toolInput.name,
          toolInput.description,
          toolInput.command
        );

        if (added) {
          return {
            success: true,
            message: `Custom command "${toolInput.name}" added successfully`,
            name: toolInput.name,
            description: toolInput.description,
            command: toolInput.command
          };
        } else {
          return {
            success: false,
            message: `Failed to add custom command "${toolInput.name}"`
          };
        }
      } catch (error: any) {
        return {
          success: false,
          message: `Error adding custom command: ${error.message}`
        };
      }

    case 'run_custom_command':
      console.log(`\n[Running custom command: ${toolInput.name}]`);
      try {
        const commands = await getCustomCommands(options.projectDir);
        const commandConfig = commands[toolInput.name];

        if (!commandConfig) {
          return {
            success: false,
            message: `Custom command "${toolInput.name}" not found`
          };
        }

        // Execute the command
        const result = await executeShellCommand(commandConfig.command, options.projectDir, options.useSandbox);

        return {
          success: result.exit_code === 0,
          message: `Custom command "${toolInput.name}" executed ${result.exit_code === 0 ? 'successfully' : 'with errors'}`,
          name: toolInput.name,
          description: commandConfig.description,
          command: commandConfig.command,
          output: result.stdout + (result.stderr ? `\n${result.stderr}` : '')
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Error running custom command: ${error.message}`
        };
      }

    case 'repeat_command':
      console.log(`\n[Repeating command from history]`);

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

      console.log(`\n[Repeating command: ${historyEntry.userInput}]`);

      // For the CLI version, we can use processChatTurn again with the same input
      // The message will be re-added by the main conversation loop
      // Here we just return the success result

      return {
        success: true,
        message: `Repeating command: ${historyEntry.userInput}`
      };

    case 'run_shell':
      console.log(`\n[Executing command: ${toolInput.command}]`);
      return await executeShellCommand(toolInput.command, options.projectDir, options.useSandbox);

    case 'edit_file':
      console.log(`\n[Editing file: ${toolInput.path}]`);
      return await editFile(toolInput.path, toolInput.content, options.projectDir);

    // File browser tools
    case 'browse_files':
      console.log(`\n[Browsing directory: ${toolInput.directory}]`);
      return await browseFiles(
        toolInput.directory,
        options.projectDir,
        {
          showHidden: toolInput.show_hidden,
          filter: toolInput.filter,
          sort: toolInput.sort,
          sortDirection: toolInput.sort_direction
        }
      );

    case 'file_details':
      console.log(`\n[Getting file details: ${toolInput.path}]`);
      return await getFileDetails(toolInput.path, options.projectDir);

    case 'analyze_code':
      console.log(`\n[Analyzing code: ${toolInput.path}]`);
      return await analyzeCode(toolInput.path, options.projectDir);

    // Git operations
    case 'git_status':
      console.log(`\n[Getting git status]`);
      return await getGitStatus(options.projectDir);

    case 'git_commits':
      console.log(`\n[Getting git commits]`);
      return await getGitCommits(options.projectDir, toolInput.count);

    case 'git_commit':
      console.log(`\n[Creating git commit: ${toolInput.message}]`);
      return await createGitCommit(options.projectDir, toolInput.message, toolInput.files);

    case 'git_diff':
      console.log(`\n[Getting git diff${toolInput.file ? ` for ${toolInput.file}` : ''}]`);
      return await getGitDiff(options.projectDir, toolInput.file);

    case 'git_checkout':
      console.log(`\n[Git checkout: ${toolInput.target}${toolInput.create_branch ? ' (new branch)' : ''}]`);
      return await gitCheckout(options.projectDir, toolInput.target, toolInput.create_branch);

    case 'git_pull':
      console.log(`\n[Git pull from ${toolInput.remote}${toolInput.branch ? `/${toolInput.branch}` : ''}]`);
      return await gitPull(options.projectDir, toolInput.remote, toolInput.branch);

    case 'git_push':
      console.log(`\n[Git push to ${toolInput.remote}${toolInput.branch ? `/${toolInput.branch}` : ''}${toolInput.force ? ' (force)' : ''}]`);
      return await gitPush(options.projectDir, toolInput.remote, toolInput.branch, toolInput.force);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}