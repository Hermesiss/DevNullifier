# DevNullifier

A modern cross-platform cleaner for AppData and developer caches (node_modules, .cache, Library, Binary, Intermediate, etc) built with Electron, Vue 3, and Vuetify 3.

## Features

- 🔍 **Smart Scanning**: Recursively scans AppData and dev folders for cache, temp, and junk files
- 📊 **Size Visualization**: Shows folder sizes with human-readable formatting
- 🎯 **Selective Deletion**: Choose exactly which folders to delete with checkboxes
- ⚙️ **Configurable Depth**: Control how deep to scan with a depth slider
- 🎨 **Modern UI**: Clean, responsive interface built with Vuetify 3
- 🚀 **Fast Performance**: Asynchronous scanning and deletion operations
- 🔒 **Safe Operations**: Confirmation dialogs before permanent deletion

## AppData Cleaner

![AppData Cleaning Interface](.docs/img-appdata.png)

The **AppData Cleaner** is designed to clean up Windows AppData folders that accumulate temporary files, caches, and other junk data from various applications over time.

### What it cleans

The AppData Cleaner targets common temporary and cache folders in Windows:

- **Temp folders**: Temporary files that can be safely removed
- **Cache folders**: Application caches that can be regenerated
- **Crash dumps**: Error report files and crash dumps
- **Pending files**: Temporary pending operations
- **Log files**: Old application logs and reports

### Features

- **AppData scanning**: Specifically targets Windows AppData (Local, Roaming, LocalLow)
- **Safe detection**: Only identifies folders that can be safely deleted
- **Size calculation**: Shows exactly how much space each folder consumes
- **Selective deletion**: Choose individual folders or clean everything
- **Depth control**: Configure how deep to scan with adjustable depth settings
- **Real-time feedback**: Progress indicators during scanning and deletion

### How it works

1. **Scan AppData**: Searches through AppData folders for known junk patterns
2. **Identify safe targets**: Uses keyword matching to find cache, temp, and crash folders
3. **Calculate impact**: Shows size of each folder and total potential space savings
4. **User selection**: Present results in a sortable table for user review
5. **Safe deletion**: Delete selected folders with confirmation dialogs

The AppData Cleaner is particularly useful for reclaiming disk space from accumulated application data that Windows doesn't automatically clean up.

## Dev Cleaner

### Developer Cache Cleaning

![Developer Cache Cleaning](.docs/img-dev-filters.png)

### Pattern-Based Filtering

![Pattern-Based Filtering](.docs/img-dev-patterns.png)

### Folder Explorer

![Folder Explorer](.docs/img-folder-explorer.png)

DevNullifier includes a powerful **Developer Cache Cleaner** specifically designed to clean up development-related folders that accumulate over time and consume significant disk space.

### What it cleans

The Dev Cleaner targets common developer cache and build artifacts:

- **node_modules**: Node.js dependencies that can be restored with `npm install`
- **.cache**: Various application caches (Babel, ESLint, etc.)
- **Library**: Unity and other development libraries
- **Binary**: Compiled binaries and intermediate files
- **Intermediate**: Temporary build files
- **Build artifacts**: Target, dist, build folders
- **Package manager caches**: npm, yarn, pip caches

### Features

- **Pattern-based detection**: Uses configurable patterns to identify developer folders
- **Size-aware scanning**: Shows exactly how much space each folder consumes
- **Safe deletion**: Only removes folders that can be safely regenerated
- **Selective cleaning**: Choose individual folders or entire categories
- **Deep scanning**: Recursively searches through project directories
- **Category filtering**: Filter results by folder type (cache, modules, builds, etc.)

### How it works

1. **Scan**: Recursively searches specified directories for developer cache patterns
2. **Categorize**: Groups found folders by type (node_modules, cache, build, etc.)
3. **Analyze**: Calculates sizes and shows potential space savings
4. **Filter**: Apply category filters to focus on specific types of files
5. **Clean**: Selectively delete folders with confirmation dialogs

The Dev Cleaner is particularly useful for developers who work with multiple projects and want to reclaim disk space from regenerable cache and build files.

## Technology Stack

- **Electron**: Cross-platform desktop app framework
- **Vue 3**: Progressive JavaScript framework with Composition API
- **Vuetify 3**: Material Design component library
- **Node.js**: File system operations and scanning logic

## Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

#### Using npm commands:

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

#### Using Windows batch files:

```cmd
# Setup dependencies
setup.bat

# Run in development mode
dev.bat

# Build for production
build.bat

# Run the built application
run.bat
```

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.js     # Main Electron process
│   └── preload.js  # Preload script for IPC
└── renderer/       # Vue app (renderer process)
    ├── App.vue     # Main Vue component
    ├── main.js     # Vue app entry point
    └── index.html  # HTML template
```

## Usage

1. Launch the application
2. Click **Scan** to find junk/dev folders in AppData and project directories
3. Review the results in the table (sorted by size by default)
4. Select folders you want to delete using checkboxes
5. Click **Delete Selected** to remove chosen folders
6. Confirm the deletion in the dialog

⚠️ **Warning**: Deleted folders cannot be recovered. Use with caution.

## Keywords Detected

The app searches for folders containing these keywords:

- cache
- temp
- crash
- report
- dump
- crashes
- pending
- node_modules
- .cache
- Library
- Binary
- Intermediate

## Building

```bash
# Build renderer (Vue app)
npm run build:renderer

# Build entire app with Electron Builder
npm run build
```

## License

MIT License
