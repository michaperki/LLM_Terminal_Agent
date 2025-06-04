#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { startConversation } from './conversation';

// Load environment variables
dotenv.config();

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
  .option('--project-dir <path>', 'Project directory', process.cwd())
  .option('--debug', 'Enable debug logging')
  .parse(process.argv);

const options = program.opts();

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
  projectDir: path.resolve(options.projectDir),
  debug: options.debug || false
});