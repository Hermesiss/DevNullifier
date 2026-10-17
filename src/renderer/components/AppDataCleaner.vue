<template>
    <div>
        <ControlPanel :is-scanning="isScanning" :is-deleting="isDeleting" :folders-length="folders.length"
            :max-depth="maxDepth" @scan="startScan" @quick-scan="startQuickScan" @stop-scan="stopScan"
            @select-all="selectAll" @deselect-all="deselectAll" @update:maxDepth="(val: number) => maxDepth = val"
            :scan-progress="scanProgress" />

        <!-- Results Table -->
        <ResultsTable v-model="selectedFolders" :folders="folders" :is-scanning="isScanning"
            :compare-text="scanCompareText" @open-folder-tree="openFolderTree" />

        <DeleteFailureList :failures="failedDeletes" :disabled="isDeleting" @retry="retryFailed" />

        <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedFolders.length" :selected-size="selectedSize"
            :permanent="permanentDelete" @confirm="deleteFolders" />

        <!-- Folder Tree Viewer -->
        <FolderTreeViewer v-model="showFolderTree" :folder-path="selectedFolderPath" />

        <!-- Actions Bar -->
        <v-footer app class="pa-0">
            <ActionsBar :status-text="statusText"
                :delete-progress="deleteProgress" :selected-count="selectedFolders.length" :is-scanning="isScanning"
                :is-deleting="isDeleting" @delete="confirmDelete" />
        </v-footer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useElevationPrompt } from '../composables/useElevationPrompt'
import { failsThreshold } from '../../main/thresholds'
import { applyRetryResult, summarizeDeleteResults, unsuccessfulDeletes } from '../utils/deleteResults'
import { useI18n } from 'vue-i18n'
import ControlPanel from './AppDataCleaner/ControlPanel.vue'
import ResultsTable from './AppDataCleaner/ResultsTable.vue'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import DeleteFailureList from './DeleteFailureList.vue'
import type { DeleteResult, FolderItem } from '@/types'
import { formatSize } from '../utils/formatters'
import { compareScans, toScanSnapshot, type ScanComparison, type ScanSnapshotItem } from '../utils/scanCompare'
import { cleanerThresholdsActive, useCleanerRules } from '../composables/useCleanerRules'

const { t } = useI18n()
const { permanentDelete, minAgeDays, minSizeMb, whenRulesSaved } = useCleanerRules()
useElevationPrompt()

// Reactive state
const folders = ref<FolderItem[]>([])
const selectedFolders = ref<string[]>([])
const maxDepth = ref(3)
const scanDepth = () => maxDepth.value === 0 ? -1 : maxDepth.value
const isScanning = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref(t('common.ready'))
const deleteProgress = ref(0)
const deleteBatchSize = ref(1)
const failedDeletes = ref<DeleteResult[]>([])
const deletionSizes = new Map<string, number>()
const scanProgress = ref(0)
const scannedDirectoryCount = ref(0)
const currentScanPath = ref('')
const acceptScanDetail = ref(false)
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

// Emit events to parent
const emit = defineEmits<{
    showNotification: [text: string, color?: string]
}>()

// Computed properties
const selectedSize = computed(() => {
    return selectedFolders.value.reduce((sum, path) => {
        const folder = folders.value.find((f) => f.path === path)
        return sum + (folder ? folder.size : 0)
    }, 0)
})

const thresholdRules = () => ({
    minAgeDays: minAgeDays.value,
    minSizeMb: minSizeMb.value
})

// Selection helpers. Select-all adds rows that pass and leaves hand-checked rows alone.
const selectAll = () => {
    const rules = thresholdRules()
    const selected = new Set(selectedFolders.value)
    for (const folder of folders.value) {
        if (!failsThreshold(folder.size, folder.modifiedAt, rules)) selected.add(folder.path)
    }
    selectedFolders.value = folders.value.map(folder => folder.path).filter(path => selected.has(path))
}

