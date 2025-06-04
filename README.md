# LLM Terminal Agent

A powerful implementation of a terminal-based LLM agent that can execute shell commands, edit files, browse the file system, analyze code, and perform git operations, similar to Claude Code.

## Features

- **Command Execution**: Run any shell command and see the results
- **File Editing**: Create, modify, and manage files with ease
- **File System Navigation**: Browse directories, filter files, and get file details
- **Code Analysis**: Analyze code to extract functions, classes, and imports
- **Git Operations**: Perform git status, commit, diff, checkout, pull, and push
- **Interactive UI**: Available as both CLI and GUI applications
- **Advanced Conversation**: Natural language interface to all tools

## Architecture

| Layer                  | What it does                                                                | Key tech                       |
|------------------------|-----------------------------------------------------------------------------|--------------------------------|
| CLI wrapper            | Parses natural-language requests and forwards to LLM API with tool manifest | Node.js + TypeScript           |
| Tool manifest          | Declares tools like `bash`, `edit_file`, and more                           | JSON schema for tool definition|
| Model decision loop    | LLM decides whether to call a tool and returns command as JSON              | Claude/GPT API                 |
| Local executor         | Executes commands locally and streams results back to model                 | Subprocess handling            |
| Protocol glue          | Implements Model Context Protocol for message exchange                      | JSON-RPC style messaging       |
| Electron GUI (optional)| Provides a rich desktop interface for the agent                            | Electron + web technologies    |

## Getting Started

### CLI Version

1. Install dependencies
   ```
   npm install
   ```

2. Set up your API keys
   ```
   export ANTHROPIC_API_KEY=your_key_here
   # or
   export OPENAI_API_KEY=your_key_here
   ```

3. Run the CLI agent
   ```
   npm run dev:cli
   ```

### GUI Version

1. Install dependencies
   ```
   npm install
   ```

2. Set up your API keys in a `.env` file
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

3. Run the Electron app
   ```
   npm run dev
   ```

4. Build for distribution
   ```
   npm run package
   ```

## Available Tools

### Basic Tools
1. `run_shell` - Execute shell commands
2. `edit_file` - Create or edit files

### File Browser Tools
3. `browse_files` - Browse directories with filtering and sorting
4. `file_details` - Get detailed information about specific files
5. `analyze_code` - Extract information about code structure

### Git Operations
6. `git_status` - Check repository status
7. `git_commits` - View recent commits
8. `git_commit` - Create new commits
9. `git_diff` - View file or repository diffs
10. `git_checkout` - Switch branches or commits
11. `git_pull` - Pull changes from remote
12. `git_push` - Push changes to remote

## Security Considerations

- Commands run in the user's environment by default
- Consider implementing sandbox isolation for production use
- Use caution when allowing file write operations
- Git operations may require appropriate authentication