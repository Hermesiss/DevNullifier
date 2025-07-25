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
import ControlPanel from './AppDataCleaner/ControlPanel.vue'
import ResultsTable from './AppDataCleaner/ResultsTable.vue'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import type { DeleteResult, FolderItem } from '@/types'

// Reactive state
const folders = ref<FolderItem[]>([])
const selectedFolders = ref<string[]>([])
const maxDepth = ref(3)
const isScanning = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref('Ready')
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
    statusText.value = 'Stopping scan...'

    try {
        await window.electronAPI.stopAppDataScan()
        statusText.value = 'Ready'
        emit('showNotification', 'Scan stopped by user', 'info')
    } catch (error) {
        console.error('Error stopping scan:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', 'Error stopping scan: ' + errorMessage, 'error')
    } finally {
        isScanning.value = false
    }
}

const startScan = async (): Promise<void> => {
    try {
        isScanning.value = true
        scanProgress.value = -1
        statusText.value = 'Getting application data paths...'
        folders.value = []
        selectedFolders.value = []
        const seenPaths = new Set<string>()

        const paths = await window.electronAPI.getAppDataPaths()
        if (paths.length === 0) {
            emit('showNotification', 'No application data paths found!', 'warning')
            isScanning.value = false
            return
        }

        statusText.value = 'Scanning folders...'
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
            statusText.value = `Found ${folders.value.length} folders`
            if (folders.value.length === 0) {
                emit('showNotification', 'No matching folders found', 'info')
            } else {
                emit('showNotification', `Found ${folders.value.length} folders`, 'success')
            }
        }
    } catch (error) {
        console.error('Scan error:', error)
        // Only show error notification if we weren't terminated
        if (isScanning.value) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            emit('showNotification', 'Error during scan: ' + errorMessage, 'error')
        }
    } finally {
        // Only update scanning state here if we haven't started stopping
        isScanning.value = false
    }
}

const startQuickScan = async (): Promise<void> => {
    try {
        isScanning.value = true
        statusText.value = 'Loading saved folders...'
        folders.value = []
        selectedFolders.value = []

        const savedFolders = await window.electronAPI.loadSavedFolders()
        if (savedFolders.length === 0) {
            emit('showNotification', 'No saved folders found!', 'warning')
            isScanning.value = false
            return
        }

        statusText.value = 'Checking saved folders...'
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
        statusText.value = `Found ${folders.value.length} folders`

        if (folders.value.length === 0) {
            emit('showNotification', 'No accessible folders found', 'warning')
        } else {
            emit('showNotification', `Found ${folders.value.length} folders`, 'success')
        }
    } catch (error) {
        console.error('Quick scan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', 'Error during quick scan: ' + errorMessage, 'error')
    } finally {
        isScanning.value = false
    }
}

const rescanAffectedDirectories = async (deletedPaths: string[]): Promise<void> => {
    try {
        selectedFolders.value = []
        statusText.value = 'Updating affected directories...'

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
            statusText.value = 'No directories to update'
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

        statusText.value = `Updated ${affectedPaths.length} director${affectedPaths.length === 1 ? 'y' : 'ies'}`

    } catch (error) {
        console.error('Rescan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('showNotification', 'Error updating directories: ' + errorMessage, 'error')
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
            message: `Successfully deleted ${successCount} folders`,
            color: 'success'
        }
    }

    if (successCount === 0 && partialCount === 0) {
        return {
            message: `Failed to delete ${failCount} folders`,
            color: 'error'
        }
    }

    const parts = []
    if (successCount > 0) parts.push(`${successCount} deleted`)
    if (partialCount > 0) parts.push(`${partialCount} partial`)
    if (failCount > 0) parts.push(`${failCount} failed`)

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
        statusText.value = 'Deleting folders...'

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
        emit('showNotification', 'Error during deletion: ' + errorMessage, 'error')
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
        statusText.value = `Found ${count} folders`
    })

    window.electronAPI.onScanCurrentPath((path: string) => {
        statusText.value = `Scanning: ${path}`
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