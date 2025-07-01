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

## Differences from Original Python Version

- **Modern UI**: Material Design interface vs. traditional desktop UI
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Better Performance**: Asynchronous operations with progress indicators
- **Enhanced UX**: Tooltips, notifications, and responsive design
- **Sortable Table**: Click column headers to sort results
- **Search/Filter**: Built-in table filtering capabilities
- **Dev Cache Support**: Cleans dev-related folders (node_modules, .cache, Library, Binary, Intermediate, etc)

## Building

```bash
# Build renderer (Vue app)
npm run build:renderer

# Build entire app with Electron Builder
npm run build
```

## License

MIT License
