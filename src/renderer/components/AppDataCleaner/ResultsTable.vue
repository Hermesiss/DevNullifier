<template>
    <v-card>
        <v-card-title>
            <span>{{ t('common.found_folders') }}</span>
            <v-spacer />
            <v-chip v-if="totalSize > 0" color="info" variant="outlined">
                {{ formatSize(selectedSize) }} / {{ formatSize(totalSize) }}
            </v-chip>
        </v-card-title>

        <div v-if="compareText" class="px-4 pb-2 text-body-2 text-medium-emphasis">{{ compareText }}</div>

        <div class="d-flex flex-wrap ga-3 px-4 pb-2">
            <v-text-field v-model="pathQuery" class="filter-path" :label="t('common.search_path')"
                prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" hide-details clearable
                autocomplete="off" />
            <v-select v-model="categoryFilter" class="filter-category" :items="categoryOptions"
                :label="t('common.filter_category')" density="compact" variant="outlined" hide-details />
        </div>

        <v-data-table v-model="selected" v-model:expanded="expanded" :headers="translatedHeaders"
            :items="filteredItems" :items-per-page="50" :item-value="rowItemValue" show-select
            :select-strategy="tableSelectStrategy" :loading="isScanning" :loading-text="t('common.loading')"
            :sort-by="[{ key: 'size', order: 'desc' }]" class="elevation-1">
            <template #item.data-table-select="{ item, internalItem, isSelected, toggleSelect, index }">
                <v-checkbox-btn v-if="item.kind === 'group'" :model-value="groupCheckState(item.group) === true"
                    :indeterminate="groupCheckState(item.group) === null" :aria-label="t('common.app_group')"
                    @click.stop.prevent="toggleGroup(item.group)" />
                <v-checkbox-btn v-else :model-value="isSelected([internalItem])" :disabled="!internalItem.selectable"
                    @click.stop="toggleSelect(internalItem, index, $event)" />
            </template>

            <template #item.keyword="{ item }">
                {{ item.keyword }}
            </template>

            <template #item.size="{ item }">
                {{ formatSize(item.size) }}
            </template>

            <template #item.path="{ item, internalItem, isExpanded, toggleExpand }">
                <div class="d-flex align-center">
                    <v-btn v-if="item.kind === 'group'" icon variant="text" size="small" class="ml-2"
                        :disabled="isScanning" :aria-label="t('common.app_group')"
                        :aria-expanded="isExpanded(internalItem)" @click.stop="toggleExpand(internalItem)">
                        <v-icon size="small" :class="{ 'rotate-90': isExpanded(internalItem) }">mdi-chevron-right</v-icon>
                    </v-btn>
                    <v-btn v-else icon variant="text" size="small" class="ml-2" :disabled="isScanning"
                        @click="openFolderTree(item.path)">
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
                    <span class="flex-grow-1">{{ item.path }}</span>
                    <v-chip v-if="item.kind === 'group'" size="x-small" variant="tonal" class="ml-2">
                        {{ t('common.app_group') }}
                    </v-chip>
                </div>
            </template>

            <template #expanded-row="{ columns, item }">
                <tr v-for="child in groupChildren(item)" :key="child.path" class="appdata-child-row">
                    <td v-for="(column, columnIndex) in columns" :key="`${child.path}:${column.key ?? columnIndex}`"
                        :class="childCellClass(column.key)">
                        <v-checkbox-btn v-if="column.key === 'data-table-select'" :model-value="isPathSelected(child.path)"
                            @click.stop.prevent="setFolderSelected(child.path, !isPathSelected(child.path))" />
                        <div v-else-if="column.key === 'path'" class="d-flex align-center appdata-child-path">
                            <v-btn icon variant="text" size="small" class="ml-2" :disabled="isScanning"
                                @click="openFolderTree(child.path)">
                                <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                            </v-btn>
                            <v-btn icon variant="text" size="small" :disabled="isScanning"
                                :aria-label="t('common.open_folder')" @click="openInFileManager(child.path)">
                                <v-icon size="small">mdi-open-in-new</v-icon>
                                <v-tooltip activator="parent" location="bottom">{{ t('common.open_folder') }}</v-tooltip>
                            </v-btn>
                            <v-btn icon variant="text" size="small" :disabled="isScanning"
                                :aria-label="copiedPath === child.path ? t('common.copied') : t('common.copy_path')"
                                @click="copyPath(child.path)">
                                <v-icon size="small">mdi-content-copy</v-icon>
                                <v-tooltip activator="parent" location="bottom">
                                    {{ copiedPath === child.path ? t('common.copied') : t('common.copy_path') }}
                                </v-tooltip>
                            </v-btn>
                            <span class="flex-grow-1">{{ child.path }}</span>
                        </div>
                        <template v-else-if="column.key === 'keyword'">{{ child.keyword }}</template>
                        <template v-else-if="column.key === 'size'">{{ formatSize(child.size) }}</template>
                    </td>
                </tr>
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
import { groupAppDataFolders, type AppDataGroup } from '@/utils/appDataGroups'
import { FolderItem } from '@/types/common'

