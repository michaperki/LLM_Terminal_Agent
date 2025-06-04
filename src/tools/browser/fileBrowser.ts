import fs from 'fs/promises';
import path from 'path';

/**
 * File information with stats
 */
interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension: string;
}

/**
 * Result of the file browser operation
 */
interface FileBrowserResult {
  currentPath: string;
  items: FileInfo[];
  error?: string;
}

/**
 * Browses files in a directory with optional filtering
 * @param directoryPath Path to browse (relative to project directory)
 * @param projectDir Project root directory
 * @param options Filtering options
 * @returns List of files and directories
 */
export async function browseFiles(
  directoryPath: string,
  projectDir: string,
  options: {
    showHidden?: boolean;
    filter?: string;
    sort?: 'name' | 'modified' | 'size';
    sortDirection?: 'asc' | 'desc';
  } = {}
): Promise<FileBrowserResult> {
  try {
    // Default options
    const opts = {
      showHidden: options.showHidden || false,
      filter: options.filter || '',
      sort: options.sort || 'name',
      sortDirection: options.sortDirection || 'asc'
    };

    // Resolve full path
    const fullPath = path.resolve(projectDir, directoryPath || '');
    
    // Ensure the path is within the project directory (security check)
    if (!fullPath.startsWith(projectDir)) {
      return {
        currentPath: directoryPath,
        items: [],
        error: 'Access denied: Cannot browse outside the project directory'
      };
    }

    // Read directory contents
    const items = await fs.readdir(fullPath);
    const fileInfoPromises = items
      .filter(item => opts.showHidden || !item.startsWith('.'))
      .filter(item => !opts.filter || item.includes(opts.filter))
      .map(async (item): Promise<FileInfo> => {
        const itemPath = path.join(fullPath, item);
        const relativePath = path.relative(projectDir, itemPath);
        const stats = await fs.stat(itemPath);
        
        return {
          name: item,
          path: relativePath,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          extension: path.extname(item).slice(1)
        };
      });

    // Resolve all file info promises
    let fileInfos = await Promise.all(fileInfoPromises);
    
    // Sort the results
    fileInfos.sort((a, b) => {
      // Directories first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      
      // Then by the specified sort field
      let comparison = 0;
      switch (opts.sort) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'modified':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
      }
      
      // Apply sort direction
      return opts.sortDirection === 'asc' ? comparison : -comparison;
    });

    return {
      currentPath: directoryPath,
      items: fileInfos
    };
  } catch (error: any) {
    return {
      currentPath: directoryPath,
      items: [],
      error: error.message || 'Failed to browse files'
    };
  }
}

/**
 * Gets details about a specific file
 * @param filePath Path to the file (relative to project directory)
 * @param projectDir Project root directory
 * @returns File details
 */
export async function getFileDetails(
  filePath: string,
  projectDir: string
): Promise<{
  file: FileInfo | null;
  content?: string;
  error?: string;
}> {
  try {
    // Resolve full path
    const fullPath = path.resolve(projectDir, filePath);
    
    // Ensure the path is within the project directory (security check)
    if (!fullPath.startsWith(projectDir)) {
      return {
        file: null,
        error: 'Access denied: Cannot access files outside the project directory'
      };
    }

    // Get file stats
    const stats = await fs.stat(fullPath);
    
    // Create file info
    const file: FileInfo = {
      name: path.basename(filePath),
      path: filePath,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
      extension: path.extname(filePath).slice(1)
    };

    // If it's a file, read its content
    let content: string | undefined;
    if (file.type === 'file') {
      // Skip reading content for binary files or very large files
      const isBinary = [
        'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp',
        'mp3', 'mp4', 'wav', 'avi', 'mov', 'webm',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll'
      ].includes(file.extension);
      
      const isTooLarge = stats.size > 1024 * 1024; // 1MB
      
      if (!isBinary && !isTooLarge) {
        content = await fs.readFile(fullPath, 'utf8');
      }
    }

    return { file, content };
  } catch (error: any) {
    return {
      file: null,
      error: error.message || 'Failed to get file details'
    };
  }
}