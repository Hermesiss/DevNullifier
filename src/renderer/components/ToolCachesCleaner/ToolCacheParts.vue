<template>
    <div class="text-caption tool-parts">
        <template v-if="aggregated">
            <div class="d-flex align-center pa-2 rounded dn-cache-header mb-1">
                <v-checkbox :model-value="aggregateCheckState ?? false"
                    :indeterminate="aggregateCheckState === null" color="primary" hide-details density="compact"
                    class="mr-2" :disabled="isScanning || isDeleting"
                    @update:model-value="(value) => setAggregateAll(!!value)" />
                <div class="flex-grow-1">
                    <div class="font-weight-medium">
                        {{ t('common.temp_entries_count', { count: aggregateChildren.length }) }}
                    </div>
                    <div class="text-medium-emphasis">
                        <span class="dn-num">{{ formatSize(aggregateSelectedSize) }}</span>
                        {{ t('common.of') }}
                        <span class="dn-num">{{ formatSize(aggregateTotalSize) }}</span>
                        {{ t('common.selected') }}
                    </div>
                </div>
                <v-btn size="small" variant="tonal" color="info" class="ml-2"
                    :disabled="isScanning || isDeleting" @click="emit('open-details', parts[0])">
                    {{ t('common.temp_details') }}
                </v-btn>
            </div>
            <div class="d-flex align-center ml-2">
                <v-btn icon variant="text" size="x-small" :disabled="isScanning || isDeleting"
                    @click="emit('open-folder-tree', parts[0].parentPath || parts[0].path)">
                    <v-icon size="small" color="info">mdi-folder-open</v-icon>
                </v-btn>
                <span class="dn-path text-medium-emphasis"
                    :title="parts[0].parentPath || parts[0].path">{{ parts[0].parentPath || parts[0].path }}</span>
            </div>
        </template>

        <template v-else>
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
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSize } from '@/utils/formatters'
import { selectableCachePaths } from '@/utils/toolCacheSelection'
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
    'open-details': [item: ToolCacheItem]
}>()

const expanded = ref(true)

const aggregated = computed(
    () => props.parts.length === 1 && props.parts[0].aggregated === true
)

const aggregateChildren = computed(() => props.parts[0]?.children ?? [])

const aggregateTotalSize = computed(() =>
    aggregateChildren.value.reduce((sum, child) => sum + child.size, 0)
)

const aggregateSelectedSize = computed(() =>
    aggregateChildren.value
        .filter(child => props.selectedPaths.includes(child.path))
        .reduce((sum, child) => sum + child.size, 0)
)

const aggregateCheckState = computed<boolean | null>(() => {
    const paths = aggregateChildren.value.map(child => child.path)
    if (paths.length === 0) return false
    const selected = paths.filter(path => props.selectedPaths.includes(path)).length
    if (selected === 0) return false
    if (selected === paths.length) return true
    return null
})

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

const setAggregateAll = (on: boolean): void => {
    const childPaths = new Set(selectableCachePaths(props.parts[0]))
    const next = props.selectedPaths.filter(path => !childPaths.has(path))
    if (on) next.push(...childPaths)
    emit('update:selectedPaths', next)
}

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
