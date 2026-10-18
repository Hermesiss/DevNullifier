# System / Apps cleaners — design spec

Date: 2026-10-18  
Status: approved (implementing on `feature/system`)

## Goal

Add safe, explicit-choice cleaning for non-dev app caches (temp, browsers, messengers, shaders, creative apps, launcher caches), fill Tool Caches gaps, add more game launcher uninstall providers, and expose Docker/Podman CLI prune without volumes.

## Decisions

- New **System** tab (en) / **Система** (ru) between Tools and Games.
- Catalog scan model identical to Tool Caches: known paths → size → user select → `delete-folders` allowlist only.
- System targets live in `systemAppCaches.ts`, not `TOOL_CACHE_DEFINITIONS`.
- Browsers: only Cache / Code Cache / GPUCache (Firefox: cache2). No cookies, passwords, history.
- Messengers: cache folders only; never Telegram `tdata` or Discord LevelDB.
- TEMP: discover top-level children of user `%TEMP%` / `$TMPDIR`; never `C:\Windows\Temp`.
- Docker prune: `docker system prune -f` + `docker builder prune -f` (podman equivalents); never `--volumes`.
- Versioning: patch after each phase (1.6.1–1.6.5), then minor 1.7.0.

## Phases

1. System tab + TEMP + browsers → 1.6.1  
2. Messengers, shaders, creative, launcher caches → 1.6.2  
3. Tool Caches gaps → 1.6.3  
4. GOG / Battle.net / Riot / EA games providers → 1.6.4  
5. Docker/Podman CLI prune on Tools → 1.6.5  
6. Minor bump → 1.7.0  

## Out of scope

Windows Update / Prefetch / Delivery Optimization / Package Cache; cloud sync; registry cleaners; browser identity data; Docker volumes; elevation-required paths.
