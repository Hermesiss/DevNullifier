<template>
    <v-card v-if="failures.length > 0" class="mt-4 mb-4" variant="tonal" color="error">
        <v-card-text class="py-2">
            <div v-for="item in failures" :key="item.path" class="d-flex align-center flex-wrap py-1">
                <span class="flex-grow-1 text-body-2 text-break mr-2">
                    {{ t('common.delete_failed', { path: item.path, code: item.code || 'error' }) }}
                    <span v-if="lockNames[item.path]"> ({{ lockNames[item.path] }})</span>
                </span>
                <v-btn v-if="isWindows" class="mr-2" size="small" variant="outlined"
                    :loading="lockingPath === item.path" :disabled="disabled" @click="whoLocks(item.path)">
                    {{ t('common.who_locks') }}
                </v-btn>
                <v-btn size="small" color="primary" variant="flat" :disabled="disabled"
                    @click="emit('retry', item.path)">
                    {{ t('common.retry') }}
                </v-btn>
            </div>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeleteResult } from '@/types'

defineProps<{
    failures: DeleteResult[]
    disabled?: boolean
}>()

const emit = defineEmits<{
    retry: [path: string]
}>()

const { t } = useI18n()
const isWindows = window.electronAPI.platform === 'win32'
const lockNames = ref<Record<string, string>>({})
const lockingPath = ref<string | null>(null)

const whoLocks = async (target: string): Promise<void> => {
    if (lockingPath.value) return
    lockingPath.value = target
    try {
        const name = await window.electronAPI.lockingProcess(target)
        if (name) lockNames.value = { ...lockNames.value, [target]: name }
    } catch (error) {
        console.error('Locking process lookup failed:', error)
    } finally {
        if (lockingPath.value === target) lockingPath.value = null
    }
}
</script>
