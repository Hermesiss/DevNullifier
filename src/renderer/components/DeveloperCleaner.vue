<template>
    <div>
        <!-- Delete Dialog -->
        <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedCacheCount" :selected-size="selectedCacheSize"
            :permanent="permanentDelete" @confirm="deleteCaches" />

        <!-- Folder Tree Viewer -->
        <FolderTreeViewer v-model="showFolderTree" :folder-path="selectedFolderPath" />

        <!-- Categories Panel -->
        <CategoriesPanel ref="categoriesPanel" :initial-categories="initialCategories" @category-info="showCategoryInfo"
            @categories-changed="onCategoriesChanged" />

        <!-- Control Panel -->
        <ControlPanel ref="controlPanel" :is-scanning="isScanning" :is-deleting="isDeleting"
            :has-enabled-categories="hasEnabledCategories" :scan-progress="scanProgress" @start-scan="startScan"
            @quick-scan="startQuickScan" @stop-scan="stopScan" @show-notification="showNotification" />

        <!-- Results Table -->
        <ResultsTable :projects="projects" :is-scanning="isScanning" :is-deleting="isDeleting"
            @open-folder-tree="openFolderTree" @cache-selection-changed="onCacheSelectionChanged" />

        <!-- Category Info Dialog -->
        <CategoryInfoDialog v-model="showInfoDialog" :category="selectedCategory" />

        <!-- Actions Bar -->
        <v-footer app class="pa-0">
            <ActionsBar v-model:permanent-delete="permanentDelete" :status-text="statusText" :delete-progress="0"
                :selected-count="selectedCacheCount" :is-scanning="isScanning" :is-deleting="isDeleting"
                @delete="confirmDelete" />
        </v-footer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { summarizeDeleteResults } from '../utils/deleteResults'
import { useI18n } from 'vue-i18n'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import CategoriesPanel from './DeveloperCleaner/CategoriesPanel.vue'
import ControlPanel from './DeveloperCleaner/ControlPanel.vue'
import ResultsTable from './DeveloperCleaner/ResultsTable.vue'
import CategoryInfoDialog from './DeveloperCleaner/CategoryInfoDialog.vue'
import type { DeveloperCategory, ProjectInfo } from '@/types'
import { useCleanerRules } from '../composables/useCleanerRules'

const { t } = useI18n()
const { permanentDelete, whenRulesSaved } = useCleanerRules()

// Reactive state
const projects = ref<ProjectInfo[]>([])
const isScanning = ref(false)
const isDeleting = ref(false)
const showInfoDialog = ref(false)
const selectedCategory = ref<DeveloperCategory | null>(null)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref(t('common.ready'))
const categories = ref<DeveloperCategory[]>([])
const hasEnabledCategories = ref(false)
const scanProgress = ref(0)

// Component refs
const categoriesPanel = ref<InstanceType<typeof CategoriesPanel> | null>(null)
const controlPanel = ref<InstanceType<typeof ControlPanel> | null>(null)

// Emit events to parent
const emit = defineEmits<{
    showNotification: [message: string, type?: string]
}>()

