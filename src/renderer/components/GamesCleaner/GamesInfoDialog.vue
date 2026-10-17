<template>
    <v-dialog v-model="showDialog" max-width="560">
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon start>mdi-information-outline</v-icon>
                {{ t('common.games_info_title') }}
            </v-card-title>
            <v-card-text>
                <p class="mb-3">{{ t('common.games_info_body') }}</p>
                <p class="mb-0 text-medium-emphasis">{{ t('common.games_info_rescan') }}</p>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn @click="showDialog = false">{{ t('common.close') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
    modelValue?: boolean
}>()

const emit = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

const showDialog = ref(props.modelValue ?? false)

watch(() => props.modelValue, (value) => {
    showDialog.value = value ?? false
})

watch(showDialog, (value) => {
    emit('update:modelValue', value)
})
</script>
