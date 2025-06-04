import fs from 'fs';
import path from 'path';
import os from 'os';

// Define bookmark interfaces
export interface Bookmark {
  name: string;
  path: string;
  description?: string;
  lastAccessed?: number;
}

export interface BookmarkCollection {
  version: string;
  bookmarks: Bookmark[];
}

const BOOKMARKS_FILE = path.join(os.homedir(), '.llmterminal_bookmarks.json');
const DEFAULT_COLLECTION: BookmarkCollection = {
  version: '1.0',
  bookmarks: []
};

/**
 * Load bookmarks from disk
 */
export function loadBookmarks(): BookmarkCollection {
  try {
    if (!fs.existsSync(BOOKMARKS_FILE)) {
      return DEFAULT_COLLECTION;
    }
    
    const data = fs.readFileSync(BOOKMARKS_FILE, 'utf8');
    return JSON.parse(data) as BookmarkCollection;
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    return DEFAULT_COLLECTION;
  }
}

/**
 * Save bookmarks to disk
 */
export function saveBookmarks(collection: BookmarkCollection): boolean {
  try {
    fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(collection, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving bookmarks:', error);
    return false;
  }
}

/**
 * Add a new bookmark
 */
export function addBookmark(name: string, dirPath: string, description?: string): Bookmark | null {
  try {
    // Ensure directory exists
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return null;
    }
    
    const collection = loadBookmarks();
    
    // Check if bookmark with same name exists
    const existingIndex = collection.bookmarks.findIndex(b => b.name === name);
    
    const bookmark: Bookmark = {
      name,
      path: path.resolve(dirPath),
      description,
      lastAccessed: Date.now()
    };
    
    if (existingIndex >= 0) {
      // Update existing bookmark
      collection.bookmarks[existingIndex] = bookmark;
    } else {
      // Add new bookmark
      collection.bookmarks.push(bookmark);
    }
    
    saveBookmarks(collection);
    return bookmark;
  } catch (error) {
    console.error('Error adding bookmark:', error);
    return null;
  }
}

/**
 * Remove a bookmark by name
 */
export function removeBookmark(name: string): boolean {
  try {
    const collection = loadBookmarks();
    const initialLength = collection.bookmarks.length;
    
    collection.bookmarks = collection.bookmarks.filter(b => b.name !== name);
    
    if (collection.bookmarks.length < initialLength) {
      saveBookmarks(collection);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return false;
  }
}

/**
 * Get a bookmark by name
 */
export function getBookmark(name: string): Bookmark | null {
  try {
    const collection = loadBookmarks();
    const bookmark = collection.bookmarks.find(b => b.name === name);
    
    if (bookmark) {
      // Update last accessed time
      bookmark.lastAccessed = Date.now();
      saveBookmarks(collection);
      return bookmark;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting bookmark:', error);
    return null;
  }
}

/**
 * List all bookmarks
 */
export function listBookmarks(): Bookmark[] {
  try {
    const collection = loadBookmarks();
    return collection.bookmarks;
  } catch (error) {
    console.error('Error listing bookmarks:', error);
    return [];
  }
}