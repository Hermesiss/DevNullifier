<template>
    <div>
        <!-- Categories Panel -->
        <v-row class="mb-4">
            <v-col cols="12">
                <v-card>
                    <v-card-title>
                        <v-icon left>mdi-cog</v-icon>
                        Development Categories
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-col cols="12" md="6" lg="4" v-for="category in categories" :key="category.id">
                                <v-card variant="outlined" class="h-100">
                                    <v-card-text class="pb-2">
                                        <div class="d-flex align-center mb-2">
                                            <v-checkbox v-model="category.enabled" :label="category.name"
                                                color="primary" hide-details class="flex-grow-0" />
                                            <v-spacer />
                                            <v-chip size="small" :color="category.enabled ? 'success' : 'default'">
                                                {{ category.enabled ? 'Enabled' : 'Disabled' }}
                                            </v-chip>
                                        </div>
                                        <div class="text-caption text-medium-emphasis mb-2">
                                            <strong>Detects:</strong> {{ category.detectionFiles.slice(0, 3).join(', ')
                                            }}
                                            <span v-if="category.detectionFiles.length > 3">...</span>
                                        </div>
                                        <div class="text-caption text-medium-emphasis">
                                            <strong>Cleans:</strong> {{ category.cachePatterns.slice(0, 3).join(', ') }}
                                            <span v-if="category.cachePatterns.length > 3">...</span>
                                        </div>
                                        <v-chip v-if="category.warning" size="x-small" color="warning" class="mt-1">
                                            <v-icon start size="x-small">mdi-alert</v-icon>
                                            Caution Required
                                        </v-chip>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                        <v-row class="mt-2">
                            <v-col cols="auto">
                                <v-btn variant="outlined" @click="enableAll">
                                    <v-icon left>mdi-check-all</v-icon>
                                    Enable All
                                </v-btn>
                            </v-col>
                            <v-col cols="auto">
                                <v-btn variant="outlined" @click="disableAll">
                                    <v-icon left>mdi-close-box-multiple</v-icon>
                                    Disable All
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-card-text>
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
                                    Choose Base Path
                                </v-btn>
                            </v-col>

                            <v-spacer />

                            <!-- Current base path -->
                            <v-col cols="auto" v-if="basePath">
                                <v-chip color="info" size="small">
                                    <v-icon start size="small">mdi-folder</v-icon>
                                    {{ basePath.split('/').pop() || basePath.split('\\').pop() }}
                                </v-chip>
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
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// Reactive state
const projects = ref([])
const selectedProjects = ref([])
const isScanning = ref(false)
const isDeleting = ref(false)
const basePath = ref('')

// Emit events to parent
const emit = defineEmits(['update:statusText', 'showNotification'])

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

const headers = [
    { title: 'Project Path', key: 'path', sortable: true },
    { title: 'Type', key: 'type', sortable: true },
    { title: 'Cache Size', key: 'size', sortable: true },
    { title: 'Cache Details', key: 'cacheInfo', sortable: false },
]

// Methods
const enableAll = () => {
    categories.value.forEach(cat => cat.enabled = true)
}

const disableAll = () => {
    categories.value.forEach(cat => cat.enabled = false)
}

const selectAll = () => {
    selectedProjects.value = projects.value.map(p => p.path)
}

const deselectAll = () => {
    selectedProjects.value = []
}

const selectBasePath = async () => {
    try {
        if (!window.electronAPI.selectDirectory) {
            emit('showNotification', 'Directory selection not yet implemented', 'warning')
            return
        }
        const result = await window.electronAPI.selectDirectory()
        if (result) {
            basePath.value = result
        }
    } catch (error) {
        emit('showNotification', 'Error selecting directory: ' + error.message, 'error')
    }
}

const startScan = async () => {
    if (!basePath.value) {
        emit('showNotification', 'Please select a base path first', 'warning')
        return
    }

    if (!window.electronAPI.scanDeveloperCaches) {
        emit('showNotification', 'Developer cache scanning not yet implemented', 'warning')
        return
    }

    try {
        isScanning.value = true
        projects.value = []
        selectedProjects.value = []

        emit('update:statusText', 'Scanning for development projects...')

        const enabledCategories = categories.value.filter(cat => cat.enabled)
        const result = await window.electronAPI.scanDeveloperCaches(basePath.value, enabledCategories)

        projects.value = result.sort((a, b) => b.totalCacheSize - a.totalCacheSize)

        const message = projects.value.length > 0
            ? `Found ${projects.value.length} development projects`
            : 'No development projects found'

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

// Set default base path on mount
onMounted(async () => {
    try {
        // Try to get user home if the API method exists
        if (window.electronAPI.getUserHome) {
            const userHome = await window.electronAPI.getUserHome()
            basePath.value = userHome
        } else {
            // Fallback to common paths
            const isWindows = navigator.platform.indexOf('Win') > -1
            basePath.value = isWindows ? 'C:\\Users\\' : '/home/'
        }
    } catch (error) {
        console.error('Error getting user home:', error)
        // Fallback to common paths
        const isWindows = navigator.platform.indexOf('Win') > -1
        basePath.value = isWindows ? 'C:\\Users\\' : '/home/'
    }
})
</script>