<template>
    <div>
        <!-- Categories Panel -->
        <v-row class="mb-4">
            <v-col cols="12">
                <v-card>
                    <v-card-title class="pb-2 cursor-pointer" @click="showCategories = !showCategories">
                        <v-icon :class="{ 'rotate-90': showCategories }" class="mr-2 transition-transform">
                            mdi-chevron-right
                        </v-icon>
                        Development Categories ({{ enabledCount }}/{{ categories.length }} enabled)
                        <v-spacer />
                        <v-chip size="small" v-if="!hasEnabledCategories"
                            :color="hasEnabledCategories ? 'success' : 'warning'">
                            {{ hasEnabledCategories ? 'Ready' : 'No categories enabled' }}
                        </v-chip>
                    </v-card-title>

                    <v-expand-transition>
                        <v-card-text v-show="showCategories" class="pt-0">
                            <v-row class="mb-2">
                                <v-col cols="auto">
                                    <v-btn variant="outlined" size="small" @click="enableAll">
                                        <v-icon left size="small">mdi-check-all</v-icon>
                                        Enable All
                                    </v-btn>
                                </v-col>
                                <v-col cols="auto">
                                    <v-btn variant="outlined" size="small" @click="disableAll">
                                        <v-icon left size="small">mdi-close-box-multiple</v-icon>
                                        Disable All
                                    </v-btn>
                                </v-col>
                            </v-row>

                            <v-row dense>
                                <v-col cols="6" sm="4" md="3" lg="2" v-for="category in categories" :key="category.id">
                                    <v-card variant="outlined" class="pa-2 category-card"
                                        :class="{ 'bg-success-lighten-4': category.enabled }">
                                        <div class="d-flex align-center h-100">
                                            <v-checkbox v-model="category.enabled" color="primary" hide-details
                                                density="compact" @change="saveCategoryStates" />
                                            <div class="flex-grow-1 ml-1 d-flex align-center justify-space-between">
                                                <span class="text-caption font-weight-medium">{{ category.name }}</span>
                                                <v-btn icon variant="text" size="x-small"
                                                    @click.stop="showCategoryInfo(category)">
                                                    <v-icon size="small" :color="category.warning ? 'warning' : 'info'">
                                                        {{ category.warning ? 'mdi-alert-circle' : 'mdi-information' }}
                                                    </v-icon>
                                                </v-btn>
                                            </div>
                                        </div>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <!-- Control Panel -->
        <v-row class="mb-4">
            <v-col cols="12">
                <v-card>
                    <v-card-text>
                        <v-row align="center">
                            <!-- Scan button -->
                            <v-col cols="auto">
                                <v-btn :color="isScanning ? 'error' : 'primary'"
                                    :disabled="isDeleting || !hasEnabledCategories"
                                    @click="isScanning ? stopScan() : startScan()">
                                    <v-icon left>{{ isScanning ? 'mdi-stop' : 'mdi-magnify' }}</v-icon>
                                    {{ isScanning ? 'Stop' : 'Scan Projects' }}
                                </v-btn>
                            </v-col>

                            <!-- Select / deselect -->
                            <v-col cols="auto">
                                <v-btn variant="outlined" :disabled="projects.length === 0 || isScanning || isDeleting"
                                    @click="selectAll">
                                    Select All
                                </v-btn>
                            </v-col>
                            <v-col cols="auto">
                                <v-btn variant="outlined" :disabled="projects.length === 0 || isScanning || isDeleting"
                                    @click="deselectAll">
                                    Deselect All
                                </v-btn>
                            </v-col>

                            <!-- Base Path Selection -->
                            <v-col cols="auto">
                                <v-btn variant="outlined" :disabled="isScanning || isDeleting" @click="selectBasePath">
                                    <v-icon left>mdi-folder-open</v-icon>
                                    Add Base Path
                                </v-btn>
                            </v-col>

                            <!-- Clear All Paths -->
                            <v-col cols="auto" v-if="basePaths.length > 1">
                                <v-btn variant="outlined" :disabled="isScanning || isDeleting" @click="clearAllPaths"
                                    color="warning" size="small">
                                    <v-icon left size="small">mdi-delete-sweep</v-icon>
                                    Clear All
                                </v-btn>
                            </v-col>

                            <v-spacer />

                            <!-- Current base paths -->
                            <v-col cols="auto" v-if="basePaths.length > 0">
                                <div class="d-flex flex-wrap ga-2">
                                    <v-tooltip v-for="path in basePaths" :key="path" :text="path" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-chip v-bind="props" color="info" size="small" closable
                                                @click:close="removeBasePath(path)">
                                                <v-icon start size="small">mdi-folder</v-icon>
                                                {{ path.split('/').pop() || path.split('\\').pop() }}
                                            </v-chip>
                                        </template>
                                    </v-tooltip>
                                </div>
                            </v-col>

                            <!-- Spinner when scanning -->
                            <v-col cols="auto" v-if="isScanning">
                                <v-progress-circular indeterminate color="primary" size="24" />
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- Results Table -->
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>
                        <v-icon left>mdi-folder-multiple</v-icon>
                        Development Projects ({{ projects.length }})
                        <v-spacer />
                        <v-chip v-if="selectedProjects.length > 0" color="primary">
                            {{ selectedProjects.length }} selected
                        </v-chip>
                    </v-card-title>
                    <v-card-text>
                        <v-data-table v-model="selectedProjects" :headers="headers" :items="projects"
                            :loading="isScanning" show-select item-value="path" class="elevation-1">
                            <template v-slot:item.type="{ item }">
                                <v-chip size="small" :color="getTypeColor(item.type)">
                                    {{ item.type }}
                                </v-chip>
                            </template>
                            <template v-slot:item.size="{ item }">
                                {{ formatSize(item.totalCacheSize) }}
                            </template>
                            <template v-slot:item.cacheInfo="{ item }">
                                <div class="text-caption">
                                    <div v-for="cache in item.caches" :key="cache.path" class="mb-1">
                                        <strong>{{ cache.type }}:</strong> {{ formatSize(cache.size) }}
                                    </div>
                                </div>
                            </template>
                        </v-data-table>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- Category Info Dialog -->
        <v-dialog v-model="showInfoDialog" max-width="600">
            <v-card v-if="selectedCategory">
                <v-card-title class="d-flex align-center">
                    <span>{{ selectedCategory.name }}</span>
                    <v-spacer />
                    <v-chip v-if="selectedCategory.warning" size="small" color="warning">
                        <v-icon start size="small">mdi-alert</v-icon>
                        Caution Required
                    </v-chip>
                </v-card-title>

                <v-card-text>
                    <v-row>
                        <v-col cols="12">
                            <div class="mb-4">
                                <h4 class="text-subtitle-1 mb-2">Detection Files</h4>
                                <v-chip-group>
                                    <v-chip v-for="file in selectedCategory.detectionFiles" :key="file" size="small"
                                        variant="outlined">
                                        {{ file }}
                                    </v-chip>
                                </v-chip-group>
                            </div>

                            <div class="mb-4">
                                <h4 class="text-subtitle-1 mb-2">Cache Patterns to Clean</h4>
                                <v-chip-group>
                                    <v-chip v-for="pattern in selectedCategory.cachePatterns" :key="pattern"
                                        size="small" color="error" variant="outlined">
                                        {{ pattern }}
                                    </v-chip>
                                </v-chip-group>
                            </div>

                            <div v-if="selectedCategory.warning" class="mb-4">
                                <h4 class="text-subtitle-1 mb-2">⚠️ Warning</h4>
                                <v-alert type="warning" variant="tonal" class="text-body-2">
                                    {{ selectedCategory.warningText }}
                                </v-alert>
                            </div>
                        </v-col>
                    </v-row>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="showInfoDialog = false">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// Reactive state
