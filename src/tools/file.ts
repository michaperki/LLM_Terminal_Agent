import fs from 'fs/promises';
import path from 'path';
import { diffLines, applyPatch, createPatch } from 'diff';

/**
 * Edit a file by overwriting or patching it
 * @param filePath Path to the file (relative to project directory)
 * @param content New content or patch to apply
 * @param projectDir Project directory
 * @param editType Type of edit (overwrite or patch)
 * @param originalContent Original content (only needed for patch mode)
 * @returns Object containing the status and details of the operation
 */
export async function editFile(
  filePath: string,
  content: string,
  projectDir: string,
  editType: 'overwrite' | 'patch' = 'overwrite',
  originalContent?: string
): Promise<{
  success: boolean;
  message: string;
  path: string;
  edit_type: string;
}> {
  // Ensure the file path is within the project directory
  const absolutePath = path.resolve(projectDir, filePath);
  
  if (!absolutePath.startsWith(projectDir)) {
    throw new Error('File path must be within the project directory');
  }
  
  try {
    // Create directories if they don't exist
    const dirPath = path.dirname(absolutePath);
    await fs.mkdir(dirPath, { recursive: true });
    
    if (editType === 'overwrite') {
      // Simple overwrite
      await fs.writeFile(absolutePath, content, 'utf8');
      return {
        success: true,
        message: `File ${filePath} has been created/updated`,
        path: filePath,
        edit_type: 'overwrite'
      };
    } else if (editType === 'patch') {
      // Apply patch
      if (!originalContent) {
        // Try to read the existing file content
        try {
          originalContent = await fs.readFile(absolutePath, 'utf8');
        } catch (error) {
          throw new Error('Original content is required for patch mode when file does not exist');
        }
      }
      
      // Apply the patch
      const patchResult = applyPatch(originalContent, content);
      
      if (typeof patchResult === 'boolean') {
        throw new Error('Failed to apply patch');
      }
      
      await fs.writeFile(absolutePath, patchResult, 'utf8');
      
      return {
        success: true,
        message: `File ${filePath} has been patched`,
        path: filePath,
        edit_type: 'patch'
      };
    } else {
      throw new Error(`Unsupported edit type: ${editType}`);
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Error editing file: ${error.message}`,
      path: filePath,
      edit_type: editType
    };
  }
}

/**
 * Generate a unified diff between two texts
 * @param originalText The original text
 * @param newText The new text
 * @param fileName The name of the file for the diff header
 * @returns Unified diff string
 */
export function generateDiff(originalText: string, newText: string, fileName: string): string {
  return createPatch(fileName, originalText, newText);
}