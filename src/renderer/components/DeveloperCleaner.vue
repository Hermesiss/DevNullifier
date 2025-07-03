<template>
    <div>
        <!-- Delete Dialog -->
        <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedCacheCount" :selected-size="selectedCacheSize"
            @confirm="deleteCaches" />

        <!-- Folder Tree Viewer -->
        <FolderTreeViewer v-model="showFolderTree" :folder-path="selectedFolderPath" />

        <!-- Categories Panel -->
        <CategoriesPanel ref="categoriesPanel" :initial-categories="initialCategories" @category-info="showCategoryInfo"
            @categories-changed="onCategoriesChanged" />

        <!-- Control Panel -->
        <ControlPanel ref="controlPanel" :is-scanning="isScanning" :is-deleting="isDeleting"
            :has-enabled-categories="hasEnabledCategories" @start-scan="startScan" @stop-scan="stopScan"
            @show-notification="showNotification" />

        <!-- Results Table -->
        <ResultsTable :projects="projects" :is-scanning="isScanning" :is-deleting="isDeleting"
            @open-folder-tree="openFolderTree" @cache-selection-changed="onCacheSelectionChanged" />

        <!-- Category Info Dialog -->
        <CategoryInfoDialog v-model="showInfoDialog" :category="selectedCategory" />

        <!-- Actions Bar -->
        <v-footer app class="pa-0">
            <ActionsBar :status-text="statusText" :delete-progress="0" :selected-count="selectedCacheCount"
                :is-scanning="isScanning" :is-deleting="isDeleting" @delete="confirmDelete" />
        </v-footer>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import CategoriesPanel from './DeveloperCleaner/CategoriesPanel.vue'
import ControlPanel from './DeveloperCleaner/ControlPanel.vue'
import ResultsTable from './DeveloperCleaner/ResultsTable.vue'
import CategoryInfoDialog from './DeveloperCleaner/CategoryInfoDialog.vue'

// Reactive state
const projects = ref([])
const isScanning = ref(false)
const isDeleting = ref(false)
const showInfoDialog = ref(false)
const selectedCategory = ref(null)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref('Ready')
const categories = ref([])
const hasEnabledCategories = ref(false)

// Component refs
const categoriesPanel = ref(null)
const controlPanel = ref(null)

// Emit events to parent
const emit = defineEmits(['showNotification'])