watch([minAgeDays, minSizeMb], () => {
    if (!cleanerThresholdsActive(minAgeDays.value, minSizeMb.value)) return
    const rules = thresholdRules()
    selectedFolders.value = selectedFolders.value.filter(path => {
        const folder = folders.value.find(item => item.path === path)
        if (!folder) return true
        return !failsThreshold(folder.size, folder.modifiedAt, rules)
    })
})

const deselectAll = () => {
    selectedFolders.value = []
}

// Utility functions
const openFolderTree = (folderPath: string): void => {
    selectedFolderPath.value = folderPath
    showFolderTree.value = true
}

// Scan logic
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

const stopScan = async (): Promise<void> => {
    acceptScanDetail.value = false
    statusText.value = t('common.stopping_scan')

    try {
        await window.electronAPI.stopAppDataScan()
        statusText.value = t('common.ready')
        emit('showNotification', t('common.scan_stopped_user'), 'info')
    } catch (error) {
        console.error('Error stopping scan:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', `${t('common.error_stopping_scan')}: ${errorMessage}`, 'error')
    } finally {
        isScanning.value = false
    }
}

const loadPreviousSnapshot = async (): Promise<ScanSnapshotItem[]> => {
    try {
        return toScanSnapshot(await window.electronAPI.loadSavedFolders())
    } catch (error) {
        console.error('Failed to load previous scan:', error)
        return []
    }
}

const startScan = async (): Promise<void> => {
    try {
        isScanning.value = true
        scanComparison.value = null
        scanProgress.value = -1
        statusText.value = t('common.getting_app_data_paths')
        folders.value = []
        selectedFolders.value = []
        const seenPaths = new Set<string>()
        const previous = await loadPreviousSnapshot()

        const paths = await window.electronAPI.getAppDataPaths()
        if (paths.length === 0) {
            emit('showNotification', t('common.no_app_data_paths'), 'warning')
            isScanning.value = false
            return
        }

        statusText.value = t('common.scanning_folders')
        beginScanDetail()
        // Listen for real-time folder updates
        window.electronAPI.onScanFolderFound((folderss: FolderItem[]) => {
            for (const folder of folderss) {
                if (!seenPaths.has(folder.path)) {
                    seenPaths.add(folder.path)
                    const existingIndex = folders.value.findIndex(f => f.path === folder.path)
                    if (existingIndex === -1) {
                        folders.value.push(folder)
                    } else if (folders.value[existingIndex].size !== folder.size) {
                        folders.value[existingIndex] = folder
                    }
                }
            }
        })
        await window.electronAPI.scanFolders(paths, scanDepth(), true)
        acceptScanDetail.value = false
        // Only sort and show success if we weren't terminated
        if (isScanning.value) {
            // Sort at the end for display
            folders.value.sort((a, b) => b.size - a.size)
            if (previous.length > 0) {
                scanComparison.value = compareScans(previous, toScanSnapshot(folders.value))
            }
            // Save folders after successful scan
            await window.electronAPI.saveFolders(folders.value.map(folder => ({
                ...folder,
                keyword: folder.keyword,
                modifiedAt: folder.modifiedAt ?? null
            })))
            statusText.value = t('common.found_folders_count', { count: folders.value.length })
            if (folders.value.length === 0) {
                emit('showNotification', t('common.no_folders_found'), 'info')
            } else {
                emit('showNotification', t('common.found_folders_count', { count: folders.value.length }), 'success')
            }
        }
    } catch (error) {
        console.error('Scan error:', error)
        // Only show error notification if we weren't terminated
        if (isScanning.value) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            emit('showNotification', `${t('common.error_scan')}: ${errorMessage}`, 'error')
        }
    } finally {
        acceptScanDetail.value = false
        // Only update scanning state here if we haven't started stopping
        isScanning.value = false
    }
}

