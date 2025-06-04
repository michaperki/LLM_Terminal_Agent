// Tool definitions for the LLM API

export const toolDefinitions = [
  {
    type: 'custom',
    name: 'run_shell',
    description: 'Execute a shell command in the project directory and capture stdout/stderr/exit_code',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute'
        }
      },
      required: ['command']
    }
  },
  {
    type: 'custom',
    name: 'edit_file',
    description: 'Create or modify a file in the project directory',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file (relative to the project directory)'
        },
        content: {
          type: 'string',
          description: 'The new content for the file'
        },
        edit_type: {
          type: 'string',
          enum: ['overwrite', 'patch'],
          description: 'Whether to overwrite the file or apply a patch',
          default: 'overwrite'
        },
        original_content: {
          type: 'string',
          description: 'The original content to replace (only used for patch mode)'
        }
      },
      required: ['path', 'content']
    }
  }
];