const projects = ref([])
const selectedProjects = ref([])
const isScanning = ref(false)
const isDeleting = ref(false)
const basePaths = ref([])
const showCategories = ref(false)
const showInfoDialog = ref(false)
const selectedCategory = ref(null)

// Emit events to parent
const emit = defineEmits(['update:statusText', 'showNotification'])

// localStorage keys
const STORAGE_KEYS = {
    CATEGORIES: 'developer-cleaner-categories',
    SHOW_CATEGORIES: 'developer-cleaner-show-categories',
    BASE_PATHS: 'developer-cleaner-base-paths',
    SELECTED_PROJECTS: 'developer-cleaner-selected-projects'
}

// Developer categories configuration
const categories = ref([
    {
        id: 'python',
        name: '🐍 Python',
        enabled: true,
        detectionFiles: ['main.py', 'requirements.txt', 'pyproject.toml', '.venv/', '*.py'],
        cachePatterns: ['__pycache__/', '.pytest_cache/', '.mypy_cache/', '.tox/', '.hypothesis/', '.coverage', 'build/', 'dist/'],
        warning: true,
        warningText: 'venv/ might be the main virtual environment – be careful if no lockfile exists'
    },
    {
        id: 'nodejs',
        name: '🟨 Node.js / JavaScript / TypeScript',
        enabled: true,
        detectionFiles: ['package.json', 'yarn.lock', 'vite.config.js', 'next.config.js', 'tsconfig.json'],
        cachePatterns: ['node_modules/', 'dist/', 'build/', '.next/', '.nuxt/', '.angular/', '.vite/', '.turbo/', '.expo/', '.parcel-cache/', '.eslintcache', '.cache/'],
        warning: true,
        warningText: 'node_modules/ may exist in subfolders if using monorepos'
    },
    {
        id: 'rust',
        name: '🦀 Rust',
        enabled: true,
        detectionFiles: ['Cargo.toml', 'Cargo.lock'],
        cachePatterns: ['target/', '.cargo/.package-cache/'],
        warning: false
    },
    {
        id: 'java',
        name: '☕ Java / Kotlin / Android',
        enabled: true,
        detectionFiles: ['build.gradle', 'pom.xml', 'AndroidManifest.xml', 'src/main/java/'],
        cachePatterns: ['build/', 'out/', '.gradle/', '.idea/', 'target/', '.settings/'],
        warning: true,
        warningText: '.idea/ may contain custom settings — remove only cache/temp files inside'
    },
    {
        id: 'dotnet',
        name: '⚙️ .NET / C#',
        enabled: true,
        detectionFiles: ['.csproj', '*.sln', 'Program.cs'],
        cachePatterns: ['bin/', 'obj/', 'TestResults/'],
        warning: false
    },
    {
        id: 'cpp',
        name: '🧪 C/C++',
        enabled: true,
        detectionFiles: ['CMakeLists.txt', 'Makefile', '.vscode/launch.json', '*.cpp', '*.h'],
        cachePatterns: ['build/', 'CMakeFiles/', 'cmake-build-debug/', 'cmake-build-release/', 'Debug/', 'Release/'],
        warning: true,
        warningText: 'build/ might be used manually — check first'
    },
    {
        id: 'xcode',
        name: '📱 Xcode / iOS / macOS',
        enabled: true,
        detectionFiles: ['*.xcodeproj', 'Info.plist', 'Podfile', '*.swift'],
        cachePatterns: ['DerivedData/', 'build/', '*.xcuserdata/', '*.xcuserdatad/'],
        warning: true,
        warningText: 'Global DerivedData/ lives in ~/Library/Developer/Xcode/DerivedData'
    },
    {
        id: 'unity',
        name: '🎮 Unity',
        enabled: true,
        detectionFiles: ['Assets/', 'ProjectSettings/', 'Packages/', '*.unity'],
        cachePatterns: ['Library/', 'Temp/', 'Obj/', 'Build/', 'Builds/', '.vs/', 'Logs/', 'MemoryCaptures/', 'UserSettings/'],
        warning: true,
        warningText: 'Library/ is only needed at the Unity project root — safe elsewhere'
    },
    {
        id: 'unreal',
        name: '🎮 Unreal Engine',
        enabled: true,
        detectionFiles: ['*.uproject', 'Source/', 'Content/'],
        cachePatterns: ['Binaries/', 'Build/', 'Intermediate/', 'Saved/', 'DerivedDataCache/', 'Plugins/**/Intermediate/', 'Plugins/**/Binaries/'],
        warning: true,
        warningText: 'Saved/Config/ might contain useful settings — review before deleting'
    },
    {
        id: 'php',
        name: '🐘 PHP / Laravel',
        enabled: true,
        detectionFiles: ['artisan', 'composer.json', 'routes/web.php', 'app/'],
        cachePatterns: ['vendor/', 'bootstrap/cache/', 'storage/framework/cache/', '.phpunit.result.cache'],
        warning: true,
        warningText: 'Only delete vendor/ if composer.lock is present'
    },
    {
        id: 'symfony',
        name: '🐘 Symfony',
        enabled: true,
        detectionFiles: ['bin/console', 'config/', 'composer.json', 'symfony.lock'],
        cachePatterns: ['var/cache/', 'var/logs/', 'vendor/'],
        warning: false
    },
    {
        id: 'ml',
        name: '🧠 Machine Learning / Data Science',
        enabled: true,
        detectionFiles: ['.ipynb', 'notebooks/', 'train.py', 'requirements.txt', 'wandb/'],
        cachePatterns: ['checkpoints/', 'runs/', 'logs/', '.ipynb_checkpoints/', '.cache/', 'wandb/', 'mlruns/'],
        warning: true,
        warningText: "Don't delete checkpoints unless you're sure they're not needed"
    },
    {
        id: 'docker',
        name: '⚙️ Docker / DevOps',
        enabled: true,
        detectionFiles: ['Dockerfile', 'docker-compose.yml', '.env', '.docker/'],
        cachePatterns: ['tmp/', '.cache/', 'coverage/', 'report/'],
        warning: false
    },
    {
        id: 'static',
        name: '🌐 Static Site Generators',
        enabled: true,
        detectionFiles: ['gatsby-config.js', 'config.toml', '_config.yml', 'content/'],
        cachePatterns: ['public/', '.cache/', 'dist/'],
        warning: false
    },
    {
        id: 'testing',
        name: '🧪 Testing Tools',
        enabled: true,
        detectionFiles: ['jest.config.js', 'pytest.ini', '.coveragerc', 'tests/'],
        cachePatterns: ['.coverage/', 'coverage/', 'reports/', '.nyc_output/', '.jest/', '.test_cache/'],
        warning: false
    },
    {
        id: 'ides',
        name: '🧰 IDEs / Editors',
        enabled: true,
        detectionFiles: ['.idea/', '.vscode/', '.history/', '*.sublime-*', '.DS_Store'],
        cachePatterns: ['.idea/workspace.xml', '.idea/caches/', '.vscode/ipch/', '.DS_Store', 'Thumbs.db'],
        warning: true,
        warningText: "Don't remove .idea/modules.xml or .vscode/settings.json if project-specific"
    }
])

