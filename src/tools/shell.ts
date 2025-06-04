import { execSync } from 'child_process';
import path from 'path';

const MAX_OUTPUT_LENGTH = 4000; // Limit output to avoid token overflows

/**
 * Execute a shell command and return the result
 * @param command The command to execute
 * @param projectDir The project directory to execute the command in
 * @param useSandbox Whether to use a sandbox environment
 * @returns Object containing stdout, stderr, and exit code
 */
export async function executeShellCommand(
  command: string,
  projectDir: string,
  useSandbox: boolean
): Promise<{
  stdout: string;
  stderr: string;
  exit_code: number;
}> {
  // Safety checks
  const disallowedCommands = [
    'rm -rf /',
    'rm -rf /*',
    '> /dev/sda',
    'mkfs',
    ':(){:|:&};:',
    'dd if=/dev/random'
  ];

  if (disallowedCommands.some(cmd => command.includes(cmd))) {
    return {
      stdout: '',
      stderr: 'Command contains potentially dangerous operations',
      exit_code: 1
    };
  }

  // Convert Linux commands to Windows equivalents if needed
  let windowsCommand = command;
  const isWindows = process.platform === 'win32';
  
  if (isWindows && (command === 'ls -la' || command === 'ls -l' || command === 'ls')) {
    windowsCommand = 'dir /a';
    console.log(`Converting to Windows equivalent: ${windowsCommand}`);
  }

  try {
    // Execute command
    const output = execSync(windowsCommand, {
      cwd: projectDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5 // 5 MB buffer
    });
    
    // Truncate output if needed
    const truncatedOutput = output.length > MAX_OUTPUT_LENGTH 
      ? output.substring(0, MAX_OUTPUT_LENGTH) + `\n[Output truncated, ${output.length - MAX_OUTPUT_LENGTH} characters omitted]`
      : output;
    
    return {
      stdout: truncatedOutput,
      stderr: '',
      exit_code: 0
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message || 'Unknown error',
      exit_code: error.status || 1
    };
  }
}