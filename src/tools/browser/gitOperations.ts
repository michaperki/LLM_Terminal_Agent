import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

/**
 * Git status information
 */
interface GitStatus {
  isRepo: boolean;
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

/**
 * Git commit information
 */
interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

/**
 * Result of a git operation
 */
interface GitOperationResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Checks if the directory is a git repository
 * @param projectDir Project directory
 * @returns True if it's a git repository
 */
async function isGitRepo(projectDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectDir, '.git'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a git command safely
 * @param command Git command to run
 * @param projectDir Project directory
 * @returns Command output
 */
function runGitCommand(command: string, projectDir: string): string {
  try {
    return execSync(`git ${command}`, {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error: any) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

/**
 * Gets the git status of the repository
 * @param projectDir Project directory
 * @returns Git status information
 */
export async function getGitStatus(projectDir: string): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Get current branch
    const branch = runGitCommand('rev-parse --abbrev-ref HEAD', projectDir).trim();
    
    // Get status
    const statusOutput = runGitCommand('status --porcelain -b', projectDir);
    const lines = statusOutput.split('\n');
    
    // Parse branch line
    const branchLine = lines[0]; // First line is the branch line
    const aheadBehind = branchLine.match(/ahead (\d+)/) || ['', '0'];
    const behindMatch = branchLine.match(/behind (\d+)/) || ['', '0'];
    
    const ahead = parseInt(aheadBehind[1]);
    const behind = parseInt(behindMatch[1]);
    
    // Parse file status
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      if (status.includes('?')) {
        untracked.push(file);
      } else if (status[0] !== ' ') {
        staged.push(file);
      } else if (status[1] !== ' ') {
        unstaged.push(file);
      }
    }

    return {
      success: true,
      message: 'Git status retrieved successfully',
      data: {
        isRepo: true,
        branch,
        staged,
        unstaged,
        untracked,
        ahead,
        behind
      } as GitStatus
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to get git status'
    };
  }
}

/**
 * Gets recent git commits
 * @param projectDir Project directory
 * @param count Number of commits to retrieve
 * @returns Recent commits
 */
export async function getGitCommits(
  projectDir: string,
  count: number = 5
): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Get commits
    const logFormat = '--pretty=format:%H||%h||%an||%ad||%s';
    const logOutput = runGitCommand(`log -${count} ${logFormat}`, projectDir);
    const commits: GitCommit[] = logOutput.split('\n').map(line => {
      const [hash, shortHash, author, date, message] = line.split('||');
      return { hash, shortHash, author, date, message };
    });

    return {
      success: true,
      message: 'Git commits retrieved successfully',
      data: commits
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to get git commits'
    };
  }
}

/**
 * Creates a git commit
 * @param projectDir Project directory
 * @param message Commit message
 * @param files Files to include (leave empty to include all staged files)
 * @returns Result of the operation
 */
export async function createGitCommit(
  projectDir: string,
  message: string,
  files: string[] = []
): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Add files if specified
    if (files.length > 0) {
      const fileList = files.join(' ');
      runGitCommand(`add ${fileList}`, projectDir);
    }

    // Create commit
    const commitOutput = runGitCommand(`commit -m "${message}"`, projectDir);

    return {
      success: true,
      message: 'Git commit created successfully',
      data: commitOutput
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to create git commit'
    };
  }
}

/**
 * Gets the diff for a file or the entire repository
 * @param projectDir Project directory
 * @param file File to get diff for (leave empty for entire repo)
 * @returns Diff output
 */
export async function getGitDiff(
  projectDir: string,
  file?: string
): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Get diff
    const diffCommand = file ? `diff -- "${file}"` : 'diff';
    const diffOutput = runGitCommand(diffCommand, projectDir);

    return {
      success: true,
      message: 'Git diff retrieved successfully',
      data: diffOutput || 'No changes'
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to get git diff'
    };
  }
}

/**
 * Performs a git checkout
 * @param projectDir Project directory
 * @param target Branch or commit to checkout
 * @param createBranch Whether to create a new branch
 * @returns Result of the operation
 */
export async function gitCheckout(
  projectDir: string,
  target: string,
  createBranch: boolean = false
): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Perform checkout
    const checkoutCommand = createBranch ? `checkout -b "${target}"` : `checkout "${target}"`;
    const checkoutOutput = runGitCommand(checkoutCommand, projectDir);

    return {
      success: true,
      message: `Git checkout to ${target} ${createBranch ? '(new branch)' : ''} completed successfully`,
      data: checkoutOutput
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to perform git checkout'
    };
  }
}

/**
 * Performs a git pull
 * @param projectDir Project directory
 * @param remote Remote name
 * @param branch Branch name
 * @returns Result of the operation
 */
export async function gitPull(
  projectDir: string,
  remote: string = 'origin',
  branch?: string
): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Perform pull
    const pullCommand = branch ? `pull ${remote} ${branch}` : `pull ${remote}`;
    const pullOutput = runGitCommand(pullCommand, projectDir);

    return {
      success: true,
      message: 'Git pull completed successfully',
      data: pullOutput
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to perform git pull'
    };
  }
}

/**
 * Performs a git push
 * @param projectDir Project directory
 * @param remote Remote name
 * @param branch Branch name
 * @param force Whether to force push
 * @returns Result of the operation
 */
export async function gitPush(
  projectDir: string,
  remote: string = 'origin',
  branch?: string,
  force: boolean = false
): Promise<GitOperationResult> {
  try {
    if (!await isGitRepo(projectDir)) {
      return {
        success: false,
        message: 'Not a git repository'
      };
    }

    // Perform push
    const forceFlag = force ? ' -f' : '';
    const pushCommand = branch 
      ? `push${forceFlag} ${remote} ${branch}` 
      : `push${forceFlag} ${remote}`;
    
    const pushOutput = runGitCommand(pushCommand, projectDir);

    return {
      success: true,
      message: 'Git push completed successfully',
      data: pushOutput
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to perform git push'
    };
  }
}