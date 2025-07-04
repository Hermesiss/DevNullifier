<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card>
                <v-card-text>
                    <v-row align="center">
                        <!-- Scan button -->
                        <v-col cols="auto">
                            <v-btn :color="isScanning ? 'error' : 'primary'" :loading="false" :disabled="isDeleting"
                                @click="isScanning ? $emit('stop-scan') : $emit('scan')">
                                <v-icon left>{{ isScanning ? 'mdi-stop' : 'mdi-magnify' }}</v-icon>
                                {{ isScanning ? 'Stop' : 'Scan' }}

                            </v-btn>
                        </v-col>
                        <v-col cols="auto">
                            <v-btn color="info" :loading="isScanning" :disabled="isDeleting || savedFoldersCount === 0"
                                @click="$emit('quick-scan')" prepend-icon="mdi-flash">
                                Quick Scan ({{ savedFoldersCount }})
                            </v-btn>
                        </v-col>


                        <!-- Select / deselect -->
                        <v-col cols="auto">
                            <v-btn variant="outlined" :disabled="foldersLength === 0 || isScanning || isDeleting"
                                @click="$emit('select-all')">
                                Select All
                            </v-btn>
                        </v-col>
                        <v-col cols="auto">
                            <v-btn variant="outlined" :disabled="foldersLength === 0 || isScanning || isDeleting"
                                @click="$emit('deselect-all')">
                                Deselect All
                            </v-btn>
                        </v-col>

                        <!-- Depth slider -->
                        <v-col cols="auto">
                            <v-chip class="mr-2">Depth: {{ depthLabel }}</v-chip>
                            <v-slider :model-value="maxDepth" min="0" max="10" step="1" style="width: 120px"
                                :disabled="isScanning || isDeleting"
                                @update:modelValue="$emit('update:maxDepth', $event)" />
                        </v-col>

                        <v-spacer></v-spacer>
                    </v-row>
                </v-card-text>
                <v-progress-linear :indeterminate="scanProgress < 0" :height="4"
                    :model-value="isScanning ? scanProgress : 100" color="primary" />
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps<{
    isScanning: boolean
    isDeleting: boolean
    foldersLength: number
    maxDepth: number
    scanProgress: number
}>()

const emit = defineEmits<{
    scan: []
    'quick-scan': []
    'stop-scan': []
    'select-all': []
    'deselect-all': []
    'update:maxDepth': [value: number]
}>()

const savedFoldersCount = ref(0)

const depthLabel = computed(() => {
    return props.maxDepth === 0 ? 'All' : props.maxDepth
})


onMounted(async () => {
    savedFoldersCount.value = await window.electronAPI.getSavedFoldersCount()
})

watch(() => props.isScanning, async (newVal, oldVal) => {
    if (!newVal && oldVal) {
        // When scanning stops, update the saved folders count
        savedFoldersCount.value = await window.electronAPI.getSavedFoldersCount()
    }
})
</script>