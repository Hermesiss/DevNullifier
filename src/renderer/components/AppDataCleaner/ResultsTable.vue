<template>
    <v-card>
        <v-card-title>
            <span>{{ t('common.found_folders') }}</span>
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

        <v-data-table v-model="selected" :headers="translatedHeaders" :items="filteredItems" :items-per-page="50"
            item-value="path" show-select :select-strategy="tableSelectStrategy" :loading="isScanning"
            :loading-text="t('common.loading')" :sort-by="[{ key: 'size', order: 'desc' }]" class="elevation-1">
            <template #item.keyword="{ item }">
                {{ item.keyword }}
            </template>

            <template #item.size="{ item }">
                {{ formatSize(item.size) }}
            </template>

            <template #item.path="{ item }">
                <div class="d-flex align-center">
                    <v-btn icon variant="text" size="small" @click="openFolderTree(item.path)" :disabled="isScanning"
                        class="ml-2">
                        <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                    </v-btn>
                    <v-btn icon variant="text" size="small" :disabled="isScanning" :aria-label="t('common.open_folder')"
                        @click="openInFileManager(item.path)">
                        <v-icon size="small">mdi-open-in-new</v-icon>
                        <v-tooltip activator="parent" location="bottom">{{ t('common.open_folder') }}</v-tooltip>
                    </v-btn>
                    <v-btn icon variant="text" size="small" :disabled="isScanning"
                        :aria-label="copiedPath === item.path ? t('common.copied') : t('common.copy_path')"
                        @click="copyPath(item.path)">
                        <v-icon size="small">mdi-content-copy</v-icon>
                        <v-tooltip activator="parent" location="bottom">
                            {{ copiedPath === item.path ? t('common.copied') : t('common.copy_path') }}
                        </v-tooltip>
                    </v-btn>
                    <span class="flex-grow-1">
                        {{ item.path }}
                    </span>
                </div>
            </template>
        </v-data-table>
    </v-card>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { failsThreshold } from '../../../main/thresholds'
import { minAgeDays, minSizeMb } from '../../composables/useCleanerRules'
import { formatSize } from '@/utils/formatters'
import { matchesCategory, matchesPathQuery } from '@/utils/tableFilter'
import { FolderItem } from '@/types/common'

type PageRow = { value: unknown; raw?: FolderItem }

function rowFails(item: PageRow): boolean {
    const folder = item.raw
    if (!folder) return false
    return failsThreshold(folder.size, folder.modifiedAt, {
        minAgeDays: minAgeDays.value,
        minSizeMb: minSizeMb.value
    })
}

// Header select-all is the current page. Skip rows that fail the threshold; row clicks still select them.
const tableSelectStrategy = {
    showSelectAll: true,
    allSelected(data: { currentPage: PageRow[] }) {
        return data.currentPage.filter(item => !rowFails(item))
    },
    select(data: { items: PageRow[]; value: boolean; selected: Set<unknown> }) {
        for (const item of data.items) {
            if (data.value) data.selected.add(item.value)
            else data.selected.delete(item.value)
        }
        return data.selected
    },
    selectAll(data: { value: boolean; currentPage: PageRow[]; selected: Set<unknown> }) {
        for (const item of data.currentPage) {
            if (!data.value) data.selected.delete(item.value)
            else if (!rowFails(item)) data.selected.add(item.value)
        }
        return data.selected
    }
} as unknown as 'page'

const { t } = useI18n()

const props = defineProps<{
    folders?: FolderItem[]
    modelValue?: string[]
    isScanning?: boolean
}>()

const emits = defineEmits<{
    'update:modelValue': [value: string[]]
    'open-folder-tree': [folderPath: string]
}>()

// Create unique items with IDs
const uniqueItems = computed(() => {
    const seen = new Map<string, FolderItem & { id: string }>();
    return (props.folders || []).map(folder => {
        const existingFolder = seen.get(folder.path);
        if (existingFolder) {
            return existingFolder;
        }
        const uniqueFolder = {
            ...folder,
            id: `${folder.path}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        seen.set(folder.path, uniqueFolder);
        return uniqueFolder;
    });
});

const pathQuery = ref<string | null>('')
const categoryFilter = ref<string | null>('')

// The table lists filtered rows only. v-model still holds every selected path, including hidden ones.
const filteredItems = computed(() => {
    const query = pathQuery.value ?? ''
    const category = categoryFilter.value ?? ''
    return uniqueItems.value.filter(item =>
        matchesPathQuery(item.path, query) && matchesCategory(item.keyword, category)
    )
})

const categoryOptions = computed(() => {
    const keywords = new Set<string>()
    for (const item of uniqueItems.value) {
        const keyword = item.keyword?.trim()
        if (keyword) keywords.add(keyword)
    }
    return [
        { title: t('common.all'), value: '' },
        ...[...keywords].sort((a, b) => a.localeCompare(b)).map(keyword => ({ title: keyword, value: keyword })),
    ]
})

const selected = computed({
    get: () => props.modelValue || [],
    set: (val: string[]) => emits('update:modelValue', val),
})

const translatedHeaders = computed(() => [
    { title: t('common.path'), key: 'path', sortable: true },
    { title: t('common.matched_keyword'), key: 'keyword', sortable: true },
    { title: t('common.size'), key: 'size', sortable: true, width: '150px' },
])

const totalSize = computed(() => uniqueItems.value.reduce((sum, f) => sum + f.size, 0))
const selectedSize = computed(() =>
    (selected.value || []).reduce((sum, path) => {
        const folder = uniqueItems.value.find((f) => f.path === path)
        return sum + (folder ? folder.size : 0)
    }, 0),
)

const openFolderTree = (folderPath: string): void => {
    emits('open-folder-tree', folderPath)
}

const copiedPath = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

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
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.filter-path {
    flex: 1 1 240px;
    min-width: 200px;
}

.filter-category {
    flex: 0 1 220px;
    min-width: 160px;
}
</style>