// Computed properties
const hasEnabledCategories = computed(() =>
    categories.value.some(cat => cat.enabled)
)

const enabledCount = computed(() =>
    categories.value.filter(cat => cat.enabled).length
)

const headers = [
    { title: 'Project Path', key: 'path', sortable: true },
    { title: 'Type', key: 'type', sortable: true },
    { title: 'Cache Size', key: 'size', sortable: true },
    { title: 'Cache Details', key: 'cacheInfo', sortable: false },
]

// Methods
const saveCategoryStates = () => {
    const states = {}
    categories.value.forEach(cat => {
        states[cat.id] = cat.enabled
    })
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(states))
}

const loadCategoryStates = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
        if (stored) {
            const states = JSON.parse(stored)
            categories.value.forEach(cat => {
                if (states.hasOwnProperty(cat.id)) {
                    cat.enabled = states[cat.id]
                }
            })
        }
    } catch (error) {
        console.error('Error loading category states:', error)
    }
}

const enableAll = () => {
    categories.value.forEach(cat => cat.enabled = true)
    saveCategoryStates()
}

const disableAll = () => {
    categories.value.forEach(cat => cat.enabled = false)
    saveCategoryStates()
}

const showCategoryInfo = (category) => {
    selectedCategory.value = category
    showInfoDialog.value = true
}