const startQuickScan = async (): Promise<void> => {
    try {
        isScanning.value = true
        scanComparison.value = null
        statusText.value = t('common.loading_saved_folders')
        folders.value = []
        selectedFolders.value = []

        const savedFolders = await window.electronAPI.loadSavedFolders()
        if (savedFolders.length === 0) {
            emit('showNotification', t('common.no_saved_folders'), 'warning')
            isScanning.value = false
            return
        }

        statusText.value = t('common.checking_saved_folders')
        const validFolders: FolderItem[] = []

        for (let index = 0; index < savedFolders.length; index++) {
            const folder = savedFolders[index]
            scanProgress.value = (index + 1) / savedFolders.length * 100
            try {
                const size = await window.electronAPI.getDirectorySize(folder.path)
                if (size !== undefined) {
                    validFolders.push({
                        ...folder,
                        keyword: folder.keyword,
                        size
                    })
                }
            } catch {
                console.warn(`Folder no longer accessible: ${folder.path}`)
            }
        }

        folders.value = validFolders.sort((a, b) => b.size - a.size)
        statusText.value = t('common.found_folders_count', { count: folders.value.length })

        if (folders.value.length === 0) {
            emit('showNotification', t('common.no_accessible_folders'), 'warning')
        } else {
            emit('showNotification', t('common.found_folders_count', { count: folders.value.length }), 'success')
        }
    } catch (error) {
        console.error('Quick scan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', `${t('common.error_quick_scan')}: ${errorMessage}`, 'error')
    } finally {
        isScanning.value = false
    }
}

const rescanAffectedDirectories = async (deletedPaths: string[]): Promise<void> => {
    try {
        scanComparison.value = null
        selectedFolders.value = []
        statusText.value = t('common.updating_dirs')

        // Get unique parent directories of deleted folders
        const parentDirs = new Set<string>()
        const allAppDataPaths = await window.electronAPI.getAppDataPaths()

        deletedPaths.forEach(deletedPath => {
            // Find which application data path contains this deleted folder
            const containingPath = allAppDataPaths.find((appDataPath: string) =>
                deletedPath.startsWith(appDataPath)
            )
            if (containingPath) {
                parentDirs.add(containingPath)
            }
        })

        if (parentDirs.size === 0) {
            statusText.value = t('common.no_dirs_to_update')
            return
        }

        // Remove folders from the affected directories
        const affectedPaths = Array.from(parentDirs)
        folders.value = folders.value.filter(folder => {
            return !affectedPaths.some(parentDir => folder.path.startsWith(parentDir))
        })

        // Listen for real-time folder updates
        window.electronAPI.onScanFolderFound((folderss: FolderItem[]) => {
            for (const folder of folderss) {
                const existingIndex = folders.value.findIndex(f => f.path === folder.path)
                if (existingIndex === -1) {
                    folders.value.push(folder)
                } else if (folders.value[existingIndex].size !== folder.size) {
                    folders.value[existingIndex] = folder
                }
            }
        })

        // Rescan only the affected directories
        beginScanDetail()
        await window.electronAPI.scanFolders(affectedPaths, scanDepth(), false)
        acceptScanDetail.value = false

        // Re-sort the entire list
        folders.value.sort((a, b) => b.size - a.size)

        statusText.value = t('common.updated_dirs_count', { count: affectedPaths.length })

    } catch (error) {
        acceptScanDetail.value = false
        console.error('Rescan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', `${t('common.error_updating_dirs')}: ${errorMessage}`, 'error')
    }
}

// Delete logic
const confirmDelete = (): void => {
    if (selectedFolders.value.length > 0) {
        showDeleteDialog.value = true
    }
}

