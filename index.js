#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const DEFAULT_SCAN_PATH = process.argv[2] || '/mnt/c/laragon/www';
const BACKUP_FOLDER_NAME = 'ai1wm-backups';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgRed: '\x1b[41m',
  bgMagenta: '\x1b[45m',
};

// Store found backup folders
let backupFolders = [];
let selectedIndex = 0;
let totalSaved = 0;

// View mode: 'folders' or 'files'
let viewMode = 'folders';
let selectedFolderIndex = 0;
let selectedFileIndex = 0;

// Progress indicator
let scanCount = 0;
let foundCount = 0;

function showProgress(currentPath) {
  scanCount++;
  const shortPath = currentPath.length > 60 ? '...' + currentPath.slice(-57) : currentPath;
  process.stdout.write(`\r${colors.dim}Scanned: ${colors.yellow}${scanCount}${colors.dim} dirs | Found: ${colors.green}${foundCount}${colors.dim} backups | ${shortPath.padEnd(60)}${colors.reset}`);
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format days ago
function formatDaysAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return '1d';
  return `${diff}d`;
}

// Get .wpress files info
function getWpressFiles(folderPath) {
  const files = [];
  try {
    const items = fs.readdirSync(folderPath);
    for (const item of items) {
      if (item.endsWith('.wpress')) {
        const filePath = path.join(folderPath, item);
        const stat = fs.statSync(filePath);
        files.push({
          name: item,
          path: filePath,
          size: stat.size,
          modified: stat.mtime,
          deleted: false,
        });
      }
    }
    // Sort by modified date, newest first
    files.sort((a, b) => b.modified - a.modified);
  } catch (e) {
    // Ignore errors
  }
  return files;
}

// Scan for ai1wm-backups folders
function scanForBackups(dir, results = [], depth = 0) {
  try {
    const items = fs.readdirSync(dir);
    
    if (depth <= 2) {
      showProgress(dir);
    }
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (item === BACKUP_FOLDER_NAME) {
            const wpressFiles = getWpressFiles(fullPath);
            if (wpressFiles.length > 0) {
              const totalSize = wpressFiles.reduce((sum, f) => sum + f.size, 0);
              const lastModified = new Date(Math.max(...wpressFiles.map(f => f.modified)));
              results.push({
                path: fullPath,
                parentSite: path.basename(path.dirname(path.dirname(path.dirname(fullPath)))),
                files: wpressFiles,
                totalSize,
                lastModified,
                deleted: false,
              });
              foundCount++;
              showProgress(fullPath);
            }
          } else if (item !== 'node_modules' && item !== '.git' && item !== 'vendor') {
            scanForBackups(fullPath, results, depth + 1);
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return results;
}

// Delete a single file
function deleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    return false;
  }
}

// Delete folder recursively
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

// Recalculate folder stats after file deletion
function recalculateFolderStats(folder) {
  const remainingFiles = folder.files.filter(f => !f.deleted);
  folder.totalSize = remainingFiles.reduce((sum, f) => sum + f.size, 0);
  if (remainingFiles.length > 0) {
    folder.lastModified = new Date(Math.max(...remainingFiles.map(f => f.modified)));
  }
  // Mark folder as deleted if no files remain
  if (remainingFiles.length === 0) {
    folder.deleted = true;
  }
}

// Clear screen and move cursor to top
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