const selectAll = () => {
    selectedProjects.value = projects.value.map(p => p.path)
    saveSelectedProjects()
}

const deselectAll = () => {
    selectedProjects.value = []
    saveSelectedProjects()
}

const selectBasePath = async () => {
    try {
        if (!window.electronAPI.selectDirectory) {
            emit('showNotification', 'Directory selection not yet implemented', 'warning')
            return
        }
        const result = await window.electronAPI.selectDirectory()
        if (result) {
            // Check for duplicates
            if (!basePaths.value.includes(result)) {
                basePaths.value.push(result)
                saveBasePaths()
                emit('showNotification', 'Base path added successfully', 'success')
            } else {
                emit('showNotification', 'Path already exists', 'warning')
            }
        }
    } catch (error) {
        emit('showNotification', 'Error selecting directory: ' + error.message, 'error')
    }
}

const startScan = async () => {
    if (basePaths.value.length === 0) {
        emit('showNotification', 'Please select at least one base path first', 'warning')
        return
    }

    if (!window.electronAPI.scanDeveloperCaches) {
        emit('showNotification', 'Developer cache scanning not yet implemented', 'warning')
        return
    }

    try {
        isScanning.value = true
        projects.value = []
        // Don't clear selected projects here - we'll preserve valid selections

        const pathCount = basePaths.value.length
        const pathText = pathCount === 1 ? '1 path' : `${pathCount} paths`
        emit('update:statusText', `Scanning ${pathText} for development projects...`)

        const enabledCategories = categories.value.filter(cat => cat.enabled)
        const result = await window.electronAPI.scanDeveloperCaches(basePaths.value, enabledCategories)

        projects.value = result.sort((a, b) => b.totalCacheSize - a.totalCacheSize)

        // Preserve existing selections that are still valid
        const validPaths = new Set(projects.value.map(p => p.path))
        selectedProjects.value = selectedProjects.value.filter(path => validPaths.has(path))
        saveSelectedProjects()

        const message = projects.value.length > 0
            ? `Found ${projects.value.length} development projects across ${pathText}`
            : `No development projects found in ${pathText}`

        emit('showNotification', message, projects.value.length > 0 ? 'success' : 'info')
        emit('update:statusText', message)

    } catch (error) {
        console.error('Scan error:', error)
        emit('showNotification', 'Error during scan: ' + error.message, 'error')
    } finally {
        isScanning.value = false
    }
}

