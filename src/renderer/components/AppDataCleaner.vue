<template>
    <div>
        <ControlPanel :is-scanning="isScanning" :is-deleting="isDeleting" :folders-length="folders.length"
            :max-depth="maxDepth" @scan="startScan" @quick-scan="startQuickScan" @stop-scan="stopScan"
            @select-all="selectAll" @deselect-all="deselectAll" @update:maxDepth="(val: number) => maxDepth = val"
            :scan-progress="scanProgress" />

        <!-- Results Table -->
        <ResultsTable v-model="selectedFolders" :folders="folders" :is-scanning="isScanning"
            @open-folder-tree="openFolderTree" />

        <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedFolders.length" :selected-size="selectedSize"
            @confirm="deleteFolders" />

        <!-- Folder Tree Viewer -->
        <FolderTreeViewer v-model="showFolderTree" :folder-path="selectedFolderPath" />

        <!-- Actions Bar -->
        <v-footer app class="pa-0">
            <ActionsBar :status-text="statusText" :delete-progress="deleteProgress"
                :selected-count="selectedFolders.length" :is-scanning="isScanning" :is-deleting="isDeleting"
                @delete="confirmDelete" />
        </v-footer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ControlPanel from './AppDataCleaner/ControlPanel.vue'
import ResultsTable from './AppDataCleaner/ResultsTable.vue'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import type { DeleteResult, FolderItem } from '@/types'

const { t } = useI18n()

// Reactive state
const folders = ref<FolderItem[]>([])
const selectedFolders = ref<string[]>([])
const maxDepth = ref(3)
const isScanning = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref(t('common.ready'))
const deleteProgress = ref(0)
const scanProgress = ref(0)

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

// Selection helpers
const selectAll = () => {
    selectedFolders.value = folders.value.map((f) => f.path)
}

const deselectAll = () => {
    selectedFolders.value = []
}

// Utility functions
const openFolderTree = (folderPath: string): void => {
    selectedFolderPath.value = folderPath
    showFolderTree.value = true
}

// Scan logic
const stopScan = async (): Promise<void> => {
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

const startScan = async (): Promise<void> => {
    try {
        isScanning.value = true
        scanProgress.value = -1
        statusText.value = t('common.getting_app_data_paths')
        folders.value = []
        selectedFolders.value = []
        const seenPaths = new Set<string>()

        const paths = await window.electronAPI.getAppDataPaths()
        if (paths.length === 0) {
            emit('showNotification', t('common.no_app_data_paths'), 'warning')
            isScanning.value = false
            return
        }

        statusText.value = t('common.scanning_folders')
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
        await window.electronAPI.scanFolders(paths, maxDepth.value)
        // Only sort and show success if we weren't terminated
        if (isScanning.value) {
            // Sort at the end for display
            folders.value.sort((a, b) => b.size - a.size)
            // Save folders after successful scan
            await window.electronAPI.saveFolders(folders.value.map(f => ({
                path: f.path,
                size: f.size
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
        // Only update scanning state here if we haven't started stopping
        isScanning.value = false
    }
}

const startQuickScan = async (): Promise<void> => {
    try {
        isScanning.value = true
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
        await window.electronAPI.scanFolders(affectedPaths, maxDepth.value)

        // Re-sort the entire list
        folders.value.sort((a, b) => b.size - a.size)

        statusText.value = t('common.updated_dirs_count', { count: affectedPaths.length })

    } catch (error) {
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

const deleteFolders = async (): Promise<void> => {
    try {
        showDeleteDialog.value = false
        isDeleting.value = true
        deleteProgress.value = 0
        statusText.value = t('common.deleting_folders')

        const results = await window.electronAPI.deleteFolders([...selectedFolders.value])

        const successCount = results.filter((r: DeleteResult) => r.success === true).length
        const partialCount = results.filter((r: DeleteResult) => r.success === 'partial').length
        const failCount = results.filter((r: DeleteResult) => r.success === false).length

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

// Event listeners setup
const setupEventListeners = (): void => {
    // Ensure no duplicate listeners first
    window.electronAPI.removeAllListeners('scan-progress')
    window.electronAPI.removeAllListeners('scan-current-path')
    window.electronAPI.removeAllListeners('delete-progress')
    window.electronAPI.removeAllListeners('scan-folder-found')

    // Attach listeners
    window.electronAPI.onScanProgress((count: number) => {
        statusText.value = t('common.found_folders_count', { count: count })
    })

    window.electronAPI.onScanCurrentPath((path: string) => {
        statusText.value = t('common.scanning_path', { path: path })
    })

    window.electronAPI.onDeleteProgress((count: number) => {
        deleteProgress.value = (count / selectedFolders.value.length) * 100
    })
}

const removeEventListeners = (): void => {
    window.electronAPI.removeAllListeners('scan-progress')
    window.electronAPI.removeAllListeners('scan-current-path')
    window.electronAPI.removeAllListeners('delete-progress')
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