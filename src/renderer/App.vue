<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-broom</v-icon>
        DevNullifier
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <v-btn v-if="showRelaunchElevated" class="mr-2" variant="text" @click="relaunchElevated">
        <v-icon left>mdi-shield-account</v-icon>
        {{ t('common.relaunch_elevated') }}
        <v-tooltip activator="parent" location="bottom">{{ t('common.relaunch_elevated_hint') }}</v-tooltip>
      </v-btn>

      <UpdateButton class="mr-2" />

      <v-btn icon class="mr-2" @click="showDeletionLog = true">
        <v-icon>mdi-history</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ t('common.deletion_log') }}</v-tooltip>
      </v-btn>

      <v-btn icon @click="showSettings = true">
        <v-icon>mdi-cog</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ t('common.settings') }}</v-tooltip>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <v-tabs v-model="activeTab" color="primary" class="mb-4">
          <v-tab value="appdata">
            <v-icon left>mdi-folder-remove</v-icon>
            {{ t('app.tabs.appdata') }}
          </v-tab>
          <v-tab value="developer">
            <v-icon left>mdi-code-braces</v-icon>
            {{ t('app.tabs.developer') }}
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
    <SettingsDialog
      v-model="showSettings"
      :language="locale"
      :theme-mode="themeMode"
      @update:language="setLanguage"
      @update:theme-mode="setThemeMode"
    />

    <v-dialog v-model="showDeletionLog" max-width="960">
      <v-card>
        <v-card-title>
          <v-icon left>mdi-history</v-icon>
          {{ t('common.deletion_log') }}
        </v-card-title>
        <v-card-text class="deletion-log-body">
          <p v-if="deletionLog.length === 0" class="text-medium-emphasis mb-0">{{ t('common.log_empty') }}</p>
          <v-table v-else density="compact">
            <thead>
              <tr>
                <th>{{ t('common.last_updated') }}</th>
                <th>{{ t('common.path') }}</th>
                <th class="text-end">{{ t('common.size') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, index) in deletionLog" :key="`${entry.at}-${index}`">
                <td class="text-no-wrap">{{ formatDate(entry.at) }}</td>
                <td class="deletion-log-path" :title="entry.path">{{ entry.path }}</td>
                <td class="text-end text-no-wrap">{{ formatSize(entry.size) }}</td>
                <td class="text-no-wrap">{{ t('common.log_status_' + entry.status) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="text" @click="exportDeletionLog">
            {{ t('common.export_csv') }}
          </v-btn>
          <v-btn variant="text" @click="showDeletionLog = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'
import AppDataCleaner from './components/AppDataCleaner.vue'
import DeveloperCleaner from './components/DeveloperCleaner.vue'
import NotificationSnackbar from './components/NotificationSnackbar.vue'
import UpdateButton from './components/UpdateButton.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { formatDate, formatSize } from './utils/formatters'
import type { DeletionLogEntry } from '../main/deletionLog'
import { accessDeniedOutsideProfile } from './composables/useElevationPrompt'

const { t, locale } = useI18n()

// Language functionality
type LanguageCode = 'en' | 'ru'

const setLanguage = (lang: LanguageCode) => {
  locale.value = lang
  localStorage.setItem('devnullifier-language', lang)
}

type ThemeMode = 'light' | 'dark' | 'system'

// Theme functionality
const theme = useTheme()
const themeMode = ref<ThemeMode>('system')
let mediaQuery: MediaQueryList | null = null

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

const platform = ref<NodeJS.Platform | ''>('')
const showRelaunchElevated = computed(
  () => accessDeniedOutsideProfile.value && platform.value === 'win32'
)

const relaunchElevated = async (): Promise<void> => {
  await window.electronAPI.relaunchElevated()
}

// Load theme mode and language from localStorage on startup
onMounted(async () => {
  const savedThemeMode = localStorage.getItem('devnullifier-theme-mode')
  if (savedThemeMode && ['light', 'dark', 'system'].includes(savedThemeMode)) {
    themeMode.value = savedThemeMode as ThemeMode
  }

  // Language initialization
  const savedLanguage = localStorage.getItem('devnullifier-language') as LanguageCode | null
  if (savedLanguage && ['en', 'ru'].includes(savedLanguage)) {
    locale.value = savedLanguage
  } else {
    // Detect OS language
    try {
      const osLocale = await window.electronAPI.getLocale()
      if (osLocale.startsWith('ru')) {
        locale.value = 'ru'
      } else {
        locale.value = 'en'
      }
    } catch (e) {
      console.error('Failed to get OS locale:', e)
      locale.value = 'en'
    }
  }

  try {
    platform.value = await window.electronAPI.getPlatform()
  } catch (error) {
    console.error('Failed to read platform:', error)
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
const showSettings = ref(false)
const showDeletionLog = ref(false)
const deletionLog = ref<DeletionLogEntry[]>([])
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')

// Notifications
const showNotification = (text: string, color: string = 'info'): void => {
  snackbarText.value = text
  snackbarColor.value = color
  showSnackbar.value = true
}

watch(showDeletionLog, (open) => {
  if (!open) return
  void refreshDeletionLog()
})

const refreshDeletionLog = async (): Promise<void> => {
  try {
    deletionLog.value = await window.electronAPI.getDeletionLog()
  } catch (error) {
    console.error('Failed to load deletion log:', error)
    deletionLog.value = []
  }
}

const exportDeletionLog = async (): Promise<void> => {
  try {
    await window.electronAPI.exportDeletionLog()
  } catch (error) {
    console.error('Failed to export deletion log:', error)
  }
}
</script>

<style scoped>
.deletion-log-body {
  max-height: 60vh;
  overflow: auto;
}

.deletion-log-path {
  word-break: break-all;
}
</style>