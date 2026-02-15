<template>
    <v-dialog v-model="showDialog" max-width="600">
        <v-card v-if="category">
            <v-card-title class="d-flex align-center">
                <span>{{ t('common.category_names.' + category.id) }}</span>
                <v-spacer />
                <v-chip v-if="category.warning" size="small" color="warning">
                    <v-icon start size="small">mdi-alert</v-icon>
                    {{ t('common.caution_required') }}
                </v-chip>
            </v-card-title>

            <v-card-text>
                <v-row>
                    <v-col cols="12">
                        <div class="mb-4">
                            <h4 class="text-subtitle-1 mb-2">{{ t('common.detection_files') }}</h4>
                            <v-chip-group>
                                <v-chip v-for="file in category.detectionFiles" :key="file" size="small"
                                    variant="outlined">
                                    {{ file }}
                                </v-chip>
                            </v-chip-group>
                        </div>

                        <div class="mb-4">
                            <h4 class="text-subtitle-1 mb-2">{{ t('common.cache_patterns_to_clean') }}</h4>
                            <v-chip-group>
                                <v-chip v-for="pattern in category.cachePatterns" :key="pattern" size="small"
                                    color="error" variant="outlined">
                                    {{ pattern }}
                                </v-chip>
                            </v-chip-group>
                        </div>

                        <div v-if="category.warning" class="mb-4">
                            <h4 class="text-subtitle-1 mb-2">⚠️ {{ t('common.warning') }}</h4>
                            <v-alert type="warning" variant="tonal" class="text-body-2">
                                {{ t('common.warnings.' + category.id) }}
                            </v-alert>
                        </div>
                    </v-col>
                </v-row>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn @click="closeDialog">{{ t('common.close') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeveloperCategory } from '@/types'

// i18n
const { t } = useI18n()

// Props
const props = defineProps<{
    modelValue?: boolean
    category?: DeveloperCategory | null
}>()

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

// Reactive state
const showDialog = ref(props.modelValue ?? false)

// Watch for changes in modelValue prop
watch(() => props.modelValue, (newValue) => {
    showDialog.value = newValue ?? false
})

// Watch for changes in showDialog and emit update
watch(showDialog, (newValue) => {
    emit('update:modelValue', newValue)
})

// Methods
const closeDialog = (): void => {
    showDialog.value = false
}
</script>

<style scoped>
/* Add any specific styles for the dialog here */
</style>