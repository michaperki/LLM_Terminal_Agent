import path from 'path';
import fs from 'fs/promises';

/**
 * Code analysis result
 */
interface CodeAnalysisResult {
  language: string;
  lineCount: number;
  charCount: number;
  syntaxValid: boolean;
  imports: string[];
  functions: string[];
  classes: string[];
  error?: string;
}

/**
 * Simple language detection based on file extension
 */
function detectLanguage(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase().slice(1);
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sh': 'bash',
    'bash': 'bash'
  };
  
  return languageMap[extension] || 'plaintext';
}

/**
 * Extract imports from code
 */
function extractImports(code: string, language: string): string[] {
  const imports: string[] = [];
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Match ES6 imports and requires
        const jsImportRegex = /import\s+.*?from\s+['"](.+?)['"];?/g;
        const requireRegex = /(?:const|let|var)\s+.*?=\s+require\(['"](.+?)['"]\);?/g;
        
        let match;
        while ((match = jsImportRegex.exec(code)) !== null) {
          imports.push(match[1]);
        }
        
        while ((match = requireRegex.exec(code)) !== null) {
          imports.push(match[1]);
        }
        break;
        
      case 'python':
        // Match Python imports
        const pyImportRegex = /(?:import|from)\s+([a-zA-Z0-9_.]+)/g;
        while ((match = pyImportRegex.exec(code)) !== null) {
          imports.push(match[1]);
        }
        break;
        
      case 'java':
        // Match Java imports
        const javaImportRegex = /import\s+([a-zA-Z0-9_.]+);/g;
        while ((match = javaImportRegex.exec(code)) !== null) {
          imports.push(match[1]);
        }
        break;
        
      // Add more languages as needed
    }
  } catch (error) {
    // Silently fail on regex errors
  }
  
  return imports;
}

/**
 * Extract functions from code
 */
function extractFunctions(code: string, language: string): string[] {
  const functions: string[] = [];
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Match function declarations, arrow functions, and methods
        const functionRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|([a-zA-Z0-9_$]+)\s*(?:=\s*)?(?:async\s*)?\([^)]*\)\s*{)/g;
        
        let match;
        while ((match = functionRegex.exec(code)) !== null) {
          const funcName = match[1] || match[2] || match[3];
          if (funcName) functions.push(funcName);
        }
        break;
        
      case 'python':
        // Match Python function definitions
        const pyFunctionRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/g;
        while ((match = pyFunctionRegex.exec(code)) !== null) {
          functions.push(match[1]);
        }
        break;
        
      case 'java':
        // Match Java method definitions (simplified)
        const javaMethodRegex = /(?:public|private|protected)?\s+(?:static\s+)?(?:[a-zA-Z0-9_<>]+)\s+([a-zA-Z0-9_]+)\s*\(/g;
        while ((match = javaMethodRegex.exec(code)) !== null) {
          functions.push(match[1]);
        }
        break;
        
      // Add more languages as needed
    }
  } catch (error) {
    // Silently fail on regex errors
  }
  
  return functions;
}

/**
 * Extract classes from code
 */
function extractClasses(code: string, language: string): string[] {
  const classes: string[] = [];
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Match class declarations
        const classRegex = /class\s+([a-zA-Z0-9_$]+)/g;
        
        let match;
        while ((match = classRegex.exec(code)) !== null) {
          classes.push(match[1]);
        }
        break;
        
      case 'python':
        // Match Python class definitions
        const pyClassRegex = /class\s+([a-zA-Z0-9_]+)/g;
        while ((match = pyClassRegex.exec(code)) !== null) {
          classes.push(match[1]);
        }
        break;
        
      case 'java':
        // Match Java class and interface definitions
        const javaClassRegex = /(?:public|private|protected)?\s+(?:abstract\s+)?(?:class|interface|enum)\s+([a-zA-Z0-9_]+)/g;
        while ((match = javaClassRegex.exec(code)) !== null) {
          classes.push(match[1]);
        }
        break;
        
      // Add more languages as needed
    }
  } catch (error) {
    // Silently fail on regex errors
  }
  
  return classes;
}

/**
 * Check if the code's syntax is likely valid
 * This is a very basic check and not a real parser
 */
function checkSyntax(code: string, language: string): boolean {
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Check for balanced braces, brackets, and parentheses
        return checkBalancedDelimiters(code, '{', '}') &&
               checkBalancedDelimiters(code, '[', ']') &&
               checkBalancedDelimiters(code, '(', ')');
        
      case 'python':
        // For Python, check indentation consistency
        return checkPythonIndentation(code);
        
      default:
        // For other languages, just check balanced delimiters
        return checkBalancedDelimiters(code, '{', '}') &&
               checkBalancedDelimiters(code, '[', ']') &&
               checkBalancedDelimiters(code, '(', ')');
    }
  } catch (error) {
    return false;
  }
}

/**
 * Check if delimiters are balanced
 */
function checkBalancedDelimiters(code: string, openChar: string, closeChar: string): boolean {
  let count = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    
    // Handle strings to avoid counting delimiters inside strings
    if ((char === '"' || char === "'" || char === '`') && (i === 0 || code[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === openChar) count++;
      else if (char === closeChar) {
        count--;
        if (count < 0) return false; // More closing than opening
      }
    }
  }
  
  return count === 0; // All delimiters are balanced
}

/**
 * Check Python indentation consistency
 */
function checkPythonIndentation(code: string): boolean {
  const lines = code.split('\n');
  const indentStack: number[] = [0]; // Start with no indentation
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    
    // Calculate indentation level
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    
    const currentIndent = indentStack[indentStack.length - 1];
    
    if (indent > currentIndent) {
      // New indentation level
      indentStack.push(indent);
    } else if (indent < currentIndent) {
      // Dedent, check if it matches a previous level
      while (indentStack[indentStack.length - 1] > indent) {
        indentStack.pop();
      }
      
      // If we don't have a matching indentation level, syntax is invalid
      if (indentStack[indentStack.length - 1] !== indent) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Analyze code in a file
 * @param filePath Path to the file (relative to project directory)
 * @param projectDir Project root directory
 * @returns Code analysis result
 */
export async function analyzeCode(
  filePath: string,
  projectDir: string
): Promise<CodeAnalysisResult> {
  try {
    // Resolve full path
    const fullPath = path.resolve(projectDir, filePath);
    
    // Ensure the path is within the project directory (security check)
    if (!fullPath.startsWith(projectDir)) {
      return {
        language: 'unknown',
        lineCount: 0,
        charCount: 0,
        syntaxValid: false,
        imports: [],
        functions: [],
        classes: [],
        error: 'Access denied: Cannot access files outside the project directory'
      };
    }

    // Read file content
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Detect language
    const language = detectLanguage(filePath);
    
    // Analyze code
    const lineCount = content.split('\n').length;
    const charCount = content.length;
    const imports = extractImports(content, language);
    const functions = extractFunctions(content, language);
    const classes = extractClasses(content, language);
    const syntaxValid = checkSyntax(content, language);

    return {
      language,
      lineCount,
      charCount,
      syntaxValid,
      imports,
      functions,
      classes
    };
  } catch (error: any) {
    return {
      language: 'unknown',
      lineCount: 0,
      charCount: 0,
      syntaxValid: false,
      imports: [],
      functions: [],
      classes: [],
      error: error.message || 'Failed to analyze code'
    };
  }
}