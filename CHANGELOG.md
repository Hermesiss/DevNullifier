# Changelog

All notable changes to DevNullifier will be documented in this file.

## [1.7.2] - About window

### Added

- An About window shows the version, a short description, the MIT license, and a link to the GitHub repository.
- The changelog opens on the current version. Older versions stay collapsed, and a Russian note is used when that version has one.

## [1.7.0] - System apps

### Added

- A System tab scans user temp, browser disk caches, messengers, shader caches, creative apps, and launcher caches. Selected items go to the trash. Cookies, passwords, and chat databases are not offered.
- Tool caches gained more selectable parts. Docker and Podman can prune unused data without volumes. The Games tab also lists GOG, Battle.net, Riot, and EA.

## [1.6.0] - Games tab

### Added

- Games tab lists installed Steam and Epic apps, with filters for platform, type, and last played.
- Uninstall opens the launcher dialog. Game folders are not deleted. Epic has no uninstall deep link, so the launcher opens for a manual removal.

## [1.5.0] - Tool caches

### Added

- Tool caches are a separate tab with scan progress, folder browsing, and safety notes.
- Each tool can expose selectable subfolders (parts) with descriptions — for example safer Docker logs vs the unsafe WSL/VM disk.
- An info dialog lists the known tool-cache catalog grouped by category.

### Changed

- The mini tool-cache block was removed from the Developer Cache tab.

## [1.4.2] - Shared palette

### Changed

- Light and dark themes use a shared DevNullifier palette (yellow primary actions, blue navigation, graphite surfaces) instead of default Vuetify Material colors.
- The app bar shows the duck logo; scan tables, paths, category chips, and the disk bar follow the same compact utility look.

## [1.4.1] - Disk bar

### Changed

- The footer disk bar shows used space, found results, the selection inside found (next to free), then free space. The percent is how much of used space deletion would free.
- Project type chips stack when a row has more than one cache group.

## [1.4.0] - Audit release

### Added

- Free space. The status line shows free space on the scan volume, how much is selected, and what share of the free space that is.
- Admin restart. If a scan cannot read a folder outside the profile, Windows can restart the app as administrator. The installer still does not ask for that on its own.
- Delete retry. A failed or partial delete shows the error code and can be retried. On Windows, a row can ask which process has the file open.
- Scan compare. After a full scan, the results say what is new, what grew, and how much disappeared since the previous scan.
- Deletion log. Deletions are recorded with time, path, size, and result. The list can be exported as CSV.
- Nested projects. A Dev Cleaner project inside another project is shown as a nested row.
- Home tool caches. Dev Cleaner can list known tool caches in the home directory without walking projects. Missing paths are skipped.
- Custom rules. Custom Dev Cleaner categories and AppData keywords are stored beside the built-in lists and included in the next scan.
- Category presets. Dev Cleaner can switch to regenerable caches only, or enable every current category. A manual selection is still saved.
- Scan progress. A running scan shows how many directories were opened and which path is current, together.
- App groups. AppData results under Local, Roaming, or LocalLow collapse into one row per application. Selecting that row selects the scanned folders inside it.
- Table filters. Both result tables can be searched by path and filtered by category. Dev Cleaner shows project type. A row can open its folder or copy its path.
- Match details. AppData rows show the keyword that matched. Dev Cleaner rows show the category and pattern.
- Age and size. Minimum age and size leave newer or smaller rows in the list, but select-all skips them.
- Path masks. Path masks skip matching folders in both cleaners, and a mask with no slash skips a folder that contains that file. Those paths cannot be deleted.
- Protected paths. Extra protected folders are skipped by scans and cannot be deleted.
- Permanent delete. Optional permanent delete, off by default. Selected items still go to the trash unless that switch is on.
- Cleaner warnings. Dev Cleaner warnings, match counts, and relative dates in English and Russian.

### Changed

- Settings screen. Language, theme, update channel, permanent delete, thresholds, protected paths, and exclusions are in one Settings screen.
- Parallel sizes. Directory sizes run up to four at a time. One folder is still measured the same way, and a stopped scan still stops the walk.
- Safer deletion. Selected files and folders go to the trash. Only paths from the current scan can be deleted. Drive roots, the user profile, and the app data directory are refused.
- Symlinks and Windows junctions are not followed. Cache files such as `.eslintcache` can be removed.
- Dev Cleaner leaves experiment results, editor settings, and project configuration in place. `vendor/` is removed only when `composer.lock` is present. Nested monorepo packages are scanned.
- AppData depth "All" scans without a limit. Folder names match a keyword at the start or end, so `Templates` is not treated as temp.
- The update check uses the GitHub release feed. The Windows installer no longer requests administrator rights.

### Fixed

- Directory size keeps going when a single file or folder cannot be read.

## [1.3.0] - Russian interface

### Added

- Russian interface. The language follows the OS locale when none is saved
- Project site in `docs/`, published with GitHub Pages

## [1.2.6] - Scan workers

### Fixed

- Scan workers receive the app data path from the main process, so saving scan results no longer depends on Electron inside the worker

## [1.2.5] - Beta channel

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
