<template>
    <v-card>
        <v-card-title>
            <span>{{ t(titleKey) }}</span>
            <v-spacer />
            <v-chip v-if="totalSize > 0" color="info" variant="outlined">
                {{ formatSize(selectedSize) }} / {{ formatSize(totalSize) }}
            </v-chip>
        </v-card-title>

        <div class="d-flex flex-wrap ga-3 px-4 pb-2">
            <v-text-field v-model="pathQuery" class="filter-path" :label="t('common.search_path')"
                prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" hide-details clearable
                autocomplete="off" />
            <v-select v-model="categoryFilter" class="filter-category" :items="categoryOptions"
                :label="t('common.filter_category')" density="compact" variant="outlined" hide-details />
        </div>

        <v-data-table :headers="headers" :items="filteredGroups" item-value="parentId" :loading="isScanning"
            :loading-text="t('common.loading')" :items-per-page="50"
            :sort-by="[{ key: 'size', order: 'desc' }]" class="dn-results-table">
            <template #item.label="{ item }">
                <div class="font-weight-medium">{{ item.parentLabel }}</div>
                <div class="text-caption text-medium-emphasis tool-desc">{{ item.parentDescription }}</div>
            </template>

            <template #item.categoryLabel="{ item }">
                <v-chip size="x-small" variant="tonal" color="info">{{ item.categoryLabel }}</v-chip>
            </template>

            <template #item.path="{ item }">
                <div class="d-flex align-center">
                    <v-btn icon variant="text" size="small" class="ml-2" :disabled="isScanning || isDeleting"
                        @click="openFolderTree(item.parentPath)">
                        <v-icon size="small" color="info">mdi-folder-open</v-icon>
                    </v-btn>
                    <v-btn icon variant="text" size="small" :disabled="isScanning || isDeleting"
                        @click="openInFileManager(item.parentPath)">
                        <v-icon size="small">mdi-open-in-new</v-icon>
                    </v-btn>
                    <v-btn icon variant="text" size="small" :disabled="isScanning || isDeleting"
                        @click="copyPath(item.parentPath)">
                        <v-icon size="small">mdi-content-copy</v-icon>
                    </v-btn>
                    <span class="flex-grow-1 dn-path" :title="item.parentPath">{{ item.parentPath }}</span>
                </div>
            </template>

            <template #item.parts="{ item }">
                <ToolCacheParts :parts="item.parts" :selected-paths="modelValue" :is-scanning="isScanning"
                    :is-deleting="isDeleting" @update:selected-paths="emit('update:modelValue', $event)"
                    @open-folder-tree="openFolderTree" @open-details="openDetails" />
            </template>

            <template #item.size="{ item }">
                <div class="dn-num">
                    <div class="font-weight-medium">{{ formatSize(selectedSizeFor(item)) }}</div>
                    <div v-if="selectedSizeFor(item) !== item.size" class="text-caption text-medium-emphasis">
                        {{ t('common.of') }} {{ formatSize(item.size) }} {{ t('common.total') }}
                    </div>
                </div>
            </template>
        </v-data-table>
    </v-card>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSize } from '@/utils/formatters'
import { matchesCategory, matchesPathQuery } from '@/utils/tableFilter'
import { selectedSizeForItems } from '@/utils/toolCacheSelection'
import type { ToolCacheItem } from '@/types'
import ToolCacheParts from './ToolCacheParts.vue'

interface ToolCacheGroup {
    parentId: string
    parentLabel: string
    parentPath: string
    parentDescription: string
    categoryLabel: string
    size: number
    parts: ToolCacheItem[]
}

const { t } = useI18n()

const props = withDefaults(defineProps<{
    items: ToolCacheItem[]
    modelValue: string[]
    isScanning: boolean
    isDeleting: boolean
    titleKey?: string
}>(), {
    titleKey: 'common.found_tool_caches'
})

const emit = defineEmits<{
    'update:modelValue': [value: string[]]
    'open-folder-tree': [path: string]
    'open-details': [item: ToolCacheItem]
}>()

const pathQuery = ref('')
const categoryFilter = ref('')
const copiedPath = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const headers = computed(() => [
    { title: t('common.tool'), key: 'label', sortable: true },
    { title: t('common.filter_category'), key: 'categoryLabel', sortable: true },
    { title: t('common.path'), key: 'path', sortable: false },
    { title: t('common.tool_parts'), key: 'parts', sortable: false },
    { title: t('common.size'), key: 'size', sortable: true, align: 'end' as const }
])

const groups = computed((): ToolCacheGroup[] => {
    const map = new Map<string, ToolCacheGroup>()
    for (const item of props.items) {
        const existing = map.get(item.parentId)
        if (existing) {
            existing.parts.push(item)
            existing.size += item.size
            continue
        }
        map.set(item.parentId, {
            parentId: item.parentId,
            parentLabel: item.parentLabel,
            parentPath: item.parentPath,
            parentDescription: item.parentDescription,
            categoryLabel: item.categoryLabel,
            size: item.size,
            parts: [item]
        })
    }
    for (const group of map.values()) {
        group.parts.sort((a, b) => b.size - a.size)
    }
    return [...map.values()].sort((a, b) => b.size - a.size)
})

const categoryOptions = computed(() => {
    const labels = [...new Set(groups.value.map(item => item.categoryLabel))].sort((a, b) =>
        a.localeCompare(b)
    )
    return [
        { title: t('common.all'), value: '' },
        ...labels.map(label => ({ title: label, value: label }))
    ]
})

const filteredGroups = computed(() =>
    groups.value.filter(group => {
        if (!matchesCategory(group.categoryLabel, categoryFilter.value)) return false
        if (!pathQuery.value.trim()) return true
        if (matchesPathQuery(group.parentPath, pathQuery.value)) return true
        return group.parts.some(part =>
            matchesPathQuery(part.path, pathQuery.value) ||
            part.label.toLowerCase().includes(pathQuery.value.trim().toLowerCase())
        )
    })
)

const totalSize = computed(() => props.items.reduce((sum, item) => sum + item.size, 0))

const selectedSize = computed(() => selectedSizeForItems(props.items, props.modelValue))

const selectedSizeFor = (group: ToolCacheGroup): number =>
    selectedSizeForItems(group.parts, props.modelValue)

const openFolderTree = (folderPath: string): void => {
    emit('open-folder-tree', folderPath)
}

const openDetails = (item: ToolCacheItem): void => {
    emit('open-details', item)
}

const openInFileManager = async (target: string): Promise<void> => {
    if (!target || !window.electronAPI?.openPath) return
    const error = await window.electronAPI.openPath(target)
    if (error) console.error(error)
}

const copyPath = async (text: string): Promise<void> => {
    if (!text || !window.electronAPI?.copyText) return
    await window.electronAPI.copyText(text)
    copiedPath.value = text
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
        if (copiedPath.value === text) copiedPath.value = null
    }, 2000)
}

onUnmounted(() => clearTimeout(copiedTimer))
</script>

<style scoped>
.filter-path {
    min-width: 220px;
    flex: 1 1 220px;
}

.filter-category {
    min-width: 180px;
    flex: 0 1 220px;
}

.tool-desc {
    max-width: 360px;
    white-space: normal;
    line-height: 1.35;
}
</style>
