<template>
    <v-dialog v-model="showDialog" max-width="600">
        <v-card v-if="category">
            <v-card-title class="d-flex align-center">
                <span>{{ category.name }}</span>
                <v-spacer />
                <v-chip v-if="category.warning" size="small" color="warning">
                    <v-icon start size="small">mdi-alert</v-icon>
                    Caution Required
                </v-chip>
            </v-card-title>

            <v-card-text>
                <v-row>
                    <v-col cols="12">
                        <div class="mb-4">
                            <h4 class="text-subtitle-1 mb-2">Detection Files</h4>
                            <v-chip-group>
                                <v-chip v-for="file in category.detectionFiles" :key="file" size="small"
                                    variant="outlined">
                                    {{ file }}
                                </v-chip>
                            </v-chip-group>
                        </div>

                        <div class="mb-4">
                            <h4 class="text-subtitle-1 mb-2">Cache Patterns to Clean</h4>
                            <v-chip-group>
                                <v-chip v-for="pattern in category.cachePatterns" :key="pattern" size="small"
                                    color="error" variant="outlined">
                                    {{ pattern }}
                                </v-chip>
                            </v-chip-group>
                        </div>

                        <div v-if="category.warning" class="mb-4">
                            <h4 class="text-subtitle-1 mb-2">⚠️ Warning</h4>
                            <v-alert type="warning" variant="tonal" class="text-body-2">
                                {{ category.warningText }}
                            </v-alert>
                        </div>
                    </v-col>
                </v-row>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn @click="closeDialog">Close</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

// Props
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    category: {
        type: Object,
        default: null
    }
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Reactive state
const showDialog = ref(props.modelValue)

// Watch for changes in modelValue prop
watch(() => props.modelValue, (newValue) => {
    showDialog.value = newValue
})

// Watch for changes in showDialog and emit update
watch(showDialog, (newValue) => {
    emit('update:modelValue', newValue)
})

// Methods
const closeDialog = () => {
    showDialog.value = false
}
</script>

<style scoped>
/* Add any specific styles for the dialog here */
</style>