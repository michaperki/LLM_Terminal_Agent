# LLM Terminal Agent

A simple implementation of a terminal-based LLM agent that can execute shell commands and edit files, similar to Claude Code.

## Architecture

| Layer                  | What it does                                                                | Key tech                       |
|------------------------|-----------------------------------------------------------------------------|--------------------------------|
| CLI wrapper            | Parses natural-language requests and forwards to LLM API with tool manifest | Node.js + TypeScript           |
| Tool manifest          | Declares tools like `bash` and `edit_file`                                  | JSON schema for tool definition|
| Model decision loop    | LLM decides whether to call a tool and returns command as JSON              | Claude/GPT API                 |
| Local executor         | Executes commands locally and streams results back to model                 | Subprocess handling            |
| Protocol glue          | Implements Model Context Protocol for message exchange                      | JSON-RPC style messaging       |

## Getting Started

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

3. Run the agent
   ```
   npm start
   ```

## Security Considerations

- Commands run in the user's environment by default
- Consider implementing sandbox isolation for production use
- Use caution when allowing file write operations