const buildDeleteResultMessage = (successCount: number, partialCount: number, failCount: number): { message: string; color: string } => {
    if (failCount === 0 && partialCount === 0) {
        return {
            message: t('common.success_deleted_folders', { count: successCount }),
            color: 'success'
        }
    }

    if (successCount === 0 && partialCount === 0) {
        return {
            message: t('common.fail_deleted_folders', { count: failCount }),
            color: 'error'
        }
    }

    const parts = []
    if (successCount > 0) parts.push(`${successCount} ${t('common.deleted')}`)
    if (partialCount > 0) parts.push(`${partialCount} ${t('common.partial')}`)
    if (failCount > 0) parts.push(`${failCount} ${t('common.failed')}`)

    return {
        message: parts.join(', '),
        color: partialCount > 0 || failCount > 0 ? 'warning' : 'success'
    }
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

const deleteFolders = async (): Promise<void> => {
    try {
        showDeleteDialog.value = false
        isDeleting.value = true
        deleteProgress.value = 0
        statusText.value = t('common.deleting_folders')

        await whenRulesSaved()
        deletionSizes.clear()
        for (const folder of folders.value) deletionSizes.set(folder.path, folder.size)
        deleteBatchSize.value = selectedFolders.value.length || 1
        const results = await window.electronAPI.deleteFolders([...selectedFolders.value])
        await recordDeletionLog(results, deletionSizes)
        failedDeletes.value = unsuccessfulDeletes(results)
        const { successCount, partialCount, failCount } = summarizeDeleteResults(results)

        const { message, color } = buildDeleteResultMessage(successCount, partialCount, failCount)
        emit('showNotification', message, color)

        // Auto re-scan only affected parent directories after deletion
        setTimeout(() => {
            rescanAffectedDirectories(selectedFolders.value)
        }, 1000)
    } catch (error) {
        console.error('Delete error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', `${t('common.error_deletion')}: ${errorMessage}`, 'error')
    } finally {
        isDeleting.value = false
        deleteProgress.value = 0
    }
}

const retryFailed = async (path: string): Promise<void> => {
    if (isDeleting.value) return
    isDeleting.value = true
    deleteProgress.value = 0
    deleteBatchSize.value = 1
    statusText.value = t('common.deleting_folders')
    try {
        await whenRulesSaved()
        const results = await window.electronAPI.deleteFolders([path])
        await recordDeletionLog(results, deletionSizes)
        const next = results.find(result => result.path === path)
        failedDeletes.value = applyRetryResult(failedDeletes.value, path, results)
        const { successCount, partialCount, failCount } = summarizeDeleteResults(results)
        const { message, color } = buildDeleteResultMessage(successCount, partialCount, failCount)
        emit('showNotification', message, color)
        if (next && next.success !== false) {
            setTimeout(() => {
                rescanAffectedDirectories([path])
            }, 1000)
        }
    } catch (error) {
        console.error('Delete error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', `${t('common.error_deletion')}: ${errorMessage}`, 'error')
    } finally {
        isDeleting.value = false
        deleteProgress.value = 0
    }
}

// Event listeners setup
const setupEventListeners = (): void => {
    // Ensure no duplicate listeners first
    window.electronAPI.removeAllListeners('scan-progress')
    window.electronAPI.removeAllListeners('scan-current-path')
    window.electronAPI.removeAllListeners('delete-progress')
    window.electronAPI.removeAllListeners('scan-folder-found')

    // Attach listeners. Progress count is directories entered, not matches found.
    window.electronAPI.onScanProgress((count: number) => {
        scannedDirectoryCount.value = count
        publishScanDetail()
    })

    window.electronAPI.onScanCurrentPath((path: string, visited?: number) => {
        currentScanPath.value = path ?? ''
        if (typeof visited === 'number') scannedDirectoryCount.value = visited
        publishScanDetail()
    })

    window.electronAPI.onDeleteProgress((count: number) => {
        const total = deleteBatchSize.value
        if (total <= 0) return
        deleteProgress.value = (count / total) * 100
    })
}

const removeEventListeners = (): void => {
    window.electronAPI.removeAllListeners('scan-progress')
    window.electronAPI.removeAllListeners('scan-current-path')
    window.electronAPI.removeAllListeners('delete-progress')
    window.electronAPI.removeAllListeners('scan-folder-found')
}

onMounted(setupEventListeners)
onUnmounted(removeEventListeners)

// Expose methods and computed properties for parent
defineExpose({
    confirmDelete,
    selectedFolders,
    isDeleting,
    isScanning
})
</script>

<style scoped>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>