// Developer categories configuration
const initialCategories = [
    {
        id: 'python',
        name: 'Python',
        enabled: true,
        detectionFiles: ['main.py', 'requirements.txt', 'pyproject.toml', '.venv/', '*.py'],
        cachePatterns: ['__pycache__/', '.pytest_cache/', '.mypy_cache/', '.tox/', '.hypothesis/', '.coverage', 'build/', 'dist/'],
        warning: true,
        warningText: 'venv/ might be the main virtual environment – be careful if no lockfile exists'
    },
    {
        id: 'nodejs',
        name: 'Node.js / JS / TS',
        enabled: true,
        detectionFiles: ['package.json', 'yarn.lock', 'vite.config.js', 'next.config.js', 'tsconfig.json'],
        cachePatterns: ['node_modules/', 'dist/', 'build/', '.next/', '.nuxt/', '.angular/', '.vite/', '.turbo/', '.expo/', '.parcel-cache/', '.eslintcache', '.cache/'],
        warning: true,
        warningText: 'node_modules/ may exist in subfolders if using monorepos'
    },
    {
        id: 'unity',
        name: 'Unity',
        enabled: true,
        detectionFiles: ['Assets/', 'ProjectSettings/', 'Packages/', '*.unity'],
        cachePatterns: ['Library/', 'Temp/', 'Obj/', 'Build/', 'Builds/', '.vs/', 'Logs/', 'MemoryCaptures/', 'UserSettings/'],
        warning: true,
        warningText: 'Library/ is only needed at the Unity project root — safe elsewhere'
    },
    {
        id: 'unreal',
        name: 'Unreal Engine',
        enabled: true,
        detectionFiles: ['*.uproject', 'Source/', 'Content/'],
        cachePatterns: ['Binaries/', 'Build/', 'Intermediate/', 'Saved/', 'DerivedDataCache/', 'Plugins/**/Intermediate/', 'Plugins/**/Binaries/'],
        warning: true,
        warningText: 'Saved/Config/ might contain useful settings — review before deleting'
    },
    {
        id: 'rust',
        name: 'Rust',
        enabled: true,
        detectionFiles: ['Cargo.toml', 'Cargo.lock'],
        cachePatterns: ['target/', '.cargo/.package-cache/'],
        warning: false
    },
    {
        id: 'java',
        name: 'Java / Kotlin / Android',
        enabled: true,
        detectionFiles: ['build.gradle', 'pom.xml', 'AndroidManifest.xml', 'src/main/java/'],
        cachePatterns: ['build/', 'out/', '.gradle/', '.idea/', 'target/', '.settings/'],
        warning: true,
        warningText: '.idea/ may contain custom settings — remove only cache/temp files inside'
    },
    {
        id: 'dotnet',
        name: '.NET / C#',
        enabled: true,
        detectionFiles: ['.csproj', '*.sln', 'Program.cs'],
        cachePatterns: ['bin/', 'obj/', 'TestResults/'],
        warning: false
    },
    {
        id: 'cpp',
        name: 'C/C++',
        enabled: true,
        detectionFiles: ['CMakeLists.txt', 'Makefile', '.vscode/launch.json', '*.cpp', '*.h'],
        cachePatterns: ['build/', 'CMakeFiles/', 'cmake-build-debug/', 'cmake-build-release/', 'Debug/', 'Release/'],
        warning: true,
        warningText: 'build/ might be used manually — check first'
    },
    {
        id: 'xcode',
        name: 'Xcode / iOS / macOS',
        enabled: true,
        detectionFiles: ['*.xcodeproj', 'Info.plist', 'Podfile', '*.swift'],
        cachePatterns: ['DerivedData/', 'build/', '*.xcuserdata/', '*.xcuserdatad/'],
        warning: true,
        warningText: 'Global DerivedData/ lives in ~/Library/Developer/Xcode/DerivedData'
    },
    {
        id: 'php',
        name: 'PHP / Laravel',
        enabled: true,
        detectionFiles: ['artisan', 'composer.json', 'routes/web.php', 'app/'],
        cachePatterns: ['vendor/', 'bootstrap/cache/', 'storage/framework/cache/', '.phpunit.result.cache'],
        warning: true,
        warningText: 'Only delete vendor/ if composer.lock is present'
    },
    {
        id: 'symfony',
        name: 'Symfony',
        enabled: true,
        detectionFiles: ['bin/console', 'config/', 'composer.json', 'symfony.lock'],
        cachePatterns: ['var/cache/', 'var/logs/', 'vendor/'],
        warning: false
    },
    {
        id: 'ml',
        name: 'ML / Data Science',
        enabled: true,
        detectionFiles: ['.ipynb', 'notebooks/', 'train.py', 'requirements.txt', 'wandb/'],
        cachePatterns: ['checkpoints/', 'runs/', 'logs/', '.ipynb_checkpoints/', '.cache/', 'wandb/', 'mlruns/'],
        warning: true,
        warningText: "Don't delete checkpoints unless you're sure they're not needed"
    },
    {
        id: 'docker',
        name: 'Docker / DevOps',
        enabled: true,
        detectionFiles: ['Dockerfile', 'docker-compose.yml', '.env', '.docker/'],
        cachePatterns: ['tmp/', '.cache/', 'coverage/', 'report/'],
        warning: false
    },
    {
        id: 'static',
        name: 'Static Site Generators',
        enabled: true,
        detectionFiles: ['gatsby-config.js', 'config.toml', '_config.yml', 'content/'],
        cachePatterns: ['public/', '.cache/', 'dist/'],
        warning: false
    },
    {
        id: 'testing',
        name: 'Testing Tools',
        enabled: true,
        detectionFiles: ['jest.config.js', 'pytest.ini', '.coveragerc', 'tests/'],
        cachePatterns: ['.coverage/', 'coverage/', 'reports/', '.nyc_output/', '.jest/', '.test_cache/'],
        warning: false
    },
    {
        id: 'ides',
        name: 'IDEs / Editors',
        enabled: true,
        detectionFiles: ['.idea/', '.vscode/', '.history/', '*.sublime-*', '.DS_Store'],
        cachePatterns: ['.idea/workspace.xml', '.idea/caches/', '.vscode/ipch/', '.DS_Store', 'Thumbs.db'],
        warning: true,
        warningText: "Don't remove .idea/modules.xml or .vscode/settings.json if project-specific"
    }
]

// Computed properties
const selectedCacheCount = computed(() => {
    return projects.value.reduce((total, project) => {
        return total + project.caches.reduce((groupTotal, group) => {
            return groupTotal + group.matches.filter(match => match.selected).length
        }, 0)
    }, 0)
})

