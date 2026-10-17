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

        <v-row class="mb-4">
            <v-col cols="12">
                <v-card>
                    <v-card-title class="d-flex align-center">
                        <v-icon start>mdi-toolbox-outline</v-icon>
                        {{ t('common.tool_caches') }}
                        <v-spacer />
                        <v-btn color="primary" variant="outlined" size="small" :loading="isScanningToolCaches"
                            :disabled="isScanning || isDeleting" @click="scanToolCaches">
                            <v-icon start>mdi-database-search</v-icon>
                            {{ t('common.scan_tool_caches') }}
                        </v-btn>
                    </v-card-title>
                    <v-card-text v-if="toolCachesScanned">
                        <p v-if="toolCaches.length === 0" class="mb-0">{{ t('common.no_tool_caches') }}</p>
                        <v-table v-else density="compact">
                            <thead>
                                <tr>
                                    <th class="tool-cache-check"></th>
                                    <th>{{ t('common.tool_caches') }}</th>
                                    <th>{{ t('common.path') }}</th>
                                    <th class="text-end">{{ t('common.size') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in toolCaches" :key="item.path">
                                    <td>
                                        <v-checkbox-btn v-model="item.selected" :aria-label="item.label"
                                            :disabled="isScanning || isDeleting || isScanningToolCaches" />
                                    </td>
                                    <td>{{ item.label }}</td>
                                    <td class="text-truncate tool-cache-path" :title="item.path">{{ item.path }}</td>
                                    <td class="text-end">{{ formatSize(item.size) }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- Results Table -->
        <ResultsTable :projects="projects" :is-scanning="isScanning" :is-deleting="isDeleting"
            :compare-text="scanCompareText" @open-folder-tree="openFolderTree"
            @cache-selection-changed="onCacheSelectionChanged" />

        <DeleteFailureList :failures="failedDeletes" :disabled="isDeleting" @retry="retryFailed" />

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { failsThreshold } from '../../main/thresholds'
import { applyRetryResult, summarizeDeleteResults, unsuccessfulDeletes } from '../utils/deleteResults'
import { useI18n } from 'vue-i18n'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import CategoriesPanel from './DeveloperCleaner/CategoriesPanel.vue'
import ControlPanel from './DeveloperCleaner/ControlPanel.vue'
import ResultsTable from './DeveloperCleaner/ResultsTable.vue'
import CategoryInfoDialog from './DeveloperCleaner/CategoryInfoDialog.vue'
import DeleteFailureList from './DeleteFailureList.vue'
import type { DeleteResult, DeveloperCategory, ProjectInfo, ToolCacheItem } from '@/types'
import { formatSize } from '../utils/formatters'
import { compareScans, toScanSnapshot, type ScanComparison, type ScanSnapshotItem } from '../utils/scanCompare'
import { cleanerThresholdsActive, useCleanerRules } from '../composables/useCleanerRules'

const { t } = useI18n()
const { permanentDelete, minAgeDays, minSizeMb, whenRulesSaved } = useCleanerRules()

// Reactive state
const projects = ref<ProjectInfo[]>([])
const isScanning = ref(false)
const isDeleting = ref(false)
const failedDeletes = ref<DeleteResult[]>([])
const deletionSizes = new Map<string, number>()
const showInfoDialog = ref(false)
const selectedCategory = ref<DeveloperCategory | null>(null)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref(t('common.ready'))
const scannedDirectoryCount = ref(0)
const currentScanPath = ref('')
const acceptScanDetail = ref(false)
const categories = ref<DeveloperCategory[]>([])
const hasEnabledCategories = ref(false)
const scanProgress = ref(0)
const toolCaches = ref<Array<ToolCacheItem & { selected: boolean }>>([])
const toolCachesScanned = ref(false)
const isScanningToolCaches = ref(false)
const scanComparison = ref<ScanComparison | null>(null)
const scanCompareText = computed(() => {
    const comparison = scanComparison.value
    if (!comparison) return ''
    return t('common.scan_compare', {
        added: comparison.added.length,
        grown: comparison.grown.length,
        freed: formatSize(comparison.freedBytes)
    })
})

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
const selectedToolCaches = computed(() => toolCaches.value.filter(item => item.selected))

const selectedCacheCount = computed(() => {
    const projectCount = projects.value.reduce((total, project) => {
        return total + project.caches.reduce((groupTotal, group) => {
            return groupTotal + group.matches.filter(match => match.selected).length
        }, 0)
    }, 0)
    return projectCount + selectedToolCaches.value.length
})

const selectedCacheSize = computed(() => {
    const projectSize = projects.value.reduce((total, project) => {
        return total + (project.selectedCacheSize || 0)
    }, 0)
    const toolSize = selectedToolCaches.value.reduce((total, item) => total + item.size, 0)
    return projectSize + toolSize
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

watch([minAgeDays, minSizeMb], () => {
    if (!cleanerThresholdsActive(minAgeDays.value, minSizeMb.value)) return
    const rules = { minAgeDays: minAgeDays.value, minSizeMb: minSizeMb.value }
    for (const project of projects.value) {
        for (const group of project.caches) {
            for (const match of group.matches) {
                if (failsThreshold(match.size, match.modifiedAt, rules)) match.selected = false
            }
            group.selectedSize = group.matches
                .filter(match => match.selected)
                .reduce((sum, match) => sum + match.size, 0)
        }
        project.selectedCacheSize = project.caches.reduce((sum, group) => sum + group.selectedSize, 0)
    }
})

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

const publishScanDetail = (): void => {
    if (!acceptScanDetail.value) return
    statusText.value = t('common.scan_progress_detail', {
        count: scannedDirectoryCount.value,
        path: currentScanPath.value
    })
}

const beginScanDetail = (): void => {
    scannedDirectoryCount.value = 0
    currentScanPath.value = ''
    acceptScanDetail.value = true
}

const setupScanStatusListeners = (): void => {
    window.electronAPI.removeAllListeners?.('developer-scan-current-path')
    window.electronAPI.removeAllListeners?.('developer-scan-visited')

    window.electronAPI.onDeveloperScanCurrentPath?.((path: string, visited?: number) => {
        currentScanPath.value = path ?? ''
        if (typeof visited === 'number') scannedDirectoryCount.value = visited
        publishScanDetail()
    })

    window.electronAPI.onDeveloperScanVisited?.((count: number) => {
        scannedDirectoryCount.value = count
        publishScanDetail()
    })
}

const removeScanStatusListeners = (): void => {
    window.electronAPI.removeAllListeners?.('developer-scan-current-path')
    window.electronAPI.removeAllListeners?.('developer-scan-visited')
}

const loadPreviousSnapshot = async (): Promise<ScanSnapshotItem[]> => {
    try {
        return toScanSnapshot(await window.electronAPI.loadSavedDeveloperProjects())
    } catch (error) {
        console.error('Failed to load previous developer scan:', error)
        return []
    }
}

const startScan = async (basePaths: string[]): Promise<void> => {
    if (!window.electronAPI.scanDeveloperCaches) {
        showNotification(t('common.dev_scan_not_implemented'), 'warning')
        return
    }

    scanProgress.value = -1

    try {
        isScanning.value = true
        scanComparison.value = null
        projects.value = []
        const previous = await loadPreviousSnapshot()

        // Clean up any existing listeners
        if (window.electronAPI.removeAllListeners) {
            window.electronAPI.removeAllListeners('developer-project-found')
        }

        const pathCount = basePaths.length
        const pathText = pathCount === 1 ? `1 ${t('common.path')}` : `${pathCount} ${t('common.paths')}`
        statusText.value = t('common.scanning_paths_count', { count: pathCount })
        beginScanDetail()

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
        acceptScanDetail.value = false

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
        if (previous.length > 0) {
            scanComparison.value = compareScans(previous, toScanSnapshot(projects.value))
        }

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
                    patterns: match.patterns,
                    modifiedAt: match.modifiedAt ?? null
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
        acceptScanDetail.value = false
        window.electronAPI.removeAllListeners?.('developer-project-found')
        isScanning.value = false
    }
}

const startQuickScan = async (): Promise<void> => {
    try {
        window.electronAPI.removeAllListeners?.('developer-project-found')
        isScanning.value = true
        scanComparison.value = null
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
        beginScanDetail()
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

        acceptScanDetail.value = false
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
        acceptScanDetail.value = false
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
        scanComparison.value = null
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
        beginScanDetail()
        const result = await window.electronAPI.scanDeveloperCaches(projectPaths, enabledCategories, 0, false)
        acceptScanDetail.value = false

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
        acceptScanDetail.value = false
        console.error('Rescan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_project_update')}: ${errorMessage}`, 'error')
    }
}

const stopScan = async (): Promise<void> => {
    acceptScanDetail.value = false
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

const scanToolCaches = async (): Promise<void> => {
    if (!window.electronAPI.scanGlobalCaches) {
        showNotification(t('common.error'), 'error')
        return
    }

    isScanningToolCaches.value = true
    statusText.value = t('common.loading')
    try {
        const found = await window.electronAPI.scanGlobalCaches()
        toolCaches.value = found.map(item => ({ ...item, selected: false }))
        toolCachesScanned.value = true
        statusText.value = t('common.ready')
    } catch (error) {
        console.error('Tool cache scan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error')}: ${errorMessage}`, 'error')
        statusText.value = t('common.ready')
    } finally {
        isScanningToolCaches.value = false
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

const recordDeletionLog = async (
    results: Array<{ path: string; success: boolean | 'partial' }>,
    sizes: Map<string, number>
): Promise<void> => {
    if (results.length === 0) return
    try {
        await window.electronAPI.appendDeletionLog(results.map(result => {
            const raw = sizes.get(result.path)
            return {
                path: result.path,
                size: typeof raw === 'number' && Number.isFinite(raw) ? raw : 0,
                status: result.success === true ? 'success' as const : result.success === 'partial' ? 'partial' as const : 'error' as const
            }
        }))
    } catch (error) {
        console.error('Failed to append deletion log:', error)
    }
}

const deleteCaches = async (): Promise<void> => {
    showDeleteDialog.value = false
    isDeleting.value = true
    statusText.value = t('common.preparing_delete')

    try {
        const selectedCachePaths: string[] = selectedToolCaches.value.map(item => item.path)
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
        deletionSizes.clear()
        for (const item of toolCaches.value) deletionSizes.set(item.path, item.size)
        for (const project of projects.value) {
            for (const cacheGroup of project.caches) {
                for (const match of cacheGroup.matches) deletionSizes.set(match.path, match.size)
            }
        }
        const results = await window.electronAPI.deleteFolders([...selectedCachePaths])
        await recordDeletionLog(results, deletionSizes)
        failedDeletes.value = unsuccessfulDeletes(results)
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
            const deletedPaths = new Set(
                results.filter(result => result.success === true).map(result => result.path)
            )
            toolCaches.value = toolCaches.value.filter(item => !deletedPaths.has(item.path))

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

const projectPathForCache = (cachePath: string): string | null => {
    for (const project of projects.value) {
        const owns = project.caches.some(cacheGroup =>
            cacheGroup.matches.some(match => match.path === cachePath)
        )
        if (owns) return project.path
    }
    return null
}

const retryFailed = async (path: string): Promise<void> => {
    if (isDeleting.value) return
    isDeleting.value = true
    statusText.value = t('common.deleting_cache_folders', { count: 1 })
    try {
        await whenRulesSaved()
        const results = await window.electronAPI.deleteFolders([path])
        await recordDeletionLog(results, deletionSizes)
        const next = results.find(result => result.path === path)
        failedDeletes.value = applyRetryResult(failedDeletes.value, path, results)

        const parts: string[] = []
        const { successCount, partialCount, failCount } = summarizeDeleteResults(results)
        if (successCount > 0) parts.push(`${successCount} ${t('common.deleted')}`)
        if (partialCount > 0) parts.push(`${partialCount} ${t('common.partial')}`)
        if (failCount > 0) parts.push(`${failCount} ${t('common.failed')}`)
        const fullyDeleted = failCount === 0 && partialCount === 0
        const message = fullyDeleted
            ? t('common.success_deleted_cache', { count: successCount })
            : parts.join(', ')
        showNotification(message, fullyDeleted ? 'success' : 'warning')
        statusText.value = `${t('common.deletion_complete')}: ${parts.join(', ')}`

        if (next?.success === true) {
            toolCaches.value = toolCaches.value.filter(item => item.path !== path)
        }
        if (next && next.success !== false) {
            const projectPath = projectPathForCache(path)
            if (projectPath) rescanSpecificProjects([projectPath])
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

onMounted(setupScanStatusListeners)

// Cleanup on unmount
onUnmounted(() => {
    acceptScanDetail.value = false
    removeScanStatusListeners()
    if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('developer-project-found')
    }
})
</script>

<style scoped>
.tool-cache-check {
    width: 48px;
}

.tool-cache-path {
    max-width: 480px;
}
</style>