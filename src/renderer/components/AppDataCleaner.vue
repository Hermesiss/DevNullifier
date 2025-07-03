<template>
    <div>
        <ControlPanel :is-scanning="isScanning" :is-deleting="isDeleting" :folders-length="folders.length"
            :max-depth="maxDepth" @scan="startScan" @stop-scan="stopScan" @select-all="selectAll"
            @deselect-all="deselectAll" @update:maxDepth="val => maxDepth = val" />

        <!-- Results Table -->
        <v-card>
            <v-card-title>
                <span>Found Folders</span>
                <v-spacer />
                <v-chip v-if="totalSize > 0" color="info" variant="outlined">
                    {{ formatSize(selectedSize) }} / {{ formatSize(totalSize) }}
                </v-chip>
            </v-card-title>

            <v-data-table v-model="selectedFolders" :headers="headers" :items="uniqueItems" :items-per-page="50"
                item-value="path" show-select :loading="isScanning" loading-text="Scanning for folders..."
                :sort-by="[{ key: 'size', order: 'desc' }]" class="elevation-1">
                <template #item.size="{ item }">
                    {{ formatSize(item.size) }}
                </template>

                <template #item.path="{ item }">
                    <div class="d-flex align-center">
                        <v-btn icon variant="text" size="small" @click="openFolderTree(item.path)"
                            :disabled="isScanning || isDeleting" class="ml-2">
                            <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                        </v-btn>
                        <span class="flex-grow-1">
                            {{ item.path }}
                        </span>

                    </div>
                </template>
            </v-data-table>
        </v-card>

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

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ControlPanel from './ControlPanel.vue'
import DeleteDialog from './DeleteDialog.vue'
import ActionsBar from './ActionsBar.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import { filesize } from 'filesize'

// Reactive state
const folders = ref([])
const selectedFolders = ref([])
const maxDepth = ref(3)
const isScanning = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const selectedFolderPath = ref('')
const statusText = ref('Ready')
const deleteProgress = ref(0)

// Emit events to parent
const emit = defineEmits(['showNotification'])

// Computed properties
const selectedSize = computed(() => {
    return selectedFolders.value.reduce((sum, path) => {
        const folder = folders.value.find((f) => f.path === path)
        return sum + (folder ? folder.size : 0)
    }, 0)
})

