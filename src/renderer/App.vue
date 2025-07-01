<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-broom</v-icon>
        System Cleaner
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <v-tabs v-model="activeTab" color="primary" class="mb-4">
          <v-tab value="appdata">
            <v-icon left>mdi-folder-remove</v-icon>
            AppData Cleaner
          </v-tab>
          <v-tab value="developer">
            <v-icon left>mdi-code-braces</v-icon>
            Developer Cache
          </v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab">
          <v-tabs-window-item value="appdata">
            <AppDataCleaner ref="appDataCleanerRef" @update:statusText="statusText = $event"
              @update:deleteProgress="deleteProgress = $event" @showNotification="showNotification" />
          </v-tabs-window-item>

          <v-tabs-window-item value="developer">
            <DeveloperCleaner ref="developerCleanerRef" @update:statusText="statusText = $event"
              @showNotification="showNotification" />
          </v-tabs-window-item>
        </v-tabs-window>
      </v-container>
    </v-main>

    <v-footer app class="pa-0">
      <ActionsBar :status-text="statusText" :delete-progress="deleteProgress" :selected-count="selectedCount"
        :is-scanning="isScanning" :is-deleting="isDeleting" @delete="handleDelete" />
    </v-footer>

    <NotificationSnackbar v-model="showSnackbar" :text="snackbarText" :color="snackbarColor" />
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppDataCleaner from './components/AppDataCleaner.vue'
import DeveloperCleaner from './components/DeveloperCleaner.vue'
import ActionsBar from './components/ActionsBar.vue'
import NotificationSnackbar from './components/NotificationSnackbar.vue'

// Reactive state
const activeTab = ref('appdata')
const deleteProgress = ref(0)
const statusText = ref('Ready')
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')

// Component refs
const appDataCleanerRef = ref(null)
const developerCleanerRef = ref(null)

// Computed properties for current active cleaner
const currentCleaner = computed(() => {
  return activeTab.value === 'appdata' ? appDataCleanerRef.value : developerCleanerRef.value
})

const selectedCount = computed(() => {
  if (!currentCleaner.value) return 0
  return currentCleaner.value.selectedFolders?.length || currentCleaner.value.selectedProjects?.length || 0
})

const isScanning = computed(() => {
  return currentCleaner.value?.isScanning || false
})

const isDeleting = computed(() => {
  return currentCleaner.value?.isDeleting || false
})

// Notifications
const showNotification = (text, color = 'info') => {
  snackbarText.value = text
  snackbarColor.value = color
  showSnackbar.value = true
}

// Delete action handler
const handleDelete = () => {
  if (currentCleaner.value && currentCleaner.value.confirmDelete) {
    currentCleaner.value.confirmDelete()
  }
}

// Event listeners setup for AppData cleaner
const setupEventListeners = () => {
  // Ensure no duplicate listeners first
  window.electronAPI.removeAllListeners('scan-progress')
  window.electronAPI.removeAllListeners('scan-current-path')
  window.electronAPI.removeAllListeners('delete-progress')
  window.electronAPI.removeAllListeners('scan-folder-found')

  // Attach listeners for AppData cleaner
  window.electronAPI.onScanProgress((count) => {
    if (activeTab.value === 'appdata') {
      statusText.value = `Found ${count} folders`
    }
  })

  window.electronAPI.onScanCurrentPath((path) => {
    if (activeTab.value === 'appdata') {
      statusText.value = `Scanning: ${path}`
    }
  })

  window.electronAPI.onDeleteProgress((count) => {
    if (activeTab.value === 'appdata' && appDataCleanerRef.value?.selectedFolders) {
      deleteProgress.value = (count / appDataCleanerRef.value.selectedFolders.length) * 100
    }
  })
}

const removeEventListeners = () => {
  window.electronAPI.removeAllListeners('scan-progress')
  window.electronAPI.removeAllListeners('scan-current-path')
  window.electronAPI.removeAllListeners('delete-progress')
}

onMounted(setupEventListeners)
onUnmounted(removeEventListeners)
</script>

<style scoped>
/* keep component specific styles if needed */
</style>