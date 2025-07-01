<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-folder-remove</v-icon>
        AppData Cleaner
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <ControlPanel :is-scanning="isScanning" :is-deleting="isDeleting" :folders-length="folders.length"
          :max-depth="maxDepth" @scan="startScan" @stop-scan="stopScan" @select-all="selectAll"
          @deselect-all="deselectAll" @update:maxDepth="val => maxDepth = val" />

        <ResultsTable :folders="folders" v-model="selectedFolders" :is-scanning="isScanning" />
      </v-container>
    </v-main>

    <v-footer app class="pa-0">
      <ActionsBar :status-text="statusText" :delete-progress="deleteProgress" :selected-count="selectedFolders.length"
        :is-scanning="isScanning" :is-deleting="isDeleting" @delete="confirmDelete" />
    </v-footer>

    <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedFolders.length" :selected-size="selectedSize"
      @confirm="deleteFolders" />

    <NotificationSnackbar v-model="showSnackbar" :text="snackbarText" :color="snackbarColor" />
  </v-app>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import ResultsTable from './components/ResultsTable.vue'
import ActionsBar from './components/ActionsBar.vue'
import DeleteDialog from './components/DeleteDialog.vue'
import NotificationSnackbar from './components/NotificationSnackbar.vue'

export default {
  name: 'App',
  components: {
    ControlPanel,
    ResultsTable,
    ActionsBar,
    DeleteDialog,
    NotificationSnackbar,
  },
  setup() {
    // Reactive state
    const folders = ref([])
    const selectedFolders = ref([])
    const maxDepth = ref(3)
    const isScanning = ref(false)
    const isDeleting = ref(false)
    const deleteProgress = ref(0)
    const statusText = ref('Ready')
    const showDeleteDialog = ref(false)
    const showSnackbar = ref(false)
    const snackbarText = ref('')
    const snackbarColor = ref('info')

    // Computed properties
    const selectedSize = computed(() => {
      return selectedFolders.value.reduce((sum, path) => {
        const folder = folders.value.find((f) => f.path === path)
        return sum + (folder ? folder.size : 0)
      }, 0)
    })

    // Notifications
    const showNotification = (text, color = 'info') => {
      snackbarText.value = text
      snackbarColor.value = color
      showSnackbar.value = true
    }

    // Selection helpers
    const selectAll = () => {
      selectedFolders.value = folders.value.map((f) => f.path)
    }

    const deselectAll = () => {
      selectedFolders.value = []
    }

    // Scan logic
    const stopScan = async () => {
      // Don't change isScanning yet, just update status
      statusText.value = 'Stopping scan...'

      try {
        await window.electronAPI.stopScan()
        statusText.value = 'Ready'
        showNotification('Scan stopped by user', 'info')
      } catch (error) {
        console.error('Error stopping scan:', error)
        showNotification('Error stopping scan: ' + error.message, 'error')
      } finally {
        // Only disable scanning state after the worker is fully stopped
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
          showNotification('No AppData paths found!', 'warning')
          isScanning.value = false
          return
        }

        statusText.value = 'Scanning folders...'
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
          statusText.value = `Found ${folders.value.length} folders`
          if (folders.value.length === 0) {
            showNotification('No matching folders found', 'info')
          } else {
            showNotification(`Found ${folders.value.length} folders`, 'success')
          }
        }
      } catch (error) {
        console.error('Scan error:', error)
        // Only show error notification if we weren't terminated
        if (isScanning.value) {
          showNotification('Error during scan: ' + error.message, 'error')
        }
      } finally {
        // Only update scanning state here if we haven't started stopping
        if (statusText.value !== 'Stopping scan...') {
          isScanning.value = false
        }
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

        showNotification(message, color)

        // Auto re-scan after deletion
        setTimeout(() => {
          startScan()
        }, 1000)
      } catch (error) {
        console.error('Delete error:', error)
        showNotification('Error during deletion: ' + error.message, 'error')
      } finally {
        isDeleting.value = false
        deleteProgress.value = 0
      }
    }

    // Event listeners
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

    return {
      // state
      folders,
      selectedFolders,
      maxDepth,
      isScanning,
      isDeleting,
      deleteProgress,
      statusText,
      showDeleteDialog,
      showSnackbar,
      snackbarText,
      snackbarColor,
      selectedSize,
      // methods
      selectAll,
      deselectAll,
      startScan,
      stopScan,
      confirmDelete,
      deleteFolders,
    }
  },
}
</script>

<style scoped>
/* keep component specific styles if needed */
</style>