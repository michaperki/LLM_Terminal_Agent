import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import os from 'os';

/**
 * Project configuration interface
 */
export interface ProjectConfig {
  // Model settings
  model: string;
  temperature: number;
  maxTokens: number;
  
  // Tool settings
  enabledTools: string[];
  disabledTools: string[];
  
  // Display settings
  showFileTree: boolean;
  maxFileTreeDepth: number;
  excludePatterns: string[];
  
  // History settings
  maxHistoryEntries: number;
  
  // Custom commands
  customCommands?: {
    [name: string]: {
      description: string;
      command: string;
    };
  };
}

/**
 * Global configuration interface
 */
export interface GlobalConfig {
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultDirectory: string;
  apiKeys: {
    anthropic?: string;
    openai?: string;
  };
  
  // Directory for project-specific configs
  projectConfigsDir: string;
  
  // Projects with specific configurations
  projectConfigs: {
    [directory: string]: string | ProjectConfig;
  };
}

/**
 * Default project configuration
 */
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  model: 'claude-3-5-sonnet-20240620',
  temperature: 0.7,
  maxTokens: 4000,
  
  enabledTools: [],
  disabledTools: [],
  
  showFileTree: true,
  maxFileTreeDepth: 3,
  excludePatterns: ['node_modules', '.git', 'dist', 'build', '.DS_Store'],
  
  maxHistoryEntries: 100
};

/**
 * Default global configuration
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  defaultModel: 'claude-3-5-sonnet-20240620',
  defaultTemperature: 0.7,
  defaultMaxTokens: 4000,
  defaultDirectory: process.cwd(),
  apiKeys: {},
  
  projectConfigsDir: path.join(os.homedir(), '.llmterminal', 'projects'),
  projectConfigs: {}
};

// Global configuration file path
const GLOBAL_CONFIG_FILE = path.join(os.homedir(), '.llmterminalrc');

// Project configuration file name
const PROJECT_CONFIG_FILE = '.llmterminal.json';

/**
 * Load global configuration
 */
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  try {
    // Check if the file exists
    if (!fsSync.existsSync(GLOBAL_CONFIG_FILE)) {
      return DEFAULT_GLOBAL_CONFIG;
    }
    
    // Read and parse the file
    const data = await fs.readFile(GLOBAL_CONFIG_FILE, 'utf8');
    const config = JSON.parse(data) as Partial<GlobalConfig>;
    
    // Merge with defaults
    return {
      ...DEFAULT_GLOBAL_CONFIG,
      ...config,
      // Make sure nested objects are properly merged
      apiKeys: {
        ...DEFAULT_GLOBAL_CONFIG.apiKeys,
        ...config.apiKeys
      }
    };
  } catch (error) {
    console.error('Error loading global config:', error);
    return DEFAULT_GLOBAL_CONFIG;
  }
}

/**
 * Save global configuration
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<boolean> {
  try {
    await fs.writeFile(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving global config:', error);
    return false;
  }
}

/**
 * Get project configuration for a specific directory
 */
export async function getProjectConfig(projectDir: string): Promise<ProjectConfig> {
  try {
    // First check if there's a project-specific config file in the directory
    const localConfigPath = path.join(projectDir, PROJECT_CONFIG_FILE);
    
    if (fsSync.existsSync(localConfigPath)) {
      const data = await fs.readFile(localConfigPath, 'utf8');
      const config = JSON.parse(data) as Partial<ProjectConfig>;
      
      return {
        ...DEFAULT_PROJECT_CONFIG,
        ...config
      };
    }
    
    // If not, check if we have a stored config for this directory
    const globalConfig = await loadGlobalConfig();
    const normalizedDir = path.normalize(projectDir);
    
    if (globalConfig.projectConfigs[normalizedDir]) {
      // If it's a string, it's a path to a config file
      if (typeof globalConfig.projectConfigs[normalizedDir] === 'string') {
        const configPath = globalConfig.projectConfigs[normalizedDir] as string;
        
        if (fsSync.existsSync(configPath)) {
          const data = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(data) as Partial<ProjectConfig>;
          
          return {
            ...DEFAULT_PROJECT_CONFIG,
            ...config
          };
        }
      } else {
        // If it's an object, it's the config itself
        const config = globalConfig.projectConfigs[normalizedDir] as Partial<ProjectConfig>;
        
        return {
          ...DEFAULT_PROJECT_CONFIG,
          ...config
        };
      }
    }
    
    // If we don't have a config for this directory, return the default
    return DEFAULT_PROJECT_CONFIG;
  } catch (error) {
    console.error('Error loading project config:', error);
    return DEFAULT_PROJECT_CONFIG;
  }
}

/**
 * Save project configuration
 */
export async function saveProjectConfig(
  projectDir: string, 
  config: ProjectConfig, 
  saveLocation: 'local' | 'global' = 'local'
): Promise<boolean> {
  try {
    if (saveLocation === 'local') {
      // Save to project directory
      const configPath = path.join(projectDir, PROJECT_CONFIG_FILE);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } else {
      // Save to global config
      const globalConfig = await loadGlobalConfig();
      const normalizedDir = path.normalize(projectDir);
      
      // Create the project configs directory if it doesn't exist
      if (!fsSync.existsSync(globalConfig.projectConfigsDir)) {
        await fs.mkdir(globalConfig.projectConfigsDir, { recursive: true });
      }
      
      // Save the config file in the projects directory
      const configFileName = path.basename(normalizedDir) + '.json';
      const configPath = path.join(globalConfig.projectConfigsDir, configFileName);
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
      // Update the global config to point to this file
      globalConfig.projectConfigs[normalizedDir] = configPath;
      await saveGlobalConfig(globalConfig);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving project config:', error);
    return false;
  }
}

/**
 * Get custom commands for a project
 */
export async function getCustomCommands(projectDir: string): Promise<Record<string, { description: string; command: string }>> {
  try {
    const config = await getProjectConfig(projectDir);
    return config.customCommands || {};
  } catch (error) {
    console.error('Error getting custom commands:', error);
    return {};
  }
}

/**
 * Add a custom command to a project
 */
export async function addCustomCommand(
  projectDir: string,
  name: string,
  description: string,
  command: string
): Promise<boolean> {
  try {
    const config = await getProjectConfig(projectDir);
    
    if (!config.customCommands) {
      config.customCommands = {};
    }
    
    config.customCommands[name] = {
      description,
      command
    };
    
    return await saveProjectConfig(projectDir, config);
  } catch (error) {
    console.error('Error adding custom command:', error);
    return false;
  }
}

/**
 * Remove a custom command from a project
 */
export async function removeCustomCommand(
  projectDir: string,
  name: string
): Promise<boolean> {
  try {
    const config = await getProjectConfig(projectDir);

    if (config.customCommands && config.customCommands[name]) {
      delete config.customCommands[name];
      return await saveProjectConfig(projectDir, config);
    }

    return false;
  } catch (error) {
    console.error('Error removing custom command:', error);
    return false;
  }
}