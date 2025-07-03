<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-broom</v-icon>
        DevNullifier
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <v-tabs v-model="activeTab" color="primary" class="mb-4">
          <v-tab value="appdata">
            <v-icon left>mdi-folder-remove</v-icon>
            Application Data
          </v-tab>
          <v-tab value="developer">
            <v-icon left>mdi-code-braces</v-icon>
            Developer Cache
          </v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab">
          <v-tabs-window-item value="appdata">
            <AppDataCleaner @showNotification="showNotification" />
          </v-tabs-window-item>

          <v-tabs-window-item value="developer">
            <DeveloperCleaner @showNotification="showNotification" />
          </v-tabs-window-item>
        </v-tabs-window>
      </v-container>
    </v-main>



    <NotificationSnackbar v-model="showSnackbar" :text="snackbarText" :color="snackbarColor" />
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import AppDataCleaner from './components/AppDataCleaner.vue'
import DeveloperCleaner from './components/DeveloperCleaner.vue'
import NotificationSnackbar from './components/NotificationSnackbar.vue'

// Reactive state
const activeTab = ref('appdata')
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')

// Notifications
const showNotification = (text, color = 'info') => {
  snackbarText.value = text
  snackbarColor.value = color
  showSnackbar.value = true
}
</script>

<style scoped>
/* keep component specific styles if needed */
</style>