// Developer categories configuration
const initialCategories: DeveloperCategory[] = [
    {
        id: 'python',
        name: 'Python',
        enabled: true,
        detectionFiles: ['main.py', 'requirements.txt', 'pyproject.toml', '.venv/'],
        cachePatterns: ['__pycache__/', '.pytest_cache/', '.mypy_cache/', '.tox/', '.hypothesis/', '.coverage', 'build/', 'dist/', 'venv/', '.venv/'],
        warning: true
    },
    {
        id: 'nodejs',
        name: 'Node.js / JS / TS',
        enabled: true,
        detectionFiles: ['package.json', 'yarn.lock', 'vite.config.js', 'next.config.js', 'tsconfig.json'],
        cachePatterns: ['node_modules/', 'dist/', 'build/', '.next/', '.nuxt/', '.angular/', '.vite/', '.turbo/', '.expo/', '.parcel-cache/', '.eslintcache', '.cache/'],
        warning: true
    },
    {
        id: 'unity',
        name: 'Unity',
        enabled: true,
        detectionFiles: ['Assets/', 'ProjectSettings/', 'Packages/', '*.unity'],
        cachePatterns: ['Library/', 'Temp/', 'Obj/', 'Build/', 'Builds/', '.vs/', 'Logs/', 'MemoryCaptures/'],
        warning: true
    },
    {
        id: 'unreal',
        name: 'Unreal Engine',
        enabled: true,
        detectionFiles: ['*.uproject', 'Source/', 'Content/'],
        cachePatterns: ['Binaries/', 'Build/', 'Intermediate/', 'Saved/Logs/', 'DerivedDataCache/', 'Plugins/**/Intermediate/', 'Plugins/**/Binaries/'],
        warning: true
    },
    {
        id: 'rust',
        name: 'Rust',
        enabled: true,
        detectionFiles: ['Cargo.toml', 'Cargo.lock'],
        cachePatterns: ['target/', '.cargo/.package-cache/'],
        warning: true
    },
    {
        id: 'java',
        name: 'Java / Kotlin / Android',
        enabled: true,
        detectionFiles: ['build.gradle', 'pom.xml', 'AndroidManifest.xml', 'src/main/java/'],
        cachePatterns: ['build/', 'out/', '.gradle/', '.idea/caches/', 'target/', '.settings/'],
        warning: true
    },
    {
        id: 'dotnet',
        name: '.NET / C#',
        enabled: true,
        detectionFiles: ['*.csproj', '*.sln', 'Program.cs'],
        cachePatterns: ['bin/', 'obj/', 'TestResults/'],
        warning: true
    },
    {
        id: 'cpp',
        name: 'C/C++',
        enabled: true,
        detectionFiles: ['CMakeLists.txt', 'compile_commands.json', '.vscode/launch.json'],
        cachePatterns: ['build/', 'CMakeFiles/', 'cmake-build-debug/', 'cmake-build-release/'],
        warning: true
    },
    {
        id: 'xcode',
        name: 'Xcode / iOS / macOS',
        enabled: true,
        detectionFiles: ['*.xcodeproj', 'Info.plist', 'Podfile', '*.swift'],
        cachePatterns: ['DerivedData/', 'build/', '*.xcuserdata/', '*.xcuserdatad/'],
        warning: true
    },
    {
        id: 'php',
        name: 'PHP / Laravel',
        enabled: true,
        detectionFiles: ['artisan', 'composer.json', 'routes/web.php'],
        cachePatterns: ['vendor/', 'bootstrap/cache/', 'storage/framework/cache/', '.phpunit.result.cache'],
        warning: true
    },
    {
        id: 'symfony',
        name: 'Symfony',
        enabled: true,
        detectionFiles: ['bin/console', 'config/', 'composer.json', 'symfony.lock'],
        cachePatterns: ['var/cache/', 'var/logs/', 'vendor/'],
        warning: true
    },
    {
        id: 'ml',
        name: 'ML / Data Science',
        enabled: true,
        detectionFiles: ['.ipynb', 'notebooks/', 'train.py', 'requirements.txt'],
        cachePatterns: ['logs/', '.ipynb_checkpoints/', '.cache/'],
        warning: true
    },
    {
        id: 'docker',
        name: 'Docker / DevOps',
        enabled: true,
        detectionFiles: ['Dockerfile', 'docker-compose.yml', '.docker/'],
        cachePatterns: ['.cache/', 'coverage/', 'report/'],
        warning: true
    },
    {
        id: 'static',
        name: 'Static Site Generators',
        enabled: true,
        detectionFiles: ['gatsby-config.js', 'config.toml', '_config.yml'],
        cachePatterns: ['.cache/', 'dist/'],
        warning: true
    },
    {
        id: 'testing',
        name: 'Testing Tools',
        enabled: true,
        detectionFiles: ['jest.config.js', 'pytest.ini', '.coveragerc', 'tests/'],
        cachePatterns: ['.coverage/', 'coverage/', 'reports/', '.nyc_output/', '.jest/', '.test_cache/'],
        warning: true
    },
    {
        id: 'ides',
        name: 'IDEs / Editors',
        enabled: true,
        detectionFiles: ['.idea/', '.history/', '*.sublime-*'],
        cachePatterns: ['.idea/workspace.xml', '.idea/caches/', '.vscode/ipch/', '.DS_Store', 'Thumbs.db'],
        warning: true
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
const showNotification = (message: string, type: string = 'info'): void => {
    emit('showNotification', message, type)
}

const showCategoryInfo = (category: DeveloperCategory): void => {
    selectedCategory.value = category
    showInfoDialog.value = true
}

const onCategoriesChanged = (updatedCategories: DeveloperCategory[]): void => {
    categories.value = updatedCategories
    hasEnabledCategories.value = updatedCategories.some(cat => cat.enabled)
}

const onCacheSelectionChanged = (): void => {
    // Update project cache sizes when selections change
    projects.value.forEach(project => {
        project.selectedCacheSize = project.caches
            .reduce((sum, group) => sum + group.selectedSize, 0)
    })
}

const openFolderTree = (folderPath: string): void => {
    selectedFolderPath.value = folderPath
    showFolderTree.value = true
}

const startScan = async (basePaths: string[]): Promise<void> => {
    if (!window.electronAPI.scanDeveloperCaches) {
        showNotification(t('common.dev_scan_not_implemented'), 'warning')
        return
    }

    scanProgress.value = -1

    try {
        isScanning.value = true
        projects.value = []

        // Clean up any existing listeners
        if (window.electronAPI.removeAllListeners) {
            window.electronAPI.removeAllListeners('developer-project-found')
        }

        const pathCount = basePaths.length
        const pathText = pathCount === 1 ? `1 ${t('common.path')}` : `${pathCount} ${t('common.paths')}`
        statusText.value = t('common.scanning_paths_count', { count: pathCount })

        // Create serializable data - convert Vue reactive arrays to plain arrays/objects
        const plainBasePaths = [...basePaths]
        const enabledCategories = categories.value
            .filter(cat => cat.enabled)
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                enabled: cat.enabled,
                detectionFiles: [...cat.detectionFiles],
                cachePatterns: [...cat.cachePatterns],
                warning: cat.warning
            }))

        // Listen for real-time project updates
        const handleProjectFound = (project: any): void => {
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

        const result = await window.electronAPI.scanDeveloperCaches(plainBasePaths, enabledCategories, undefined, true)

        // Process any remaining projects not caught by real-time updates
        result.forEach((project: any) => {
            const existingIndex = projects.value.findIndex(p => p.path === project.path)
            if (existingIndex === -1) {
                const processedProject = processProject(project)
                projects.value.push(processedProject)
            }
        })

        // Final sort
        projects.value.sort((a, b) => b.totalCacheSize - a.totalCacheSize)

        // Save projects after successful scan
        // Convert reactive objects to plain objects to avoid cloning issues
        const plainProjects: ProjectInfo[] = projects.value.map(project => ({
            path: project.path,
            lastModified: project.lastModified,
            type: project.type,
            selectedCacheSize: 0,
            totalCacheSize: project.totalCacheSize,
            caches: project.caches.map(group => ({
                pattern: group.pattern,
                category: group.category,
                totalSize: group.totalSize,
                selectedSize: 0,
                expanded: false,
                matches: group.matches.map(match => ({
                    path: match.path,
                    relativePath: match.relativePath,
                    size: match.size,
                    selected: false,
                    categories: match.categories,
                    patterns: match.patterns
                }))
            }))
        }))
        await window.electronAPI.saveDeveloperProjects(plainProjects)

        const message = projects.value.length > 0
            ? t('common.found_projects_count', { count: projects.value.length, paths: pathText })
            : t('common.no_projects_found', { paths: pathText })

        showNotification(message, projects.value.length > 0 ? 'success' : 'info')
        statusText.value = message

    } catch (error) {
        console.error('Scan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_scan')}: ${errorMessage}`, 'error')
    } finally {
        window.electronAPI.removeAllListeners?.('developer-project-found')
        isScanning.value = false
    }
}

const startQuickScan = async (): Promise<void> => {
    try {
        window.electronAPI.removeAllListeners?.('developer-project-found')
        isScanning.value = true
        statusText.value = t('common.loading_saved_projects')
        projects.value = []

        const savedProjects = await window.electronAPI.loadSavedDeveloperProjects()
        if (savedProjects.length === 0) {
            showNotification(t('common.no_saved_projects'), 'warning')
            isScanning.value = false
            return
        }

        // Create serializable data for enabled categories
        const enabledCategories = categories.value
            .filter(cat => cat.enabled)
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                enabled: cat.enabled,
                detectionFiles: [...cat.detectionFiles],
                cachePatterns: [...cat.cachePatterns],
                warning: cat.warning
            }))

        statusText.value = t('common.checking_saved_projects')
        const validProjects: ProjectInfo[] = []

        for (let index = 0; index < savedProjects.length; index++) {
            scanProgress.value = (index + 1) / savedProjects.length * 100
            const project = savedProjects[index]
            try {
                const refreshed = await refreshSavedProject(project, enabledCategories)
                if (refreshed) validProjects.push(refreshed)
            } catch {
                console.warn(`Project no longer accessible: ${project.path}`)
            }
        }

        projects.value = validProjects.sort((a, b) => b.totalCacheSize - a.totalCacheSize)
        statusText.value = t('common.found_projects', { count: projects.value.length })

        if (projects.value.length === 0) {
            showNotification(t('common.no_accessible_projects'), 'warning')
        } else {
            showNotification(t('common.found_projects', { count: projects.value.length }), 'success')
        }
    } catch (error) {
        console.error('Quick scan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_quick_scan')}: ${errorMessage}`, 'error')
    } finally {
        isScanning.value = false
    }
}

