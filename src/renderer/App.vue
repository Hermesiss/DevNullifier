<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-broom</v-icon>
        DevNullifier
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <UpdateButton class="mr-2" />

      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon v-bind="props">
            <v-icon>{{ getThemeIcon() }}</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ t('theme.' + themeMode) }}</v-tooltip>
          </v-btn>
        </template>
        <v-list>
          <v-list-item v-for="mode in themeModes" :key="mode.value" @click="setThemeMode(mode.value)"
            :class="{ 'v-list-item--active': themeMode === mode.value }">
            <template v-slot:prepend>
              <v-icon>{{ mode.icon }}</v-icon>
            </template>
            <v-list-item-title>{{ t('theme.' + mode.value) }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon v-bind="props">
            <span class="text-h6">{{ currentLanguage.icon }}</span>
            <v-tooltip activator="parent" location="bottom">{{ currentLanguage.title }}</v-tooltip>
          </v-btn>
        </template>
        <v-list>
          <v-list-item v-for="lang in languages" :key="lang.value" @click="setLanguage(lang.value)"
            :class="{ 'v-list-item--active': locale === lang.value }">
            <template v-slot:prepend>
              <span class="mr-2">{{ lang.icon }}</span>
            </template>
            <v-list-item-title>{{ lang.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
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

const { t, locale } = useI18n()

// Language functionality
type LanguageCode = 'en' | 'ru'

interface LanguageOption {
  value: LanguageCode
  title: string
  icon: string
}

const languages: LanguageOption[] = [
  { value: 'en', title: 'English', icon: '🇺🇸' },
  { value: 'ru', title: 'Русский', icon: '🇷🇺' }
]

const currentLanguage = computed(() => {
  return languages.find(l => l.value === locale.value) || languages[0]
})

const setLanguage = (lang: LanguageCode) => {
  locale.value = lang
  localStorage.setItem('devnullifier-language', lang)
}

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