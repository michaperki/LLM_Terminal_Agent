import fs from 'fs/promises';
import path from 'path';

/**
 * Directory change result
 */
interface DirectoryChangeResult {
  success: boolean;
  message: string;
  oldDirectory: string;
  newDirectory: string;
}

/**
 * Change the current working directory
 * @param newDir Path to the new directory (absolute or relative)
 * @param currentDir Current working directory
 * @returns Result of the directory change operation
 */
export async function changeDirectory(
  newDir: string,
  currentDir: string
): Promise<DirectoryChangeResult> {
  try {
    // Resolve the target directory path
    const targetDir = path.isAbsolute(newDir) 
      ? newDir 
      : path.resolve(currentDir, newDir);
    
    // Check if the directory exists
    try {
      const stats = await fs.stat(targetDir);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: `Path exists but is not a directory: ${targetDir}`,
          oldDirectory: currentDir,
          newDirectory: currentDir
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Directory not found: ${targetDir}`,
        oldDirectory: currentDir,
        newDirectory: currentDir
      };
    }
    
    // Check if the directory is allowed
    const isPathAllowed = (dirPath: string): boolean => {
      const restrictedPaths = [
        '/etc', '/var/lib', '/boot', '/usr/bin',
        'C:\\Windows', 'C:\\Program Files'
      ];
      
      const normalizedPath = path.normalize(dirPath);
      
      return !restrictedPaths.some(restricted => 
        normalizedPath === restricted || 
        normalizedPath.startsWith(`${restricted}${path.sep}`)
      );
    };
    
    if (!isPathAllowed(targetDir)) {
      return {
        success: false,
        message: `Access to directory is restricted for security reasons: ${targetDir}`,
        oldDirectory: currentDir,
        newDirectory: currentDir
      };
    }
    
    // Directory exists and is allowed, return success
    return {
      success: true,
      message: `Changed directory to: ${targetDir}`,
      oldDirectory: currentDir,
      newDirectory: targetDir
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error changing directory: ${error.message}`,
      oldDirectory: currentDir,
      newDirectory: currentDir
    };
  }
}

/**
 * Get information about the current working directory
 * @param currentDir Current working directory
 * @returns Information about the current directory
 */
export async function getCurrentDirectoryInfo(
  currentDir: string
): Promise<{
  path: string;
  name: string;
  parent: string;
  isGitRepo: boolean;
}> {
  try {
    // Get directory name and parent
    const name = path.basename(currentDir);
    const parent = path.dirname(currentDir);
    
    // Check if it's a git repository
    let isGitRepo = false;
    try {
      await fs.access(path.join(currentDir, '.git'));
      isGitRepo = true;
    } catch {
      // Not a git repository, ignore
    }
    
    return {
      path: currentDir,
      name,
      parent,
      isGitRepo
    };
  } catch (error) {
    return {
      path: currentDir,
      name: path.basename(currentDir),
      parent: path.dirname(currentDir),
      isGitRepo: false
    };
  }
}