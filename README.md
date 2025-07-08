# DevNullifier

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Version](https://img.shields.io/github/package-json/v/Hermesiss/DevNullifier)
![Downloads](https://img.shields.io/github/downloads/Hermesiss/DevNullifier/total)
![Issues](https://img.shields.io/github/issues/Hermesiss/DevNullifier)
![Activity](https://img.shields.io/github/last-commit/Hermesiss/DevNullifier)

I was tired of cleaning up my computer manually, so I made this app to help me.

Works for projects like:

![Unity](https://img.shields.io/badge/Unity-000000?style=flat&logo=unity&logoColor=white)
![Unreal](https://img.shields.io/badge/Unreal-313131?style=flat&logo=unrealengine&logoColor=white)
![.NET](https://img.shields.io/badge/.NET-512BD4?style=flat&logo=dotnet&logoColor=white)
![C++](https://img.shields.io/badge/C++-00599C?style=flat&logo=cplusplus&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?style=flat&logo=openjdk&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-0095D5?style=flat&logo=kotlin&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=flat&logo=android&logoColor=white)
![Xcode](https://img.shields.io/badge/Xcode-147EFB?style=flat&logo=xcode&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-777BB4?style=flat&logo=php&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-FF2D20?style=flat&logo=laravel&logoColor=white)
![Symfony](https://img.shields.io/badge/Symfony-000000?style=flat&logo=symfony&logoColor=white)
![ML](https://img.shields.io/badge/ML-FF6F00?style=flat&logo=tensorflow&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Gatsby](https://img.shields.io/badge/Gatsby-663399?style=flat&logo=gatsby&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=flat&logo=jest&logoColor=white)
![VS Code](https://img.shields.io/badge/VS_Code-007ACC?style=flat&logo=visualstudiocode&logoColor=white)

Platforms:

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)](https://github.com/Hermesiss/DevNullifier/releases/latest/download/DevNullifier-Setup.exe)
[![Linux(AppImage)](<https://img.shields.io/badge/Linux%20(AppImage)-FCC624?style=flat&logo=linux&logoColor=black>)](https://github.com/Hermesiss/DevNullifier/releases/latest/download/DevNullifier-linux-x64.AppImage)
[![Linux(Debian)](https://img.shields.io/badge/Debian-A81D33?style=flat&logo=debian&logoColor=white)](https://github.com/Hermesiss/DevNullifier/releases/latest/download/DevNullifier-linux-x64.deb)
[![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)](https://github.com/Hermesiss/DevNullifier/releases/latest/download/DevNullifier-mac-x64.dmg)

Now with dark mode!

## Download

Download the latest release from the [Releases](https://github.com/Hermesiss/DevNullifier/releases) page.

## Application Data Cleaner

![Application Data Cleaning Interface](docs/img/img-appdata.png)

Cleans application data folders that accumulate temporary files, caches, and junk data.

- **Smart Scanning**: Recursively scans for cache, temp, and junk files
- **Size Visualization**: Shows folder sizes with human-readable formatting
- **Selective Deletion**: Choose exactly which folders to delete
- **Configurable Depth**: Control scanning depth with slider

**Targets:**

- **Windows**: Temp folders, cache folders, crash dumps, pending files, log files in AppData (Local, Roaming, LocalLow)
- **Linux**: Cache and temp folders in ~/.config, ~/.cache, ~/.local/share, ~/.local/state, /tmp
- **macOS**: Cache and temp folders in ~/Library/Caches, ~/Library/Application Support, ~/Library/Logs

## Dev Cleaner

![Developer Cache Cleaning](docs/img/img-dev-filters.png)
![Pattern-Based Filtering](docs/img/img-dev-patterns.png)
![Folder Explorer](docs/img/img-folder-explorer.png)

Cleans development-related temporary folders that consume significant disk space.

- **Pattern-Based Filtering**: Filter folders by name patterns
- **Category Filtering**: Filter folders by category
- **Deep Scanning**: Scan through project directories

**Targets:**

- **node_modules**: Node.js dependencies (restorable with `npm install`)
- **.cache**: Application caches (Babel, ESLint, etc.)
- **Library/Binary/Intermediate**: Unity and build artifacts
- **Build folders**: Target, dist, build directories
- **Package manager caches**: npm, yarn, pip caches

**Features:**

- Pattern-based detection with configurable patterns
- Category filtering (cache, modules, builds, etc.)
- Deep scanning through project directories
- Safe deletion of regenerable folders

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **Vue 3**: Progressive JavaScript framework with Composition API
- **Vuetify 3**: Material Design component library
- **Node.js**: File system operations and scanning logic

## Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

**Using npm:**

```bash
npm install    # Install dependencies
npm run dev    # Run in development
npm run build  # Build for production
```

**Using Windows batch files:**

```cmd
setup.bat  # Install dependencies
dev.bat    # Run in development
build.bat  # Build for production
run.bat    # Run built application
```

**Using macOS:**

```bash
npm install    # Install dependencies
npm run dev    # Run in development
npm run build  # Build for production
```

**Note for macOS users:** The app is unsigned, so you'll need to right-click → "Open" → "Open" the first time to bypass Gatekeeper.

## Usage

1. Launch the application
2. Click **Scan** to find junk/dev folders
3. Review results in the table (sorted by size)
4. Select folders to delete using checkboxes
5. Click **Delete Selected** and confirm

⚠️ **Warning**: Deleted folders cannot be recovered. Use with caution.

## Keywords Detected

- cache, temp, crash, report, dump, crashes, pending
- node_modules, .cache, Library, Binary, Intermediate

## Building

```bash
npm run build:renderer  # Build renderer (Vue app)
npm run build          # Build entire app
npm run build:win      # Build for Windows
npm run build:linux    # Build for Linux
npm run build:mac      # Build for macOS
```

## License

MIT License
