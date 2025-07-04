# Changelog

All notable changes to DevNullifier will be documented in this file.

## [1.2.3] - Quick scan

### Added

- **Quick Scan**: scan only folders found during full scan

## [1.2.2] - Dark Mode

### Added

- **Dark Mode**: Add dark mode to the application

## [1.2.1] - macOS Support

### Added

- **macOS Support**: Add support for macOS operating systems
- **DMG Support**: Add support for DMG packaging
- **ZIP Support**: Add support for ZIP packaging

## [1.2.0] - Linux Support

### Added

- **Linux Support**: Add support for Linux operating systems
  - Application data - user's home directory
- **AppImage Support**: Add support for AppImage packaging
- **Deb Support**: Add support for Deb packaging

## [1.1.0] - Dev Cleaner

### Added

- **Dev Cleaner**: Clean development-related temporary folders
- **Pattern-Based Filtering**: Filter folders by name patterns
- **Category Filtering**: Filter folders by category (cache, modules, builds, etc.)
- **Deep Scanning**: Scan through project directories
- **Target Detection**:
  - node_modules (Node.js dependencies)
  - .cache (Application caches - Babel, ESLint, etc.)
  - Library/Binary/Intermediate (Unity and build artifacts)
  - Build folders (target, dist, build directories)
  - Package manager caches (npm, yarn, pip)

### Features

- Pattern-based detection with configurable patterns
- Safe deletion of regenerable folders
- Deep scanning through project directories

## [1.0.0] - AppData Cleaner

### Added

- **AppData Cleaner**: Clean Windows AppData folders
- **Smart Scanning**: Recursively scan for cache, temp, and junk files
- **Size Visualization**: Show folder sizes with human-readable formatting
- **Selective Deletion**: Choose exactly which folders to delete
- **Configurable Depth**: Control scanning depth with slider

### Features

- Clean AppData (Local, Roaming, LocalLow) folders
- Target temp folders, cache folders, crash dumps, pending files, log files
- Safe deletion with confirmation dialogs

### Technology Stack

- Electron + Vue 3 + Vuetify 3
- Node.js for file system operations
