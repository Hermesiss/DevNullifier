<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card>
                <v-card-text>
                    <v-row align="center">
                        <!-- Scan button -->
                        <v-col cols="auto">
                            <v-btn :color="isScanning ? 'error' : 'primary'"
                                :disabled="isDeleting || !hasEnabledCategories"
                                @click="isScanning ? stopScan() : startScan()">
                                <v-icon left>{{ isScanning ? 'mdi-stop' : 'mdi-magnify' }}</v-icon>
                                {{ isScanning ? 'Stop' : 'Scan Projects' }}
                            </v-btn>
                        </v-col>

                        <v-col cols="auto">
                            <v-btn color="info" :loading="isScanning" :disabled="isDeleting || savedProjectsCount === 0"
                                @click="$emit('quick-scan')" prepend-icon="mdi-flash">
                                Quick Scan ({{ savedProjectsCount }})
                            </v-btn>
                        </v-col>

                        <!-- Base Path Selection -->
                        <v-col cols="auto">
                            <v-btn variant="outlined" :disabled="isScanning || isDeleting" @click="selectBasePath">
                                <v-icon left>mdi-folder-open</v-icon>
                                Add Base Path
                            </v-btn>
                        </v-col>

                        <!-- Clear All Paths -->
                        <v-col cols="auto" v-if="basePaths.length > 1">
                            <v-btn variant="outlined" :disabled="isScanning || isDeleting" @click="clearAllPaths"
                                color="warning" size="small">
                                <v-icon left size="small">mdi-delete-sweep</v-icon>
                                Clear All
                            </v-btn>
                        </v-col>

                        <v-spacer />

                        <!-- Current base paths -->
                        <v-col cols="auto" v-if="basePaths.length > 0">
                            <div class="d-flex flex-wrap ga-2">
                                <v-tooltip v-for="path in basePaths" :key="path" :text="path" location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-chip v-bind="props" color="info" size="small" closable
                                            @click:close="removeBasePath(path)">
                                            <v-icon start size="small">mdi-folder</v-icon>
                                            {{ path.split('/').pop() || path.split('\\').pop() }}
                                        </v-chip>
                                    </template>
                                </v-tooltip>
                            </div>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-progress-linear :indeterminate="isScanning && scanProgress < 0" :height="4"
                    :model-value="isScanning ? scanProgress : 100" color="primary" />
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

// Props
const props = defineProps<{
    isScanning?: boolean
    isDeleting?: boolean
    hasEnabledCategories?: boolean
    scanProgress: number
}>()

// Emits
const emit = defineEmits<{
    'start-scan': [basePaths: string[]]
    'stop-scan': []
    'show-notification': [message: string, type?: string]
    'quick-scan': []
}>()

// Reactive state
const basePaths = ref<string[]>([])
const savedProjectsCount = ref(0)

// localStorage key
const STORAGE_KEYS = {
    BASE_PATHS: 'developer-cleaner-base-paths'
}

// Methods
const selectBasePath = async (): Promise<void> => {
    try {
        if (!window.electronAPI.selectDirectory) {
            emit('show-notification', 'Directory selection not yet implemented', 'warning')
            return
        }
        const result = await window.electronAPI.selectDirectory()
        if (result) {
            // Check for duplicates
            if (!basePaths.value.includes(result)) {
                basePaths.value.push(result)
                saveBasePaths()
                emit('show-notification', 'Base path added successfully', 'success')
            } else {
                emit('show-notification', 'Path already exists', 'warning')
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        emit('show-notification', 'Error selecting directory: ' + errorMessage, 'error')
    }
}

const startScan = (): void => {
    if (basePaths.value.length === 0) {
        emit('show-notification', 'Please select at least one base path first', 'warning')
        return
    }
    emit('start-scan', basePaths.value)
}

const stopScan = (): void => {
    emit('stop-scan')
}

const removeBasePath = (path: string): void => {
    basePaths.value = basePaths.value.filter(p => p !== path)
    saveBasePaths()
}

const clearAllPaths = (): void => {
    basePaths.value = []
    saveBasePaths()
    emit('show-notification', 'All base paths cleared', 'info')
}

const saveBasePaths = (): void => {
    localStorage.setItem(STORAGE_KEYS.BASE_PATHS, JSON.stringify(basePaths.value))
}

const loadBasePaths = (): void => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.BASE_PATHS)
        if (stored) {
            const paths: string[] = JSON.parse(stored)
            if (Array.isArray(paths)) {
                basePaths.value = paths
            }
        }
    } catch (error) {
        console.error('Error loading base paths:', error)
    }
}

// Set default base paths on mount
onMounted(async () => {
    // Load saved base paths
    loadBasePaths()

    // If no saved paths, set default
    if (basePaths.value.length === 0) {
        try {
            // Try to get user home if the API method exists
            if (window.electronAPI.getUserHome) {
                const userHome = await window.electronAPI.getUserHome()
                basePaths.value = [userHome]
            } else {
                // Fallback to common paths
                const isWindows = navigator.platform.indexOf('Win') > -1
                basePaths.value = isWindows ? ['C:\\Users\\'] : ['/home/']
            }
            saveBasePaths()
        } catch (error) {
            console.error('Error getting user home:', error)
            // Fallback to common paths
            const isWindows = navigator.platform.indexOf('Win') > -1
            basePaths.value = isWindows ? ['C:\\Users\\'] : ['/home/']
            saveBasePaths()
        }
    }

    savedProjectsCount.value = await window.electronAPI.getSavedDeveloperProjectsCount()
})

watch(() => props.isScanning, async (newVal) => {
    if (!newVal) {
        savedProjectsCount.value = await window.electronAPI.getSavedDeveloperProjectsCount()
    }
})

// Expose basePaths for parent access
defineExpose({
    basePaths
})
</script>

<style scoped>
/* Add any specific styles for the control panel here */
</style>