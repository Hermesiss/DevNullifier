<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-broom</v-icon>
        DevNullifier
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon v-bind="props">
            <v-icon>{{ getThemeIcon() }}</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item v-for="mode in themeModes" :key="mode.value" @click="setThemeMode(mode.value)"
            :class="{ 'v-list-item--active': themeMode === mode.value }">
            <template v-slot:prepend>
              <v-icon>{{ mode.icon }}</v-icon>
            </template>
            <v-list-item-title>{{ mode.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
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

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import AppDataCleaner from './components/AppDataCleaner.vue'
import DeveloperCleaner from './components/DeveloperCleaner.vue'
import NotificationSnackbar from './components/NotificationSnackbar.vue'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeModeOption {
  value: ThemeMode
  title: string
  icon: string
}

// Theme functionality
const theme = useTheme()
const themeMode = ref<ThemeMode>('system')
let mediaQuery: MediaQueryList | null = null

// Theme mode options
const themeModes: ThemeModeOption[] = [
  { value: 'light', title: 'Light', icon: 'mdi-brightness-7' },
  { value: 'dark', title: 'Dark', icon: 'mdi-brightness-4' },
  { value: 'system', title: 'System', icon: 'mdi-brightness-auto' }
]

// Get system theme preference
const getSystemTheme = (): ThemeMode => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Apply theme based on mode
const applyTheme = (): void => {
  if (themeMode.value === 'system') {
    theme.global.name.value = getSystemTheme()
  } else {
    theme.global.name.value = themeMode.value
  }
}

// Get appropriate icon for current theme
const getThemeIcon = (): string => {
  if (themeMode.value === 'system') {
    return 'mdi-brightness-auto'
  }
  return theme.global.name.value === 'dark' ? 'mdi-brightness-4' : 'mdi-brightness-7'
}

// Set theme mode
const setThemeMode = (mode: ThemeMode): void => {
  themeMode.value = mode
  applyTheme()
}

// Handle system theme changes
const handleSystemThemeChange = (e: MediaQueryListEvent): void => {
  if (themeMode.value === 'system') {
    theme.global.name.value = e.matches ? 'dark' : 'light'
  }
}

// Load theme mode from localStorage on startup
onMounted(() => {
  const savedThemeMode = localStorage.getItem('devnullifier-theme-mode')
  if (savedThemeMode && ['light', 'dark', 'system'].includes(savedThemeMode)) {
    themeMode.value = savedThemeMode as ThemeMode
  }

  // Apply initial theme
  applyTheme()

  // Set up system theme change listener
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', handleSystemThemeChange)
})

// Cleanup on unmount
onUnmounted(() => {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }
})

// Watch for theme mode changes and save to localStorage
watch(themeMode, (newMode) => {
  localStorage.setItem('devnullifier-theme-mode', newMode)
})

// Reactive state
const activeTab = ref<'appdata' | 'developer'>('appdata')
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')

// Notifications
const showNotification = (text: string, color: string = 'info'): void => {
  snackbarText.value = text
  snackbarColor.value = color
  showSnackbar.value = true
}
</script>

<style scoped>
/* keep component specific styles if needed */
</style>