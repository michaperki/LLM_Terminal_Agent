// Tool definitions for the LLM API

export const toolDefinitions = [
  {
    type: 'custom',
    name: 'change_directory',
    description: 'Change the current working directory for the session',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to change to (absolute or relative to current directory)'
        }
      },
      required: ['path']
    }
  },
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
  },
  {
    type: 'custom',
    name: 'browse_files',
    description: 'Browse files in a directory with optional filtering and sorting',
    input_schema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'The directory to browse (relative to the project directory)'
        },
        show_hidden: {
          type: 'boolean',
          description: 'Whether to show hidden files',
          default: false
        },
        filter: {
          type: 'string',
          description: 'Filter files by name (case-sensitive)',
          default: ''
        },
        sort: {
          type: 'string',
          enum: ['name', 'modified', 'size'],
          description: 'Sort files by this property',
          default: 'name'
        },
        sort_direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction',
          default: 'asc'
        }
      },
      required: ['directory']
    }
  },
  {
    type: 'custom',
    name: 'file_details',
    description: 'Get details about a specific file, including its content if it is a text file',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file (relative to the project directory)'
        }
      },
      required: ['path']
    }
  },
  {
    type: 'custom',
    name: 'analyze_code',
    description: 'Analyze code in a file to extract information about its structure',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file (relative to the project directory)'
        }
      },
      required: ['path']
    }
  },
  {
    type: 'custom',
    name: 'git_status',
    description: 'Get the git status of the repository',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'custom',
    name: 'git_commits',
    description: 'Get recent git commits',
    input_schema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of commits to retrieve',
          default: 5
        }
      }
    }
  },
  {
    type: 'custom',
    name: 'git_commit',
    description: 'Create a git commit',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message'
        },
        files: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Files to include (empty to include all staged files)'
        }
      },
      required: ['message']
    }
  },
  {
    type: 'custom',
    name: 'git_diff',
    description: 'Get the diff for a file or the entire repository',
    input_schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'File to get diff for (empty for entire repo)'
        }
      }
    }
  },
  {
    type: 'custom',
    name: 'git_checkout',
    description: 'Perform a git checkout',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Branch or commit to checkout'
        },
        create_branch: {
          type: 'boolean',
          description: 'Whether to create a new branch',
          default: false
        }
      },
      required: ['target']
    }
  },
  {
    type: 'custom',
    name: 'git_pull',
    description: 'Perform a git pull',
    input_schema: {
      type: 'object',
      properties: {
        remote: {
          type: 'string',
          description: 'Remote name',
          default: 'origin'
        },
        branch: {
          type: 'string',
          description: 'Branch name (empty to use tracking branch)'
        }
      }
    }
  },
  {
    type: 'custom',
    name: 'git_push',
    description: 'Perform a git push',
    input_schema: {
      type: 'object',
      properties: {
        remote: {
          type: 'string',
          description: 'Remote name',
          default: 'origin'
        },
        branch: {
          type: 'string',
          description: 'Branch name (empty to use tracking branch)'
        },
        force: {
          type: 'boolean',
          description: 'Whether to force push',
          default: false
        }
      }
    }
  }
];