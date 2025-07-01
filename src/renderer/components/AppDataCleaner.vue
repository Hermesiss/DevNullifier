<template>
    <div>
        <ControlPanel :is-scanning="isScanning" :is-deleting="isDeleting" :folders-length="folders.length"
            :max-depth="maxDepth" @scan="startScan" @stop-scan="stopScan" @select-all="selectAll"
            @deselect-all="deselectAll" @update:maxDepth="val => maxDepth = val" />

        <ResultsTable :folders="folders" v-model="selectedFolders" :is-scanning="isScanning" />

        <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedFolders.length" :selected-size="selectedSize"
            @confirm="deleteFolders" />
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ControlPanel from './ControlPanel.vue'
import ResultsTable from './ResultsTable.vue'
import DeleteDialog from './DeleteDialog.vue'

// Reactive state
const folders = ref([])
const selectedFolders = ref([])
const maxDepth = ref(3)
const isScanning = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)

// Emit events to parent
const emit = defineEmits(['update:statusText', 'update:deleteProgress', 'showNotification'])

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

// Scan logic
const stopScan = async () => {
    emit('update:statusText', 'Stopping scan...')

    try {
        await window.electronAPI.stopScan()
        emit('update:statusText', 'Ready')
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
        emit('update:statusText', 'Getting AppData paths...')
        folders.value = []
        selectedFolders.value = []
        const seenPaths = new Set()

        const paths = await window.electronAPI.getAppDataPaths()
        if (paths.length === 0) {
            emit('showNotification', 'No AppData paths found!', 'warning')
            isScanning.value = false
            return
        }

        emit('update:statusText', 'Scanning folders...')
        // Listen for real-time folder updates
        window.electronAPI.onScanFolderFound((folder) => {
            if (!seenPaths.has(folder.path)) {
                seenPaths.add(folder.path)
                // Check if folder already exists in the array
                const existingIndex = folders.value.findIndex(f => f.path === folder.path)
                if (existingIndex === -1) {
                    folders.value.push(folder)
                } else {
                    // Update existing folder if size changed
                    if (folders.value[existingIndex].size !== folder.size) {
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
            emit('update:statusText', `Found ${folders.value.length} folders`)
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
        emit('update:deleteProgress', 0)
        emit('update:statusText', 'Deleting folders...')

        const results = await window.electronAPI.deleteFolders([...selectedFolders.value])

        const successCount = results.filter((r) => r.success === true).length
        const partialCount = results.filter((r) => r.success === 'partial').length
        const failCount = results.filter((r) => r.success === false).length

        // Build notification message based on results
        let message = ''
        let color = 'success'

        if (failCount === 0 && partialCount === 0) {
            message = `Successfully deleted ${successCount} folders`
            color = 'success'
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

        // Auto re-scan after deletion
        setTimeout(() => {
            startScan()
        }, 1000)
    } catch (error) {
        console.error('Delete error:', error)
        emit('showNotification', 'Error during deletion: ' + error.message, 'error')
    } finally {
        isDeleting.value = false
        emit('update:deleteProgress', 0)
    }
}

// Expose methods and computed properties for parent
defineExpose({
    confirmDelete,
    selectedFolders,
    isDeleting,
    isScanning
})
</script>