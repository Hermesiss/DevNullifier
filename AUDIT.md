# Аудит DevNullifier

Срез по исходникам на версии 1.3.1. Это список доработок, не описание того, как приложение уже работает. Операционные ограничения для агентов — в `AGENTS.md`.

## Критично

### Удаление без границ

`ipcMain.handle("delete-folders")` в `src/main/main.ts` принимает любой массив путей от рендерера и отдаёт его в `deleteDirectory`. Нет проверки, что путь был в результатах скана, что это не корень диска и не каталог выше выбранной базы. Тот же пробел у `get-folder-contents`: читается любой путь, лимит только 1000 записей.

На Windows NSIS стоит `requireAdministrator`, так что процесс может снести то, что обычный пользователь не смог бы. `webPreferences.sandbox` не включён.

`deleteDirectory` обходит всё, у чего `Dirent.isDirectory()` истинно, и не делает `lstat`. На Windows у junction `isDirectory()` истинно, ссылка не отсекается. Рекурсия уходит в цель junction и удаляет её содержимое, затем снимает сам junction.

Что сделать: удалять только пути, которые этот же скан вернул пользователю; отсекать корни диска, профиль и `userData` приложения; перед рекурсией пропускать symlink и junction (`lstat`); по умолчанию класть в корзину (`shell.trashItem`), а не `unlink`/`rm`.

### Двойная регистрация `set-update-channel`

Канал вешается в `src/main/main.ts` и ещё раз в `UpdateService.setupIpcHandlers()` при `createWindow`. Electron на втором `ipcMain.handle` бросает ошибку, окно не создаётся. Оставить один обработчик, в сервисе обновлений.

### Файлы из паттернов не удаляются

`deleteDirectory` при `!stats.isDirectory()` сразу возвращает `false`. В категориях есть файлы: `.coverage`, `.eslintcache`, `.phpunit.result.cache`, `.idea/workspace.xml`, `.DS_Store`, `Thumbs.db`. Пользователь их выбирает, удаление всегда «failed». Нужна ветка для файла (`unlink`) и честный статус в UI.

### Частичное удаление в Dev Cleaner считается успехом

`AppDataCleaner.vue` отличает `success === true` от `'partial'`. `DeveloperCleaner.vue` (`deleteCaches`) считает успехом любое truthy-значение, а строка `'partial'` truthy. Частично снесённый `Saved/` или `Library/` показывается как удалённый. Считать так же, как в AppData.

## Высокий риск потери данных

Паттерны в `DeveloperCleaner.vue`. Предупреждения в локалях короче реального ущерба, у части категорий `warning: false` и ключа `common.warnings` нет.

| Категория | Что не так |
| --- | --- |
| Unreal | `Saved/` — это SaveGames, Config и логи, не кэш. Текст предупреждения говорит только про `Saved/Config`. |
| Unity | `UserSettings/` — настройки редактора, не кэш. `Library/` регенерируется, но тяжёлый. |
| ML | `checkpoints/`, `wandb/`, `mlruns/`, `runs/` — результаты экспериментов. |
| Java | `.idea/` целиком, не только `caches/`. |
| PHP | `vendor/` без проверки `composer.lock`, хотя текст предупреждения это требует. Детектор `app/` слишком широкий. |
| Docker | Детектор `.env` помечает почти любой проект. `warning: false`. Паттерн `tmp/`. |
| Static | Детектор `content/`. `public/` у части генераторов — исходники, не сборка. Предупреждения нет. |
| IDE | Детектор `.DS_Store` и `.vscode/`. На macOS `.DS_Store` есть почти везде, глубина скана 10. |
| .NET | Детектор `.csproj` — точное имя файла, не `*.csproj`. Реальные проекты ловятся только по `*.sln` или файлу ровно `Program.cs`. |
| Python | Предупреждение про `venv/`, но `venv/` нет в `cachePatterns` (есть только детект `.venv/`). `*.py` делает проектом любой каталог с одним скриптом; при наличии `build/` или `dist/` обход вниз прекращается. |
| C/C++ | `*.cpp` / `*.h` / `Makefile` очень широкие. `Debug/` и `Release/` могут быть нужной сборкой. |
| Symfony | `vendor/` без предупреждения, пересекается с PHP. |

Глубина dev-скана зашита: `10` в `scanDeveloperProjects`. С домашнего каталога это долго и захватывает чужие деревья.

Ранний `return` в `scanDeveloperProjectsRecursive`: если проект найден и кэш ненулевой, вложенные проекты не сканируются. Монорепа с корневым `package.json` и `node_modules` прячет пакеты внутри. Текст `warnings.nodejs` описывает как раз этот случай, код его не покрывает.

AppData-ключевые слова — подстрока (`folderName.includes`). `temp` попадает в `Templates` / `template`, `report` — в любые `*report*`. Совпадение забирает каталог целиком и внутрь не идёт. Имеет смысл граница по сегменту пути или по началу/концу имени, плюс список исключений.

`getAppDataPaths`: LocalLow считается как `LOCALAPPDATA.replace("Local", "LocalLow")`. Заменяется первое вхождение. У пользователя `LocalAdmin` путь станет `...\LocalLowAdmin\...`, а не `AppData\LocalLow`.

Корни скана шире README: на macOS в список входит `Library/Preferences`. `userDataPath` в воркер передаётся и нигде не используется — каталог самого DevNullifier из выборки не исключается.

## Баги поведения