const selectedCacheSize = computed(() => {
    return projects.value.reduce((total, project) => {
        return total + (project.selectedCacheSize || 0)
    }, 0)
})

// Methods
const showNotification = (message, type = 'info') => {
    emit('showNotification', message, type)
}

const showCategoryInfo = (category) => {
    selectedCategory.value = category
    showInfoDialog.value = true
}

const onCategoriesChanged = (updatedCategories) => {
    categories.value = updatedCategories
    hasEnabledCategories.value = updatedCategories.some(cat => cat.enabled)
}

const onCacheSelectionChanged = () => {
    // Update project cache sizes when selections change
    projects.value.forEach(project => {
        project.selectedCacheSize = project.caches
            .reduce((sum, group) => sum + group.selectedSize, 0)
    })
}

const openFolderTree = (folderPath) => {
    selectedFolderPath.value = folderPath
    showFolderTree.value = true
}

const startScan = async (basePaths) => {
    if (!window.electronAPI.scanDeveloperCaches) {
        showNotification('Developer cache scanning not yet implemented', 'warning')
        return
    }

    try {
        isScanning.value = true
        projects.value = []

        // Clean up any existing listeners
        if (window.electronAPI.removeAllListeners) {
            window.electronAPI.removeAllListeners('developer-project-found')
        }

        const pathCount = basePaths.length
        const pathText = pathCount === 1 ? '1 path' : `${pathCount} paths`
        statusText.value = `Scanning ${pathText} for development projects...`

        // Create serializable data - convert Vue reactive arrays to plain arrays/objects
        const plainBasePaths = [...basePaths]
        const enabledCategories = categories.value
            .filter(cat => cat.enabled)
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                detectionFiles: [...cat.detectionFiles],
                cachePatterns: [...cat.cachePatterns],
                warning: cat.warning,
                warningText: cat.warningText
            }))

        // Listen for real-time project updates
        const handleProjectFound = (project) => {
            const processedProject = processProject(project)

            // Check if project already exists (avoid duplicates)
            const existingIndex = projects.value.findIndex(p => p.path === project.path)
            if (existingIndex === -1) {
                projects.value.push(processedProject)
                // Keep sorted by total cache size
                projects.value.sort((a, b) => b.totalCacheSize - a.totalCacheSize)
            }
        }

        // Set up real-time listener
        if (window.electronAPI.onDeveloperProjectFound) {
            window.electronAPI.onDeveloperProjectFound(handleProjectFound)
        }

        const result = await window.electronAPI.scanDeveloperCaches(plainBasePaths, enabledCategories)

        // Process any remaining projects not caught by real-time updates
        result.forEach(project => {
            const existingIndex = projects.value.findIndex(p => p.path === project.path)
            if (existingIndex === -1) {
                const processedProject = processProject(project)
                projects.value.push(processedProject)
            }
        })

        // Final sort
        projects.value.sort((a, b) => b.totalCacheSize - a.totalCacheSize)

        const message = projects.value.length > 0
            ? `Found ${projects.value.length} development projects across ${pathText}`
            : `No development projects found in ${pathText}`

        showNotification(message, projects.value.length > 0 ? 'success' : 'info')
        statusText.value = message

    } catch (error) {
        console.error('Scan error:', error)
        showNotification('Error during scan: ' + error.message, 'error')
    } finally {
        isScanning.value = false
    }
}

const rescanSpecificProjects = async (projectPaths) => {
    if (!window.electronAPI.scanDeveloperCaches) {
        showNotification('Developer cache scanning not yet implemented', 'warning')
        return
    }

    try {
        statusText.value = `Updating ${projectPaths.length} project${projectPaths.length === 1 ? '' : 's'}...`

        // Create serializable data - convert Vue reactive arrays to plain arrays/objects
        const enabledCategories = categories.value
            .filter(cat => cat.enabled)
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                detectionFiles: [...cat.detectionFiles],
                cachePatterns: [...cat.cachePatterns],
                warning: cat.warning,
                warningText: cat.warningText
            }))

        // Scan only the specific project paths
        const result = await window.electronAPI.scanDeveloperCaches(projectPaths, enabledCategories)

        // Update only the scanned projects in the existing list
        result.forEach(scannedProject => {
            const existingIndex = projects.value.findIndex(p => p.path === scannedProject.path)
            if (existingIndex !== -1) {
                // Update existing project
                const processedProject = processProject(scannedProject)
                projects.value[existingIndex] = processedProject
            }
        })

        // Re-sort the entire list by total cache size
        projects.value.sort((a, b) => b.totalCacheSize - a.totalCacheSize)

        statusText.value = `Updated ${projectPaths.length} project${projectPaths.length === 1 ? '' : 's'}`

    } catch (error) {
        console.error('Rescan error:', error)
        showNotification('Error during project update: ' + error.message, 'error')
    }
}