// Create unique items with IDs for the table
const uniqueItems = computed(() => {
    const seen = new Map();
    return folders.value.map(folder => {
        const existingFolder = seen.get(folder.path);
        if (existingFolder) {
            return existingFolder;
        }
        const uniqueFolder = {
            ...folder,
            id: `${folder.path}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        seen.set(folder.path, uniqueFolder);
        return uniqueFolder;
    });
})

const totalSize = computed(() => uniqueItems.value.reduce((sum, f) => sum + f.size, 0))

const headers = [
    { title: 'Path', key: 'path', sortable: true },
    { title: 'Size', key: 'size', sortable: true, width: '150px' },
]

// Selection helpers
const selectAll = () => {
    selectedFolders.value = folders.value.map((f) => f.path)
}

const deselectAll = () => {
    selectedFolders.value = []
}

// Utility functions
const formatSize = (bytes) => filesize(bytes, { binary: true })

const openFolderTree = (folderPath) => {
    selectedFolderPath.value = folderPath
    showFolderTree.value = true
}

// Scan logic
const stopScan = async () => {
    statusText.value = 'Stopping scan...'

    try {
        await window.electronAPI.stopAppDataScan()
        statusText.value = 'Ready'
        emit('showNotification', 'Scan stopped by user', 'info')
    } catch (error) {
        console.error('Error stopping scan:', error)
        emit('showNotification', 'Error stopping scan: ' + error.message, 'error')
    } finally {
        isScanning.value = false
    }
}

const startScan = async () => {
    try {
        isScanning.value = true
        statusText.value = 'Getting AppData paths...'
        folders.value = []
        selectedFolders.value = []
        const seenPaths = new Set()

        const paths = await window.electronAPI.getAppDataPaths()
        if (paths.length === 0) {
            emit('showNotification', 'No AppData paths found!', 'warning')
            isScanning.value = false
            return
        }

        statusText.value = 'Scanning folders...'
        // Listen for real-time folder updates
        window.electronAPI.onScanFolderFound((folder) => {
            if (!seenPaths.has(folder.path)) {
                seenPaths.add(folder.path)
                const existingIndex = folders.value.findIndex(f => f.path === folder.path)
                if (existingIndex === -1) {
                    folders.value.push(folder)
                } else if (folders.value[existingIndex].size !== folder.size) {
                    folders.value[existingIndex] = folder
                }

            }
        })
        await window.electronAPI.scanFolders(paths, maxDepth.value)
        // Only sort and show success if we weren't terminated
        if (isScanning.value) {
            // Sort at the end for display
            folders.value.sort((a, b) => b.size - a.size)
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
            emit('showNotification', 'Error during scan: ' + error.message, 'error')
        }
    } finally {
        // Only update scanning state here if we haven't started stopping
        isScanning.value = false
    }
}

const rescanAffectedDirectories = async (deletedPaths) => {
    try {
        statusText.value = 'Updating affected directories...'

        // Get unique parent directories of deleted folders
        const parentDirs = new Set()
        const allAppDataPaths = await window.electronAPI.getAppDataPaths()

        deletedPaths.forEach(deletedPath => {
            // Find which AppData path contains this deleted folder
            const containingPath = allAppDataPaths.find(appDataPath =>
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

        const seenPaths = new Set(folders.value.map(f => f.path))

        // Listen for real-time folder updates
        window.electronAPI.onScanFolderFound((folder) => {
            if (!seenPaths.has(folder.path)) {
                seenPaths.add(folder.path)
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
        emit('showNotification', 'Error updating directories: ' + error.message, 'error')
    }
}

// Delete logic
const confirmDelete = () => {
    if (selectedFolders.value.length > 0) {
        showDeleteDialog.value = true
    }
}

const deleteFolders = async () => {
    try {
        showDeleteDialog.value = false
        isDeleting.value = true
        deleteProgress.value = 0
        statusText.value = 'Deleting folders...'

        const results = await window.electronAPI.deleteFolders([...selectedFolders.value])

        const successCount = results.filter((r) => r.success === true).length
        const partialCount = results.filter((r) => r.success === 'partial').length
        const failCount = results.filter((r) => r.success === false).length

        // Build notification message based on results
        let message = ''
        let color = 'success'

        if (failCount === 0 && partialCount === 0) {
            message = `Successfully deleted ${successCount} folders`
        } else if (successCount === 0 && partialCount === 0) {
            message = `Failed to delete ${failCount} folders`
            color = 'error'
        } else {
            // Mixed results
            const parts = []
            if (successCount > 0) parts.push(`${successCount} deleted`)
            if (partialCount > 0) parts.push(`${partialCount} partial`)
            if (failCount > 0) parts.push(`${failCount} failed`)

            message = parts.join(', ')
            color = partialCount > 0 || failCount > 0 ? 'warning' : 'success'
        }

        emit('showNotification', message, color)

        // Auto re-scan only affected parent directories after deletion
        if (successCount > 0 || partialCount > 0) {
            setTimeout(() => {
                rescanAffectedDirectories(selectedFolders.value)
            }, 1000)
        }
    } catch (error) {
        console.error('Delete error:', error)
        emit('showNotification', 'Error during deletion: ' + error.message, 'error')
    } finally {
        isDeleting.value = false
        deleteProgress.value = 0
    }
}

// Event listeners setup
const setupEventListeners = () => {
    // Ensure no duplicate listeners first
    window.electronAPI.removeAllListeners('scan-progress')
    window.electronAPI.removeAllListeners('scan-current-path')
    window.electronAPI.removeAllListeners('delete-progress')
    window.electronAPI.removeAllListeners('scan-folder-found')

    // Attach listeners
    window.electronAPI.onScanProgress((count) => {
        statusText.value = `Found ${count} folders`
    })

    window.electronAPI.onScanCurrentPath((path) => {
        statusText.value = `Scanning: ${path}`
    })

    window.electronAPI.onDeleteProgress((count) => {
        deleteProgress.value = (count / selectedFolders.value.length) * 100
    })
}

const removeEventListeners = () => {
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