const rescanSpecificProjects = async (projectPaths: string[]): Promise<void> => {
    if (!window.electronAPI.scanDeveloperCaches) {
        showNotification(t('common.dev_scan_not_implemented'), 'warning')
        return
    }

    try {
        window.electronAPI.removeAllListeners?.('developer-project-found')
        statusText.value = t('common.updating_projects_count', { count: projectPaths.length })

        // Create serializable data - convert Vue reactive arrays to plain arrays/objects
        const enabledCategories = categories.value
            .filter(cat => cat.enabled)
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                enabled: cat.enabled,
                detectionFiles: [...cat.detectionFiles],
                cachePatterns: [...cat.cachePatterns],
                warning: cat.warning
            }))

        // Scan only the specific project paths
        const result = await window.electronAPI.scanDeveloperCaches(projectPaths, enabledCategories, 0, false)

        // Update only the scanned projects in the existing list
        result.forEach((scannedProject: any) => {
            const existingIndex = projects.value.findIndex(p => p.path === scannedProject.path)
            if (existingIndex !== -1) {
                // Update existing project
                const processedProject = processProject(scannedProject)
                projects.value[existingIndex] = processedProject
            }
        })

        // Re-sort the entire list by total cache size
        projects.value.sort((a, b) => b.totalCacheSize - a.totalCacheSize)

        statusText.value = t('common.updated_projects_count', { count: projectPaths.length })

    } catch (error) {
        console.error('Rescan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_project_update')}: ${errorMessage}`, 'error')
    }
}

const stopScan = async (): Promise<void> => {
    statusText.value = t('common.stopping_scan')
    try {
        if (window.electronAPI.stopDeveloperScan) {
            await window.electronAPI.stopDeveloperScan()
            showNotification(t('common.scan_stopped_user'), 'info')
        } else {
            showNotification(t('common.scan_stopped'), 'info')
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_stopping_scan')}: ${errorMessage}`, 'error')
    } finally {
        isScanning.value = false
    }
}

