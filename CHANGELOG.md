# Changelog

All notable changes to DevNullifier will be documented in this file.

## [1.4.2]

### Changed

- Light and dark themes use a shared DevNullifier palette (yellow primary actions, blue navigation, graphite surfaces) instead of default Vuetify Material colors.
- The app bar shows the duck logo; scan tables, paths, category chips, and the disk bar follow the same compact utility look.

## [1.4.1]

### Changed

- The footer disk bar shows used space, found results, the selection inside found (next to free), then free space. The percent is how much of used space deletion would free.
- Project type chips stack when a row has more than one cache group.

## [1.4.0]

### Added

- The 1.3.3–1.3.21 changes ship together: safer delete options, scan filters, tool caches, a deletion log, and one settings screen.

## [1.3.21]

### Added

- The status line shows free space on the scan volume, how much is selected, and what share of the free space that is.

## [1.3.20]

### Changed

- Language, theme, update channel, permanent delete, thresholds, protected paths, and exclusions are in one Settings screen.

## [1.3.19]

### Added

- If a scan cannot read a folder outside the profile, Windows can restart the app as administrator. The installer still does not ask for that on its own.

## [1.3.18]

### Added

- A failed or partial delete shows the error code and can be retried. On Windows, a row can ask which process has the file open.

## [1.3.17]

### Added

- After a full scan, the results say what is new, what grew, and how much disappeared since the previous scan.

## [1.3.16]

### Added

- Deletions are recorded with time, path, size, and result. The list can be exported as CSV.

## [1.3.15]

### Added

- A Dev Cleaner project inside another project is shown as a nested row.

## [1.3.14]

### Added

- Dev Cleaner can list known tool caches in the home directory without walking projects. Missing paths are skipped.

## [1.3.13]

### Added

- Custom Dev Cleaner categories and AppData keywords are stored beside the built-in lists and included in the next scan.

## [1.3.12]

### Added

- Dev Cleaner can switch to regenerable caches only, or enable every current category. A manual selection is still saved.

## [1.3.11]

### Changed

- Directory sizes run up to four at a time. One folder is still measured the same way, and a stopped scan still stops the walk.

## [1.3.10]

### Added

- A running scan shows how many directories were opened and which path is current, together.

## [1.3.9]

### Added

- AppData results under Local, Roaming, or LocalLow collapse into one row per application. Selecting that row selects the scanned folders inside it.

## [1.3.8]

### Added

- Both result tables can be searched by path and filtered by category. Dev Cleaner shows project type. A row can open its folder or copy its path.

## [1.3.7]

### Added

- AppData rows show the keyword that matched. Dev Cleaner rows show the category and pattern.

## [1.3.6]

### Added

- Minimum age and size leave newer or smaller rows in the list, but select-all skips them.

## [1.3.5]

### Added

- Path masks skip matching folders in both cleaners, and a mask with no slash skips a folder that contains that file. Those paths cannot be deleted.

## [1.3.4]

### Added

- Extra protected folders are skipped by scans and cannot be deleted.

## [1.3.3]

### Added

- Optional permanent delete, off by default. Selected items still go to the trash unless that switch is on.

## [1.3.2]

### Changed

- Selected files and folders go to the trash. Only paths from the current scan can be deleted. Drive roots, the user profile, and the app data directory are refused.
- Symlinks and Windows junctions are not followed. Cache files such as `.eslintcache` can be removed.
- Dev Cleaner leaves experiment results, editor settings, and project configuration in place. `vendor/` is removed only when `composer.lock` is present. Nested monorepo packages are scanned.
- AppData depth "All" scans without a limit. Folder names match a keyword at the start or end, so `Templates` is not treated as temp.
- The update check uses the GitHub release feed. The Windows installer no longer requests administrator rights.

## [1.3.1]

### Added

- Dev Cleaner warnings, match counts, and relative dates in English and Russian

### Fixed

- Directory size keeps going when a single file or folder cannot be read

## [1.3.0]

### Added

- Russian interface. The language follows the OS locale when none is saved
- Project site in `docs/`, published with GitHub Pages

## [1.2.6]

### Fixed

- Scan workers receive the app data path from the main process, so saving scan results no longer depends on Electron inside the worker

## [1.2.5]

### Added

- Beta channel switch in the update menu
- Release assets include blockmaps and a `latest-dev` feed

## [1.2.4] - Update Service

### Added

- **Update Service**: Check for updates and download them

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
