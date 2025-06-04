#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { startConversation } from './conversation';

// Load environment variables
dotenv.config();

// Load config from .llmterminalrc file if it exists
const loadConfig = () => {
  const configPath = path.join(os.homedir(), '.llmterminalrc');
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch {
    return {};
  }
};

const config = loadConfig();
const defaultDir = config.defaultDirectory || process.cwd();

// Define CLI options
program
  .name('llm-terminal')
  .description('Terminal-based LLM agent with shell execution capabilities')
  .version('0.1.0')
  .option('-m, --model <model>', 'LLM model to use', 'claude-3-5-sonnet-20240620')
  .option('-p, --provider <provider>', 'API provider to use (anthropic, openai)', 'anthropic')
  .option('--sandbox', 'Run commands in a sandbox environment')
  .option('--max-tokens <number>', 'Maximum tokens for LLM response', '4000')
  .option('--temperature <number>', 'Temperature for LLM response', '0.7')
  .option('-d, --directory <path>', 'Target project directory to work with', defaultDir)
  .option('--debug', 'Enable debug logging')
  .parse(process.argv);

const options = program.opts();

// Validate the specified directory
const validateDirectory = (dirPath: string) => {
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      console.error(`Error: ${dirPath} is not a directory`);
      process.exit(1);
    }
    return path.resolve(dirPath); // Return absolute path
  } catch (error) {
    console.error(`Error: Cannot access directory ${dirPath}`);
    process.exit(1);
  }
};

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

// Validate and resolve the target directory
const targetDir = validateDirectory(options.directory);

// Check if the directory is allowed
if (!isPathAllowed(targetDir)) {
  console.error(`Error: Access to directory ${targetDir} is restricted for security reasons`);
  process.exit(1);
}

// Save the last used directory for future sessions
const saveLastDirectory = (dir: string) => {
  const historyPath = path.join(os.homedir(), '.llmterminal_history');
  try {
    fs.writeFileSync(historyPath, JSON.stringify({ lastDir: dir }));
  } catch {
    // Ignore errors in saving history
  }
};

// Setup exit handler to save the last directory
process.on('exit', () => {
  saveLastDirectory(options.directory);
});

// Validate required environment variables
const validateEnv = () => {
  const provider = options.provider.toLowerCase();
  
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required when using Anthropic provider');
    process.exit(1);
  }
  
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required when using OpenAI provider');
    process.exit(1);
  }
};

validateEnv();

// Start the conversation
startConversation({
  model: options.model,
  provider: options.provider,
  useSandbox: options.sandbox || false,
  maxTokens: parseInt(options.maxTokens),
  temperature: parseFloat(options.temperature),
  projectDir: path.resolve(options.directory),
  debug: options.debug || false
});