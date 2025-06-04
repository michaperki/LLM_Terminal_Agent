import fs from 'fs';
import path from 'path';
import os from 'os';

// Define history interfaces
export interface HistoryEntry {
  id: string;
  timestamp: number;
  userInput: string;
  assistantResponse?: string;
  directory?: string;
  tools?: {
    name: string;
    input: any;
    result: any;
  }[];
}

export interface CommandHistory {
  version: string;
  entries: HistoryEntry[];
  maxEntries: number;
}

const HISTORY_FILE = path.join(os.homedir(), '.llmterminal_history.json');
const DEFAULT_HISTORY: CommandHistory = {
  version: '1.0',
  entries: [],
  maxEntries: 100 // Default max entries
};

/**
 * Load command history from disk
 */
export function loadHistory(): CommandHistory {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return DEFAULT_HISTORY;
    }
    
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(data) as CommandHistory;
  } catch (error) {
    console.error('Error loading history:', error);
    return DEFAULT_HISTORY;
  }
}

/**
 * Save command history to disk
 */
export function saveHistory(history: CommandHistory): boolean {
  try {
    // Limit entries to maxEntries
    if (history.entries.length > history.maxEntries) {
      history.entries = history.entries.slice(-history.maxEntries);
    }
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving history:', error);
    return false;
  }
}

/**
 * Add an entry to command history
 */
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const history = loadHistory();
  
  const newEntry: HistoryEntry = {
    id: generateId(),
    timestamp: Date.now(),
    ...entry
  };
  
  history.entries.push(newEntry);
  saveHistory(history);
  
  return newEntry;
}

/**
 * Get command history entries with optional filtering
 */
export function getHistory(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  directory?: string;
}): HistoryEntry[] {
  const history = loadHistory();
  let entries = [...history.entries];
  
  // Apply filters
  if (options?.directory) {
    entries = entries.filter(entry => entry.directory === options.directory);
  }
  
  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    entries = entries.filter(entry => 
      entry.userInput.toLowerCase().includes(searchLower) ||
      (entry.assistantResponse && entry.assistantResponse.toLowerCase().includes(searchLower))
    );
  }
  
  // Sort by timestamp descending (newest first)
  entries = entries.sort((a, b) => b.timestamp - a.timestamp);
  
  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || entries.length;
  
  return entries.slice(offset, offset + limit);
}

/**
 * Clear all history or a specific entry
 */
export function clearHistory(entryId?: string): boolean {
  try {
    if (entryId) {
      // Clear specific entry
      const history = loadHistory();
      const initialLength = history.entries.length;
      
      history.entries = history.entries.filter(entry => entry.id !== entryId);
      
      if (history.entries.length < initialLength) {
        saveHistory(history);
        return true;
      }
      
      return false;
    } else {
      // Clear all history
      saveHistory({
        ...DEFAULT_HISTORY,
        version: loadHistory().version // Keep version
      });
      return true;
    }
  } catch (error) {
    console.error('Error clearing history:', error);
    return false;
  }
}

/**
 * Update the max number of history entries to keep
 */
export function setHistoryMaxEntries(maxEntries: number): boolean {
  try {
    if (maxEntries < 1) {
      return false;
    }
    
    const history = loadHistory();
    history.maxEntries = maxEntries;
    
    // Apply the new limit
    if (history.entries.length > maxEntries) {
      history.entries = history.entries.slice(-maxEntries);
    }
    
    saveHistory(history);
    return true;
  } catch (error) {
    console.error('Error updating history settings:', error);
    return false;
  }
}

/**
 * Generate a unique ID for history entries
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}