const stopScan = async () => {
    emit('update:statusText', 'Stopping scan...')
    try {
        if (window.electronAPI.stopDeveloperScan) {
            await window.electronAPI.stopDeveloperScan()
            emit('showNotification', 'Scan stopped by user', 'info')
        } else {
            emit('showNotification', 'Scan stopped', 'info')
        }
    } catch (error) {
        emit('showNotification', 'Error stopping scan: ' + error.message, 'error')
    } finally {
        isScanning.value = false
    }
}

const getTypeColor = (type) => {
    const colors = {
        'Python': 'green',
        'Node.js': 'yellow',
        'Rust': 'orange',
        'Java': 'red',
        '.NET': 'purple',
        'C++': 'blue',
        'Xcode': 'cyan',
        'Unity': 'indigo',
        'Unreal': 'pink',
        'PHP': 'purple',
        'Symfony': 'deep-purple',
        'Machine Learning': 'teal',
        'Docker': 'blue-grey',
        'Static Sites': 'light-green',
        'Testing': 'amber',
        'IDEs': 'brown'
    }
    return colors[type] || 'grey'
}

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const removeBasePath = (path) => {
    basePaths.value = basePaths.value.filter(p => p !== path)
    saveBasePaths()
}

const saveBasePaths = () => {
    localStorage.setItem(STORAGE_KEYS.BASE_PATHS, JSON.stringify(basePaths.value))
}

const loadBasePaths = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.BASE_PATHS)
        if (stored) {
            const paths = JSON.parse(stored)
            if (Array.isArray(paths)) {
                basePaths.value = paths
            }
        }
    } catch (error) {
        console.error('Error loading base paths:', error)
    }
}

const saveSelectedProjects = () => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_PROJECTS, JSON.stringify(selectedProjects.value))
}

const loadSelectedProjects = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_PROJECTS)
        if (stored) {
            const selected = JSON.parse(stored)
            if (Array.isArray(selected)) {
                selectedProjects.value = selected
            }
        }
    } catch (error) {
        console.error('Error loading selected projects:', error)
    }
}

const clearAllPaths = () => {
    basePaths.value = []
    saveBasePaths()
    emit('showNotification', 'All base paths cleared', 'info')
}

// Set default base paths on mount and load saved states
onMounted(async () => {
    // Load saved category states
    loadCategoryStates()

    // Load show categories preference
    const showCategoriesStored = localStorage.getItem(STORAGE_KEYS.SHOW_CATEGORIES)
    if (showCategoriesStored !== null) {
        showCategories.value = JSON.parse(showCategoriesStored)
    }

    // Load saved base paths
    loadBasePaths()

    // Load saved selected projects
    loadSelectedProjects()

    // If no saved paths, set default
    if (basePaths.value.length === 0) {
        try {
            // Try to get user home if the API method exists
            if (window.electronAPI.getUserHome) {
                const userHome = await window.electronAPI.getUserHome()
                basePaths.value = [userHome]
            } else {
                // Fallback to common paths
                const isWindows = navigator.platform.indexOf('Win') > -1
                basePaths.value = isWindows ? ['C:\\Users\\'] : ['/home/']
            }
            saveBasePaths()
        } catch (error) {
            console.error('Error getting user home:', error)
            // Fallback to common paths
            const isWindows = navigator.platform.indexOf('Win') > -1
            basePaths.value = isWindows ? ['C:\\Users\\'] : ['/home/']
            saveBasePaths()
        }
    }
})

// Watch for changes in showCategories and save to localStorage
watch(showCategories, (newValue) => {
    localStorage.setItem(STORAGE_KEYS.SHOW_CATEGORIES, JSON.stringify(newValue))
})

// Watch for changes in selectedProjects and save to localStorage
watch(selectedProjects, (newValue) => {
    saveSelectedProjects()
}, { deep: true })
</script>

<style scoped>
.rotate-90 {
    transform: rotate(90deg);
}

.transition-transform {
    transition: transform 0.2s ease;
}

.cursor-pointer {
    cursor: pointer;
}

.category-card {
    height: 48px;
    min-height: 48px;
}
</style>