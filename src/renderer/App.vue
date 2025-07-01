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
          :max-depth="maxDepth.value" @scan="startScan" @select-all="selectAll" @deselect-all="deselectAll"
          @update:maxDepth="(val) => (maxDepth.value = val)" />

        <ResultsTable :folders="folders" v-model="selectedFolders" :is-scanning="isScanning" />

        <ActionsBar class="mt-4" :status-text="statusText" :delete-progress="deleteProgress"
          :selected-count="selectedFolders.length" :is-scanning="isScanning" :is-deleting="isDeleting"
          @delete="confirmDelete" />
      </v-container>
    </v-main>

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
    const startScan = async () => {
      try {
        isScanning.value = true
        statusText.value = 'Getting AppData paths...'
        folders.value = []
        selectedFolders.value = []

        const paths = await window.electronAPI.getAppDataPaths()
        if (paths.length === 0) {
          showNotification('No AppData paths found!', 'warning')
          return
        }

        statusText.value = 'Scanning folders...'
        // Listen for real-time folder updates
        window.electronAPI.onScanFolderFound((folder) => {
          folders.value.push(folder)
        })
        await window.electronAPI.scanFolders(paths, maxDepth.value)
        // Sort at the end for display
        folders.value.sort((a, b) => b.size - a.size)
        statusText.value = `Found ${folders.value.length} folders`
        if (folders.value.length === 0) {
          showNotification('No matching folders found', 'info')
        } else {
          showNotification(`Found ${folders.value.length} folders`, 'success')
        }
      } catch (error) {
        console.error('Scan error:', error)
        showNotification('Error during scan: ' + error.message, 'error')
      } finally {
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
        deleteProgress.value = 0
        statusText.value = 'Deleting folders...'

        const results = await window.electronAPI.deleteFolders([...selectedFolders.value])

        const successCount = results.filter((r) => r.success).length
        const failCount = results.length - successCount

        if (failCount > 0) {
          showNotification(`Deleted ${successCount} folders, ${failCount} failed`, 'warning')
        } else {
          showNotification(`Successfully deleted ${successCount} folders`, 'success')
        }

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
      confirmDelete,
      deleteFolders,
    }
  },
}
</script>

<style scoped>
/* keep component specific styles if needed */
</style>