// Draw the folder list view
function drawFolderView() {
  clearScreen();
  
  // Header
  console.log(`${colors.cyan}${colors.bright}`);
  console.log(`  ╦ ╦┌─┐┬─┐┌─┐┌─┐┌─┐  ╔═╗┬  ┌─┐┌─┐┌┐┌┌─┐┬─┐`);
  console.log(`  ║║║├─┘├┬┘├┤ └─┐└─┐  ║  │  ├┤ ├─┤│││├┤ ├┬┘`);
  console.log(`  ╚╩╝┴  ┴└─└─┘└─┘└─┘  ╚═╝┴─┘└─┘┴ ┴┘└┘└─┘┴└─`);
  console.log(`${colors.reset}`);
  
  const totalReleasable = backupFolders.filter(f => !f.deleted).reduce((sum, f) => sum + f.totalSize, 0);
  console.log(`  ${colors.dim}Releasable space: ${colors.yellow}${formatBytes(totalReleasable)}${colors.reset}`);
  console.log(`  ${colors.dim}Space saved: ${colors.green}${formatBytes(totalSaved)}${colors.reset}`);
  console.log();
  
  console.log(`${colors.bgBlue}${colors.white} ↑↓ Navigate | ENTER Open folder | SPACE Delete all | Q Quit ${colors.reset}`);
  console.log();
  
  // Header row
  console.log(`  ${colors.dim}${'PATH'.padEnd(55)} ${'FILES'.padStart(6)} ${'LAST_MOD'.padStart(10)} ${'SIZE'.padStart(10)}${colors.reset}`);
  console.log(`  ${colors.dim}${'─'.repeat(85)}${colors.reset}`);
  
  // List backup folders
  const visibleFolders = backupFolders.filter(f => !f.deleted);
  visibleFolders.forEach((folder, index) => {
    const isSelected = index === selectedIndex;
    const prefix = isSelected ? `${colors.bgBlue}${colors.white}>` : ' ';
    
    const shortPath = folder.path.replace(DEFAULT_SCAN_PATH, '~');
    const displayPath = shortPath.length > 53 ? '...' + shortPath.slice(-50) : shortPath;
    const fileCount = folder.files.filter(f => !f.deleted).length;
    
    console.log(`${prefix} ${colors.cyan}${displayPath.padEnd(55)}${colors.reset} ${colors.yellow}${String(fileCount).padStart(6)}${colors.reset} ${colors.dim}${formatDaysAgo(folder.lastModified).padStart(10)}${colors.reset} ${colors.magenta}${formatBytes(folder.totalSize).padStart(10)}${colors.reset}${isSelected ? colors.reset : ''}`);
  });
  
  if (visibleFolders.length === 0) {
    console.log(`\n  ${colors.yellow}No ai1wm-backups folders with .wpress files found.${colors.reset}`);
    return;
  }
  
  // Show preview of files in selected folder
  const selected = visibleFolders[selectedIndex];
  if (selected) {
    const remainingFiles = selected.files.filter(f => !f.deleted);
    console.log(`\n  ${colors.bright}Files in selected backup (${remainingFiles.length}):${colors.reset} ${colors.dim}Press ENTER to manage${colors.reset}`);
    remainingFiles.slice(0, 5).forEach(file => {
      console.log(`    ${colors.dim}${file.name.substring(0, 60)} (${formatBytes(file.size)}, ${formatDaysAgo(file.modified)})${colors.reset}`);
    });
    if (remainingFiles.length > 5) {
      console.log(`    ${colors.dim}... and ${remainingFiles.length - 5} more files${colors.reset}`);
    }
  }
}

// Draw the file list view (inside a folder)
function drawFileView() {
  clearScreen();
  
  const folder = backupFolders.filter(f => !f.deleted)[selectedFolderIndex];
  if (!folder) {
    viewMode = 'folders';
    drawFolderView();
    return;
  }
  
  const files = folder.files.filter(f => !f.deleted);
  
  // Header
  console.log(`${colors.cyan}${colors.bright}`);
  console.log(`  ╦ ╦┌─┐┬─┐┌─┐┌─┐┌─┐  ╔═╗┬  ┌─┐┌─┐┌┐┌┌─┐┬─┐`);
  console.log(`  ║║║├─┘├┬┘├┤ └─┐└─┐  ║  │  ├┤ ├─┤│││├┤ ├┬┘`);
  console.log(`  ╚╩╝┴  ┴└─└─┘└─┘└─┘  ╚═╝┴─┘└─┘┴ ┴┘└┘└─┘┴└─`);
  console.log(`${colors.reset}`);
  
  console.log(`  ${colors.dim}Space saved: ${colors.green}${formatBytes(totalSaved)}${colors.reset}`);
  console.log();
  
  console.log(`${colors.bgMagenta}${colors.white} ↑↓ Navigate | SPACE Delete file | BACKSPACE/ESC Go back | Q Quit ${colors.reset}`);
  console.log();
  
  // Current folder path
  const shortPath = folder.path.replace(DEFAULT_SCAN_PATH, '~');
  console.log(`  ${colors.bright}${colors.cyan}${shortPath}${colors.reset}`);
  console.log(`  ${colors.dim}${'─'.repeat(80)}${colors.reset}`);
  
  // Header row
  console.log(`  ${colors.dim}${'FILENAME'.padEnd(55)} ${'SIZE'.padStart(12)} ${'MODIFIED'.padStart(10)}${colors.reset}`);
  console.log();
  
  // List files
  if (files.length === 0) {
    console.log(`\n  ${colors.yellow}No .wpress files remaining in this folder.${colors.reset}`);
    console.log(`  ${colors.dim}Press BACKSPACE to go back.${colors.reset}`);
    return;
  }
  
  files.forEach((file, index) => {
    const isSelected = index === selectedFileIndex;
    const prefix = isSelected ? `${colors.bgMagenta}${colors.white}>` : ' ';
    
    const displayName = file.name.length > 53 ? file.name.substring(0, 50) + '...' : file.name;
    
    console.log(`${prefix} ${colors.white}${displayName.padEnd(55)}${colors.reset} ${colors.magenta}${formatBytes(file.size).padStart(12)}${colors.reset} ${colors.dim}${formatDaysAgo(file.modified).padStart(10)}${colors.reset}${isSelected ? colors.reset : ''}`);
  });
  
  // Show total
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  console.log();
  console.log(`  ${colors.dim}${'─'.repeat(80)}${colors.reset}`);
  console.log(`  ${colors.bright}Total: ${files.length} files, ${formatBytes(totalSize)}${colors.reset}`);
}