const refreshSavedProject = async (project: ProjectInfo, enabledCategories: DeveloperCategory[]): Promise<ProjectInfo | null> => {
    if (!project.caches?.length) {
        const [rescannedProject] = await window.electronAPI.scanDeveloperCaches([project.path], enabledCategories, 0, false)
        return rescannedProject ? processProject(rescannedProject) : null
    }

    const caches = []
    for (const group of project.caches) {
        const matches = []
        for (const match of group.matches) {
            try {
                const size = await window.electronAPI.getDirectorySize(match.path)
                if (size > 0) matches.push({ ...match, size, selected: false })
            } catch {
                console.warn(`Cache no longer accessible: ${match.path}`)
            }
        }
        if (matches.length === 0) continue
        caches.push({
            ...group,
            matches,
            totalSize: matches.reduce((sum, match) => sum + match.size, 0),
            selectedSize: 0,
            expanded: false
        })
    }

    if (caches.length === 0) return null
    return processProject({
        ...project,
        caches,
        totalCacheSize: caches.reduce((sum, group) => sum + group.totalSize, 0)
    })
}

// Helper function to process projects
const processProject = (project: any): ProjectInfo => {
    const processedCaches = project.caches
        .map((cacheGroup: any) => ({
            ...cacheGroup,
            // Ensure all matches have selection state
            matches: cacheGroup.matches.map((match: any) => ({
                ...match,
                selected: match.selected || false
            })),
            selectedSize: 0, // Will be calculated below
            expanded: false // Default to collapsed
        }))
        .sort((a: any, b: any) => b.totalSize - a.totalSize) // Sort cache groups by total size

    // Calculate selected sizes for each group
    processedCaches.forEach((cacheGroup: any) => {
        cacheGroup.selectedSize = cacheGroup.matches
            .filter((match: any) => match.selected)
            .reduce((sum: number, match: any) => sum + match.size, 0)
    })

    return {
        ...project,
        caches: processedCaches,
        totalCacheSize: processedCaches.reduce((sum: number, cacheGroup: any) => sum + cacheGroup.totalSize, 0),
        selectedCacheSize: processedCaches.reduce((sum: number, cacheGroup: any) => sum + cacheGroup.selectedSize, 0)
    }
}

