import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions } from './tools/definitions';
import { executeShellCommand } from './tools/shell';
import { editFile } from './tools/file';
import readline from 'readline';

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

type ToolResult = ShellResult | FileResult;

export async function startConversation(options: ConversationOptions) {
  console.log(`Starting conversation with ${options.provider} using model ${options.model}`);
  console.log(`Project directory: ${options.projectDir}`);
  
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
When users ask for information about files or the system, ALWAYS use the run_shell tool.
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
- When editing files, verify the changes carefully

Example 1: If user asks "What files are in this directory?", use run_shell tool with command "ls -la"
Example 2: If user asks "Create a new file", use edit_file tool with appropriate path and content

NEVER refuse to use tools when they would help complete the user's request.`
    }
  ];
  
  // Main conversation loop
  console.log('\nWelcome to LLM Terminal Agent. Type your request or "exit" to quit.');
  
  let conversationActive = true;
  while (conversationActive) {
    const userInput = await askQuestion(rl, '\nYou: ');
    
    if (userInput.toLowerCase() === 'exit') {
      conversationActive = false;
      continue;
    }
    
    // Add user message
    messages.push({ role: 'user', content: userInput });
    
    try {
      await processChatTurn(client, messages, options);
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

async function processChatTurn(client: any, messages: Message[], options: ConversationOptions) {
  let waitingForToolResult = true;
  
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
          waitingForToolResult = false;
        } else if (lastMessage.type === 'tool_use') {
          // First, output the assistant's explanation if there is one
          const textMessages = response.content.filter((msg: any) => msg.type === 'text');
          if (textMessages.length > 0) {
            console.log(`\nAssistant: ${textMessages[0].text}`);
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
            
            // Stop waiting for tool result
            waitingForToolResult = false;
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
      waitingForToolResult = false;
    }
  }
}

async function executeToolCall(
  toolName: string,
  toolInput: any,
  options: ConversationOptions
): Promise<ToolResult> {
  switch (toolName) {
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