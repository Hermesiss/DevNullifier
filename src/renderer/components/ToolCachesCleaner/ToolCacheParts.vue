<template>
    <div class="text-caption tool-parts">
        <div class="d-flex align-center pa-2 rounded dn-cache-header mb-1">
            <v-checkbox :model-value="groupCheckState ?? false" :indeterminate="groupCheckState === null"
                color="primary" hide-details density="compact" class="mr-2"
                :disabled="isScanning || isDeleting"
                @update:model-value="(value) => setAll(!!value)" />

            <v-btn v-if="parts.length > 1" icon variant="text" size="x-small" :disabled="isScanning || isDeleting"
                @click="expanded = !expanded">
                <v-icon size="small" :class="{ 'rotate-90': expanded }">mdi-chevron-right</v-icon>
            </v-btn>

            <div class="flex-grow-1">
                <div class="font-weight-medium">
                    <template v-if="parts.length === 1">
                        <span class="dn-path" style="white-space: normal">{{ parts[0].label }}</span>
                        • <span class="dn-num">{{ formatSize(parts[0].size) }}</span>
                    </template>
                    <template v-else>
                        {{ t('common.tool_parts_count', { count: parts.length }) }}
                    </template>
                </div>
                <div v-if="parts.length === 1" class="text-medium-emphasis">{{ parts[0].description }}</div>
                <div v-else class="text-medium-emphasis">
                    <span class="dn-num">{{ formatSize(selectedSize) }}</span>
                    {{ t('common.of') }}
                    <span class="dn-num">{{ formatSize(totalSize) }}</span>
                    {{ t('common.selected') }}
                </div>
            </div>
        </div>

        <v-expand-transition v-if="parts.length > 1">
            <div v-show="expanded" class="ml-4 mt-1">
                <div v-for="part in parts" :key="part.path" class="mb-2 d-flex align-start">
                    <v-checkbox :model-value="selectedPaths.includes(part.path)" color="primary" hide-details
                        density="compact" class="mr-2" :disabled="isScanning || isDeleting"
                        @update:model-value="(value) => togglePart(part.path, !!value)" />
                    <v-btn icon variant="text" size="x-small" class="mt-1" :disabled="isScanning || isDeleting"
                        @click="emit('open-folder-tree', part.path)">
                        <v-icon size="small" color="info">mdi-folder-open</v-icon>
                    </v-btn>
                    <div class="flex-grow-1">
                        <div class="font-weight-medium">{{ part.label }}</div>
                        <div class="text-medium-emphasis">{{ part.description }}</div>
                        <div class="text-medium-emphasis dn-path" :title="part.path">{{ part.path }}</div>
                        <div class="text-medium-emphasis dn-num">{{ formatSize(part.size) }}</div>
                    </div>
                </div>
            </div>
        </v-expand-transition>

        <div v-else class="d-flex align-center ml-2">
            <v-btn icon variant="text" size="x-small" :disabled="isScanning || isDeleting"
                @click="emit('open-folder-tree', parts[0].path)">
                <v-icon size="small" color="info">mdi-folder-open</v-icon>
            </v-btn>
            <span class="dn-path text-medium-emphasis" :title="parts[0].path">{{ parts[0].path }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSize } from '@/utils/formatters'
import type { ToolCacheItem } from '@/types'

const { t } = useI18n()

const props = defineProps<{
    parts: ToolCacheItem[]
    selectedPaths: string[]
    isScanning: boolean
    isDeleting: boolean
}>()

const emit = defineEmits<{
    'update:selectedPaths': [paths: string[]]
    'open-folder-tree': [path: string]
}>()

const expanded = ref(true)

const totalSize = computed(() => props.parts.reduce((sum, part) => sum + part.size, 0))
const selectedSize = computed(() =>
    props.parts
        .filter(part => props.selectedPaths.includes(part.path))
        .reduce((sum, part) => sum + part.size, 0)
)

const groupCheckState = computed<boolean | null>(() => {
    const selected = props.parts.filter(part => props.selectedPaths.includes(part.path)).length
    if (selected === 0) return false
    if (selected === props.parts.length) return true
    return null
})

const setAll = (on: boolean): void => {
    const partPaths = new Set(props.parts.map(part => part.path))
    const next = props.selectedPaths.filter(path => !partPaths.has(path))
    if (on) next.push(...props.parts.map(part => part.path))
    emit('update:selectedPaths', next)
}

const togglePart = (path: string, on: boolean): void => {
    const next = props.selectedPaths.filter(item => item !== path)
    if (on) next.push(path)
    emit('update:selectedPaths', next)
}
</script>

<style scoped>
.rotate-90 {
    transform: rotate(90deg);
}

.tool-parts {
    min-width: 280px;
}
</style>
