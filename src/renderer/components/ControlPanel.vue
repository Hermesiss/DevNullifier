<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card>
                <v-card-text>
                    <v-row align="center">
                        <!-- Scan button -->
                        <v-col cols="auto">
                            <v-btn :color="isScanning ? 'error' : 'primary'" :loading="false" :disabled="isDeleting"
                                @click="handleScanClick">
                                <v-icon left>{{ isScanning ? 'mdi-stop' : 'mdi-magnify' }}</v-icon>
                                {{ isScanning ? 'Stop' : 'Scan' }}
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

                        <!-- Spinner when scanning -->
                        <v-col cols="auto" v-if="isScanning">
                            <v-progress-circular indeterminate color="primary" size="24" />
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    isScanning: boolean
    isDeleting: boolean
    foldersLength: number
    maxDepth?: number
}>()

const emit = defineEmits<{
    'stop-scan': []
    scan: []
    'select-all': []
    'deselect-all': []
    'update:maxDepth': [value: number]
}>()

const handleScanClick = (): void => {
    if (props.isScanning) {
        emit('stop-scan')
    } else {
        emit('scan')
    }
}

const depthLabel = computed(() => (props.maxDepth === 0 ? '∞' : String(props.maxDepth)))
</script>