const stopScan = async () => {
    statusText.value = 'Stopping scan...'
    try {
        if (window.electronAPI.stopDeveloperScan) {
            await window.electronAPI.stopDeveloperScan()
            showNotification('Scan stopped by user', 'info')
        } else {
            showNotification('Scan stopped', 'info')
        }
    } catch (error) {
        showNotification('Error stopping scan: ' + error.message, 'error')
    } finally {
        isScanning.value = false
    }
}

// Helper function to process projects
const processProject = (project) => {
    const processedCaches = project.caches
        .map(cacheGroup => ({
            ...cacheGroup,
            // Ensure all matches have selection state
            matches: cacheGroup.matches.map(match => ({
                ...match,
                selected: match.selected || false
            })),
            selectedSize: 0, // Will be calculated below
            expanded: false // Default to collapsed
        }))
        .sort((a, b) => b.totalSize - a.totalSize) // Sort cache groups by total size

    // Calculate selected sizes for each group
    processedCaches.forEach(cacheGroup => {
        cacheGroup.selectedSize = cacheGroup.matches
            .filter(match => match.selected)
            .reduce((sum, match) => sum + match.size, 0)
    })

    return {
        ...project,
        caches: processedCaches,
        totalCacheSize: processedCaches.reduce((sum, cacheGroup) => sum + cacheGroup.totalSize, 0),
        selectedCacheSize: processedCaches.reduce((sum, cacheGroup) => sum + cacheGroup.selectedSize, 0)
    }
}

// Delete functionality
const confirmDelete = () => {
    if (selectedCacheCount.value === 0) {
        showNotification('No caches selected for deletion', 'warning')
        return
    }
    showDeleteDialog.value = true
}

const deleteCaches = async () => {
    showDeleteDialog.value = false
    isDeleting.value = true
    statusText.value = 'Preparing to delete selected caches...'

    try {
        // Collect all selected cache paths from all projects
        const selectedCachePaths = []
        projects.value.forEach(project => {
            project.caches.forEach(cacheGroup => {
                cacheGroup.matches.forEach(match => {
                    if (match.selected) {
                        selectedCachePaths.push(match.path)
                    }
                })
            })
        })

        if (selectedCachePaths.length === 0) {
            showNotification('No caches selected', 'warning')
            return
        }

        statusText.value = `Deleting ${selectedCachePaths.length} cache folders...`

        const results = await window.electronAPI.deleteFolders([...selectedCachePaths])

        const successCount = results.filter(r => r.success).length
        const failCount = results.length - successCount

        let message = ''
        if (failCount === 0) {
            message = `Successfully deleted ${successCount} cache folders`
        } else if (successCount === 0) {
            message = `Failed to delete ${failCount} cache folders`
        } else {
            message = `Deleted ${successCount} cache folders, ${failCount} failed`
        }

        const parts = []
        if (successCount > 0) parts.push(`${successCount} deleted`)
        if (failCount > 0) parts.push(`${failCount} failed`)

        showNotification(message, failCount === 0 ? 'success' : 'warning')
        statusText.value = `Deletion complete: ${parts.join(', ')}`

        // Refresh only the projects that had caches deleted
        if (successCount > 0) {
            // Get unique project paths that had caches deleted
            const affectedProjectPaths = new Set()
            projects.value.forEach(project => {
                const hasDeletedCaches = project.caches.some(cacheGroup =>
                    cacheGroup.matches.some(match => match.selected)
                )
                if (hasDeletedCaches) {
                    affectedProjectPaths.add(project.path)
                }
            })

            // Rescan only the affected projects
            if (affectedProjectPaths.size > 0) {
                rescanSpecificProjects(Array.from(affectedProjectPaths))
            }
        }

    } catch (error) {
        console.error('Delete error:', error)
        showNotification('Error during deletion: ' + error.message, 'error')
        statusText.value = 'Deletion failed'
    } finally {
        isDeleting.value = false
    }
}

// Expose for parent component
defineExpose({
    confirmDelete,
    selectedCount: selectedCacheCount,
    isScanning: isScanning,
    isDeleting: isDeleting
})

// Cleanup on unmount
onUnmounted(() => {
    if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('developer-project-found')
    }
})
</script>

<style scoped>
/* Main component styles */
</style>