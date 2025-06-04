import fs from 'fs/promises';
import path from 'path';

/**
 * File tree node structure
 */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  extension?: string;
  size?: number;
  modified?: string;
}

/**
 * File tree options
 */
export interface FileTreeOptions {
  maxDepth?: number;
  showHidden?: boolean;
  excludePatterns?: string[];
}

/**
 * Default excluded patterns
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.DS_Store',
  'dist',
  'build',
  'coverage'
];

/**
 * Get a file tree starting from the specified directory
 * @param startPath The directory to start from
 * @param basePath The base project directory
 * @param options Options for the file tree generation
 * @returns File tree structure
 */
export async function getFileTree(
  startPath: string,
  basePath: string,
  options: FileTreeOptions = {}
): Promise<FileTreeNode> {
  // If startPath is not specified, use basePath
  const dirPath = startPath ? path.resolve(basePath, startPath) : basePath;
  
  // Resolve file path
  const relativePath = path.relative(basePath, dirPath);
  const name = path.basename(dirPath);
  
  // Default options
  const maxDepth = options.maxDepth ?? 3;
  const showHidden = options.showHidden ?? false;
  const excludePatterns = options.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
  
  try {
    // Get stats for the path
    const stats = await fs.stat(dirPath);
    
    // Base node
    const node: FileTreeNode = {
      name: name || path.basename(basePath),
      path: relativePath || '.',
      type: stats.isDirectory() ? 'directory' : 'file',
      modified: stats.mtime.toISOString()
    };
    
    if (stats.isFile()) {
      // For files, add extra info
      node.extension = path.extname(dirPath).slice(1).toLowerCase();
      node.size = stats.size;
      return node;
    }
    
    // For directories, get children recursively (with depth limit)
    if (maxDepth > 0) {
      const children: FileTreeNode[] = [];
      const files = await fs.readdir(dirPath);
      
      // Process each file/directory
      for (const file of files) {
        // Skip hidden files if not showing them
        if (!showHidden && file.startsWith('.')) {
          continue;
        }
        
        // Skip excluded patterns
        if (excludePatterns.some(pattern => file === pattern)) {
          continue;
        }
        
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          // Skip non-regular files and directories
          if (!stats.isFile() && !stats.isDirectory()) {
            continue;
          }
          
          // Get child node recursively
          const childNode = await getFileTree(
            filePath,
            basePath,
            {
              maxDepth: maxDepth - 1,
              showHidden,
              excludePatterns
            }
          );
          
          children.push(childNode);
        } catch (err) {
          // Skip files we can't access
          continue;
        }
      }
      
      // Sort children: directories first, then files, both alphabetically
      children.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      
      node.children = children;
    }
    
    return node;
  } catch (error: any) {
    // Return an empty directory node on error
    return {
      name: name || path.basename(basePath),
      path: relativePath || '.',
      type: 'directory',
      children: []
    };
  }
}

/**
 * Get file tree for a specific path with filtering
 */
export async function getFilteredFileTree(
  dirPath: string,
  basePath: string,
  options: FileTreeOptions & {
    filter?: string;
    expandAllMatches?: boolean;
  } = {}
): Promise<FileTreeNode> {
  // Get the full tree first
  const tree = await getFileTree(dirPath, basePath, {
    maxDepth: options.maxDepth ?? 3,
    showHidden: options.showHidden ?? false,
    excludePatterns: options.excludePatterns
  });
  
  // If no filter, return the tree as is
  if (!options.filter) {
    return tree;
  }
  
  // Apply filter
  const filterLower = options.filter.toLowerCase();
  
  // Helper function to filter the tree
  const filterNode = (node: FileTreeNode): boolean => {
    // If node name matches filter, include it
    const nameMatches = node.name.toLowerCase().includes(filterLower);
    
    // If it's a file, check if it matches
    if (node.type === 'file') {
      return nameMatches;
    }
    
    // For directories, filter children recursively
    if (node.children) {
      node.children = node.children.filter(filterNode);
      return nameMatches || node.children.length > 0;
    }
    
    return nameMatches;
  };
  
  // Apply filtering
  filterNode(tree);
  
  return tree;
}