Слайдер глубины AppData (`ControlPanel.vue`): при `maxDepth === 0` подпись «All» (хардкод, не i18n). Воркер трактует безлимит только как `-1`. При `0` условие `currentDepth < maxDepth` ложно сразу, обхода нет. Подпись и смысл перепутаны. Дефолт слайдера — 3.

`check-admin`: на Windows `process.getuid` отсутствует, обработчик возвращает `false`. С `requireAdministrator` приложение как раз повышено. Метод наружу торчит и из UI не вызывается. Либо честная проверка (и показ в интерфейсе), либо убрать канал. Отдельно решить, нужен ли админ для своего AppData: постоянный UAC расширяет ущерб от любого плохого пути.

Остановка скана кооперативная. `stop` ставит флаг, но `getDirSize` / `getDirectorySize` не отменяемы: пока считается огромный каталог, стоп не срабатывает. `stop-*-scan` шлёт сообщение, а не `terminate()`. Если окно уже закрыто, обработчик сообщения воркера в `main.ts` выходит на `if (!mainWindow) return` до `resolve` — промис скана висит, воркер остаётся.

Dev Cleaner при сохранении пишет проекты с `caches: []` (`saveDeveloperProjects`). Быстрый скан из-за этого заново гоняет полный обход каждого пути по очереди.

`calculateCacheSizes` прибавляет размер паттерна к `totalSize`, даже если путь уже есть в `allMatches`. Пересекающиеся паттерны (PHP `vendor/` и Symfony `vendor/`) раздувают размер в сообщении воркера. UI потом пересчитывает по группам в `processProject`, цифры расходятся.

`UpdateButton.vue` целиком на английском, мимо vue-i18n. Туда же подпись «All» у глубины.

`setFeedURL` получает голый URL строкой, при том что `package.json` уже задаёт GitHub-провайдер. Для канала `latest-dev` база `.../releases/download/latest-dev/`. Стоит проверить на установленном билде, что `latest.yml` реально подхватывается; generic URL и конфиг `publish` сейчас спорят.

Детекторы с `*` собирают `RegExp` через `pattern.replace(/\*/g, ".*")` без экранирования остального. Точка в `*.uproject` матчит любой символ. Категории приходят по IPC из рендерера, регулярка исполняется в main.

## Структура и типы

Два описания одного и того же: `src/types/developer-cleaner.ts` и `src/renderer/types/developer-cleaner.ts`. У main у `CacheMatch` есть `categories` и `patterns`, у рендерера нет. `getFolderContents` в `common.ts` объявлен как `Promise<string[]>`, фактически возвращает объекты `{ name, path, isDirectory, size, itemCount }`.

`src/types/global.d.ts` объявляет `window.electronAPI` с `[key: string]: any` параллельно с нормальным типом в `common.ts`.

Два обхода размера каталога. Один должен остаться, с пропуском reparse point и возможностью отмены.

`console.log` в `deleteDirectory` печатает полный список `Dirent` на каждый каталог. На большом `node_modules` это и тормоз, и лишние имена в логе.

`CHANGELOG.md` обрывается на 1.2.4, пакет — 1.3.1. README ссылается на `LICENSE`, файла нет. Иконок `src/assets/icon-*.png` нет: и окно (`path.join(__dirname, "../assets/...")` из `dist-main`), и electron-builder смотрят в пустое место.

## Тесты

Есть тесты main (пути, удаление, воркеры, fileUtils, updateService) и два юнита рендерера. Vue исключён из coverage (`vite.config.ts`). Нет теста на: файл вместо каталога, junction, запрет пути вне скана, двойной `ipcMain.handle`, слайдер `0` vs `-1`, `.csproj` vs `*.csproj`, ранний выход из монорепы, `'partial'` в Dev Cleaner.

CI (`.github/workflows/test.yml`) гоняет тесты только на Ubuntu и Node 18. Ветки Windows (`getuid`, LocalLow, junction, NSIS) в CI не исполняются, только моки.

## CI и релиз

`build-and-release.yml` собирает win/linux/mac на каждый push в `main`, `develop` и `feature/*`. Релиз создаётся только для `main` и `develop`, но feature-ветки всё равно платят за три платформы.

`actions/create-release@v1` устарел. Тег `latest-dev` пересоздаётся через `git push -f`. На develop релиз ещё и удаляется перед этим.

macOS: `package.json` целится в x64 и arm64, workflow берёт первый `*.dmg` (`head -1`) и всегда называет его `DevNullifier-mac-x64.dmg`. Второй архив и arm64 не публикуются. `macos-latest` сейчас arm64.

Node в CI и README — 18. Electron 37 живёт на своём Node; для установки и `electron-builder` лучше зафиксировать актуальное LTS и не расходиться с README.

CodeQL есть (`.github/workflows/codeql-analysis.yml`), на логику удаления он не заменяет тесты выше.

## Мелочи

- `warningText` в категориях всегда `''` и нигде не читается. Тексты уже в локалях.
- Слушатель `scan-folder-found` снимается не во всех ветках `onUnmounted` у `AppDataCleaner.vue` (`removeEventListeners` его не трогает).
- Быстрый скан и обычный скан вешают `onDeveloperProjectFound` без гарантии, что предыдущий снят, кроме `startScan`.
- Нет ESLint/Prettier. Стиль держится только компилятором и ревью.
- Coverage описан и в `package.json` (`vitest.coverage`), и в `vite.config.ts` / `vitest.main.config.ts`. Отчёты пишутся в разные каталоги.
- Документация в `docs/*.html` — отдельный статический сайт, не UI приложения. Править её только если меняется поведение, которое там описано.