// Draw based on current view mode
function draw() {
  if (viewMode === 'folders') {
    drawFolderView();
  } else {
    drawFileView();
  }
}

// Get visible (non-deleted) folders
function getVisibleFolders() {
  return backupFolders.filter(f => !f.deleted);
}

// Get visible (non-deleted) files in current folder
function getVisibleFiles() {
  const folders = getVisibleFolders();
  if (folders[selectedFolderIndex]) {
    return folders[selectedFolderIndex].files.filter(f => !f.deleted);
  }
  return [];
}

// Main function
async function main() {
  console.log(`${colors.cyan}${colors.bright}wpress-cleaner${colors.reset} ${colors.dim}v1.0.0${colors.reset}\n`);
  
  backupFolders = scanForBackups(DEFAULT_SCAN_PATH);
  backupFolders.sort((a, b) => b.totalSize - a.totalSize);
  
  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(120) + '\r');
  
  if (backupFolders.length === 0) {
    console.log(`${colors.yellow}No ai1wm-backups folders with .wpress files found.${colors.reset}`);
    process.exit(0);
  }
  
  // Setup keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  draw();
  
  process.stdin.on('keypress', (str, key) => {
    // Quit
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      clearScreen();
      console.log(`${colors.green}Space saved: ${formatBytes(totalSaved)}${colors.reset}`);
      console.log(`${colors.cyan}Goodbye!${colors.reset}`);
      process.exit(0);
    }
    
    if (viewMode === 'folders') {
      // FOLDER VIEW CONTROLS
      const visibleFolders = getVisibleFolders();
      
      if (key.name === 'up' && selectedIndex > 0) {
        selectedIndex--;
        draw();
      }
      
      if (key.name === 'down' && selectedIndex < visibleFolders.length - 1) {
        selectedIndex++;
        draw();
      }
      
      // Enter folder to see files
      if (key.name === 'return' && visibleFolders.length > 0) {
        selectedFolderIndex = selectedIndex;
        selectedFileIndex = 0;
        viewMode = 'files';
        draw();
      }
      
      // Delete entire folder
      if (key.name === 'space' && visibleFolders.length > 0) {
        const folder = visibleFolders[selectedIndex];
        try {
          // Delete all files in the folder
          folder.files.forEach(file => {
            if (!file.deleted) {
              deleteFile(file.path);
              totalSaved += file.size;
              file.deleted = true;
            }
          });
          folder.deleted = true;
          
          // Adjust selected index if needed
          const newVisibleFolders = getVisibleFolders();
          if (selectedIndex >= newVisibleFolders.length) {
            selectedIndex = Math.max(0, newVisibleFolders.length - 1);
          }
        } catch (e) {
          // Handle error silently
        }
        draw();
      }
      
    } else {
      // FILE VIEW CONTROLS
      const visibleFiles = getVisibleFiles();
      
      if (key.name === 'up' && selectedFileIndex > 0) {
        selectedFileIndex--;
        draw();
      }
      
      if (key.name === 'down' && selectedFileIndex < visibleFiles.length - 1) {
        selectedFileIndex++;
        draw();
      }
      
      // Go back to folder view
      if (key.name === 'backspace' || key.name === 'escape') {
        viewMode = 'folders';
        selectedIndex = selectedFolderIndex;
        draw();
      }
      
      // Delete single file
      if (key.name === 'space' && visibleFiles.length > 0) {
        const file = visibleFiles[selectedFileIndex];
        if (deleteFile(file.path)) {
          totalSaved += file.size;
          file.deleted = true;
          
          // Recalculate folder stats
          const folder = getVisibleFolders()[selectedFolderIndex];
          recalculateFolderStats(folder);
          
          // Adjust selected index if needed
          const newVisibleFiles = getVisibleFiles();
          if (selectedFileIndex >= newVisibleFiles.length) {
            selectedFileIndex = Math.max(0, newVisibleFiles.length - 1);
          }
          
          // Go back to folders if no files left
          if (newVisibleFiles.length === 0) {
            viewMode = 'folders';
            const newVisibleFolders = getVisibleFolders();
            if (selectedIndex >= newVisibleFolders.length) {
              selectedIndex = Math.max(0, newVisibleFolders.length - 1);
            }
          }
        }
        draw();
      }
    }
  });
}

main();
