# DevNullifier — agent context

Desktop cache cleaner: Electron 37 + Vue 3 + Vuetify 3 + vue-i18n (en/ru). Version lives in `package.json` (currently 1.3.2). Selected items are moved to the trash. The Windows installer does not request administrator rights (`requestedExecutionLevel: asInvoker`).

## Processes

- Renderer: Vite, root `src/renderer`, dev server `http://localhost:3000`, build output `dist-renderer`.
- Main: `tsc -p src/main/tsconfig.json` → `dist-main`. Entry: `dist-main/main/main.js`.
- `npm run dev` starts both. Dev opens DevTools and does not start auto-update.
- Preload (`src/main/preload.ts`) is the only bridge. `contextIsolation: true`, `nodeIntegration: false`. API: `window.electronAPI`.
- Scanning runs on worker threads: `appDataScanWorker.ts`, `developerScanWorker.ts`. Main only sends IPC and deletes.
- Both cleaners delete through one IPC channel, `delete-folders` → `appDataCleaner.deleteDirectory`.

## Commands

- `npm run dev` — development
- `npm test` — renderer (`vitest`, config in `vite.config.ts`) and main (`vitest.main.config.ts`)
- `npm run type-check` — `vue-tsc` and main `tsc`
- Husky pre-commit already runs `type-check` and `npm test`. Do not disable it.
- Build: `npm run build:win|linux|mac`. Artifacts land in `dist/`. Do not publish (`--publish=never`). Releases go only through `.github/workflows/build-and-release.yml`.

## Do not break

- Any new delete path must stay an explicit user choice. `delete-folders` accepts only paths from the current scan allowlist. Do not delete a drive root, the user profile, the app `userData` directory, or anything inside `userData`.
- `deleteDirectory` moves a file or directory to the trash. A symlink or Windows junction (`lstat` symbolic link) is unlinked and not followed. Some patterns are files (`.eslintcache`, `.coverage`, `Thumbs.db`).
- Dev Cleaner categories are defined in `src/renderer/components/DeveloperCleaner.vue`. Warning copy is `common.warnings.<id>` in both `src/renderer/locales/{en,ru}.json`. Keep en and ru keys in sync.
- AppData scan: keywords are `KEYWORDS` in `appDataCleaner.ts`. A match is the keyword at the start or end of the folder name (`template` and `templates` are excluded). Depth comes from the slider. `0` is labeled "All" and the UI sends `-1`, which is the only unlimited scan. The app `userData` directory is skipped.
- The dev scan keeps walking after a project with cache is found, and it does not enter dependency directories such as `node_modules`. Default depth is 6.
- `vendor/` is deleted only when `composer.lock` exists in that project.
- Types are split: `src/types/developer-cleaner.ts` (main/worker) and `src/renderer/types/` (UI). `CacheMatch` on both sides has `categories` and `patterns`. Change both sides when the cache or project shape changes.
- Directory size is `fileUtils.getDirSize`. `appDataCleaner.getDirectorySize` calls it. The walk skips symlinks and stops when `shouldContinue` returns false.
- IPC `set-update-channel` is registered only in `UpdateService`, and only once per process.
- Icons live in `src/assets/icon-256.png` and `icon-512.png`. `LICENSE` is MIT.
- Do not commit unless explicitly asked. Do not touch git config and do not push.

## Tests

Covered: main utilities (deletion, AppData paths, workers, size, updates) and `formatters` / `categoryColors` / delete result counts. Vue components are excluded from coverage. Test CI is Ubuntu only, Node 22.

Audit backlog: `AUDIT.md`. That file is a list of follow-ups, not a request to implement them on your own.