// Delete functionality
const confirmDelete = (): void => {
    if (selectedCacheCount.value === 0) {
        showNotification(t('common.no_caches_selected_delete'), 'warning')
        return
    }
    showDeleteDialog.value = true
}

const deleteCaches = async (): Promise<void> => {
    showDeleteDialog.value = false
    isDeleting.value = true
    statusText.value = t('common.preparing_delete')

    try {
        // Collect all selected cache paths from all projects
        const selectedCachePaths: string[] = []
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
            showNotification(t('common.no_caches_selected'), 'warning')
            return
        }

        statusText.value = t('common.deleting_cache_folders', { count: selectedCachePaths.length })

        await whenRulesSaved()
        const results = await window.electronAPI.deleteFolders([...selectedCachePaths])
        const { successCount, partialCount, failCount } = summarizeDeleteResults(results)

        const parts: string[] = []
        if (successCount > 0) parts.push(`${successCount} ${t('common.deleted')}`)
        if (partialCount > 0) parts.push(`${partialCount} ${t('common.partial')}`)
        if (failCount > 0) parts.push(`${failCount} ${t('common.failed')}`)

        const fullyDeleted = failCount === 0 && partialCount === 0
        const message = fullyDeleted
            ? t('common.success_deleted_cache', { count: successCount })
            : parts.join(', ')

        showNotification(message, fullyDeleted ? 'success' : 'warning')
        statusText.value = `${t('common.deletion_complete')}: ${parts.join(', ')}`

        if (successCount + partialCount > 0) {
            // Get unique project paths that had caches deleted
            const affectedProjectPaths = new Set<string>()
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_deletion')}: ${errorMessage}`, 'error')
        statusText.value = t('common.deletion_failed')
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