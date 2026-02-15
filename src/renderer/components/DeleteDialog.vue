<template>
    <v-dialog v-model="show" max-width="500">
        <v-card>
            <v-card-title class="text-h5">
                <v-icon left color="error">mdi-alert</v-icon>
                {{ t('common.confirm_deletion') }}
            </v-card-title>

            <v-card-text>
                <p>{{ t('common.delete_folders_count', { count: selectedCount }) }}</p>
                <p class="text-warning">⚠️ {{ t('common.delete_warning') }}</p>
                <p>{{ t('common.total_size_deleted', { size: formatSize(selectedSize) }) }}</p>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn @click="show = false">{{ t('common.cancel') }}</v-btn>
                <v-btn color="error" @click="confirmDelete">{{ t('common.delete') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSize } from '@/utils/formatters'

const { t } = useI18n()

const props = defineProps<{
    modelValue: boolean
    selectedCount: number
    selectedSize: number
}>()

const emits = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'confirm'): void
}>()

const show = computed({
    get: () => props.modelValue,
    set: (val: boolean) => emits('update:modelValue', val),
})

const confirmDelete = () => {
    show.value = false
    emits('confirm')
}
</script>