const GROUP_ROW_PREFIX = '\u0000'

type FolderRow = FolderItem & { kind: 'folder' }
type GroupRow = {
    kind: 'group'
    path: string
    size: number
    keyword: string
    group: AppDataGroup
}
type ResultRow = FolderRow | GroupRow
type PageRow = { value: unknown; raw?: ResultRow }

function rowItemValue(item: ResultRow): string {
    if (item.kind === 'group') return GROUP_ROW_PREFIX + item.group.key
    return item.path
}

function thresholdRules() {
    return {
        minAgeDays: minAgeDays.value,
        minSizeMb: minSizeMb.value
    }
}

function folderFails(folder: { size: number; modifiedAt?: string | null }): boolean {
    return failsThreshold(folder.size, folder.modifiedAt, thresholdRules())
}

function concretePaths(raw: ResultRow, onlyPassing: boolean): string[] {
    if (raw.kind === 'group') {
        return raw.group.children
            .filter(child => !onlyPassing || !folderFails(child))
            .map(child => child.path)
    }
    if (onlyPassing && folderFails(raw)) return []
    return [raw.path]
}

function applyPaths(selectedPaths: Set<unknown>, paths: string[], on: boolean): void {
    for (const path of paths) {
        if (on) selectedPaths.add(path)
        else selectedPaths.delete(path)
    }
}

// Header select-all is the current page. Skip folders that fail the threshold; row clicks still select them.
// Group rows contribute their child folder paths. The group key is not a delete path.
const tableSelectStrategy = {
    showSelectAll: true,
    allSelected(data: { currentPage: PageRow[] }) {
        const targets: PageRow[] = []
        for (const item of data.currentPage) {
            if (!item.raw) continue
            for (const path of concretePaths(item.raw, true)) targets.push({ value: path })
        }
        return targets
    },
    select(data: { items: PageRow[]; value: boolean; selected: Set<unknown> }) {
        for (const item of data.items) {
            if (!item.raw) continue
            applyPaths(data.selected, concretePaths(item.raw, false), data.value)
        }
        return data.selected
    },
    selectAll(data: { value: boolean; currentPage: PageRow[]; selected: Set<unknown> }) {
        for (const item of data.currentPage) {
            if (!item.raw) continue
            const paths = concretePaths(item.raw, data.value)
            applyPaths(data.selected, paths, data.value)
        }
        return data.selected
    }
} as unknown as 'page'

const { t } = useI18n()

const props = defineProps<{
    folders?: FolderItem[]
    modelValue?: string[]
    isScanning?: boolean
    compareText?: string
}>()

const emits = defineEmits<{
    'update:modelValue': [value: string[]]
    'open-folder-tree': [folderPath: string]
}>()

const expanded = ref<string[]>([])

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

// Filter folders first, then group. v-model still holds selected folder paths, including hidden ones.
const filteredItems = computed((): ResultRow[] => {
    const query = pathQuery.value ?? ''
    const category = categoryFilter.value ?? ''
    const folders = uniqueItems.value.filter(item =>
        matchesPathQuery(item.path, query) && matchesCategory(item.keyword, category)
    )
    return groupAppDataFolders(folders).map(row => {
        if (row.kind === 'folder') return { ...row.folder, kind: 'folder' as const }
        return {
            kind: 'group' as const,
            path: row.group.key,
            size: row.group.size,
            keyword: t('common.grouped_folders', { count: row.group.children.length }),
            group: row.group,
        }
    })
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

function groupChildren(item: ResultRow): FolderItem[] {
    return item.kind === 'group' ? item.group.children : []
}

function childCellClass(key: string | null): string {
    const classes = ['v-data-table__td', 'v-data-table-column--align-start']
    if (key === 'data-table-select') {
        classes.push('v-data-table__td--select-row', 'v-data-table-column--no-padding')
    }
    return classes.join(' ')
}

function isPathSelected(path: string): boolean {
    return selected.value.includes(path)
}

function groupCheckState(group: AppDataGroup): true | false | null {
    let count = 0
    const chosen = new Set(selected.value)
    for (const child of group.children) {
        if (chosen.has(child.path)) count += 1
    }
    if (count === 0) return false
    if (count === group.children.length) return true
    return null
}

function setGroupSelected(group: AppDataGroup, on: boolean): void {
    const childPaths = group.children.map(child => child.path)
    const childSet = new Set(childPaths)
    if (on) {
        const next = [...selected.value]
        const have = new Set(next)
        for (const path of childPaths) {
            if (!have.has(path)) next.push(path)
        }
        selected.value = next
        return
    }
    selected.value = selected.value.filter(path => !childSet.has(path))
}

function toggleGroup(group: AppDataGroup): void {
    setGroupSelected(group, groupCheckState(group) !== true)
}

function setFolderSelected(path: string, on: boolean): void {
    if (on) {
        if (selected.value.includes(path)) return
        selected.value = [...selected.value, path]
        return
    }
    selected.value = selected.value.filter(item => item !== path)
}

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

.appdata-child-row {
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.appdata-child-path {
    padding-left: 28px;
}

.rotate-90 {
    transform: rotate(90deg);
}
</style>
