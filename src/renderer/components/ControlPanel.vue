<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card>
                <v-card-text>
                    <v-row align="center">
                        <!-- Scan button -->
                        <v-col cols="auto">
                            <v-btn color="primary" :loading="isScanning" :disabled="isDeleting" @click="$emit('scan')">
                                <v-icon left>mdi-magnify</v-icon>
                                Scan
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

<script setup>
import { computed } from 'vue'

const props = defineProps({
    isScanning: Boolean,
    isDeleting: Boolean,
    foldersLength: Number,
    maxDepth: {
        type: Number,
        default: 0,
    },
})

const depthLabel = computed(() => (props.maxDepth === 0 ? '∞' : String(props.maxDepth)))
</script>