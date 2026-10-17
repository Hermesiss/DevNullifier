<template>
    <v-row>
        <v-col cols="12">
            <v-card>
                <v-card-title>
                    <div class="d-flex ga-2">
                        <v-icon left>mdi-folder-multiple</v-icon>
                        {{ t('common.dev_projects') }} ({{ projects.length }})
                        <v-spacer />
                        <!-- Select / deselect caches -->
                        <v-chip v-if="totalSelectedCacheSize > 0" color="success" size="small">
                            {{ formatSize(totalSelectedCacheSize) }} {{ t('common.cache_selected') }}
                        </v-chip>
                        <v-btn variant="outlined" color="primary" size="small"
                            :disabled="projects.length === 0 || isScanning || isDeleting" @click="selectAllCaches">
                            <v-icon left size="small">mdi-folder-check</v-icon>
                            {{ t('common.select_all_caches') }}
                        </v-btn>

                        <v-btn variant="outlined" color="warning" size="small"
                            :disabled="projects.length === 0 || isScanning || isDeleting" @click="deselectAllCaches">
                            <v-icon left size="small">mdi-folder-remove</v-icon>
                            {{ t('common.deselect_all_caches') }}
                        </v-btn>

                    </div>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-3 mb-4">
                        <v-text-field v-model="pathQuery" class="filter-path" :label="t('common.search_path')"
                            prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" hide-details
                            clearable autocomplete="off" />
                        <v-select v-model="categoryFilter" class="filter-category" :items="typeOptions"
                            :label="t('common.filter_category')" density="compact" variant="outlined" hide-details />
                    </div>
                    <v-data-table :headers="translatedHeaders" :items="filteredProjects" :items-per-page="50"
                        :loading="isScanning" item-value="path" class="elevation-1">
                        <template v-slot:item.path="{ item }">
                            <div class="d-flex align-center">
                                <v-btn icon variant="text" size="small" @click="openFolderTree(item.path)"
                                    :disabled="isScanning || isDeleting" class="ml-2">
                                    <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                                </v-btn>
                                <v-btn icon variant="text" size="small" :disabled="isScanning || isDeleting"
                                    :aria-label="t('common.open_folder')" @click="openInFileManager(item.path)">
                                    <v-icon size="small">mdi-open-in-new</v-icon>
                                    <v-tooltip activator="parent" location="bottom">{{ t('common.open_folder') }}</v-tooltip>
                                </v-btn>
                                <v-btn icon variant="text" size="small" :disabled="isScanning || isDeleting"
                                    :aria-label="copiedPath === item.path ? t('common.copied') : t('common.copy_path')"
                                    @click="copyPath(item.path)">
                                    <v-icon size="small">mdi-content-copy</v-icon>
                                    <v-tooltip activator="parent" location="bottom">
                                        {{ copiedPath === item.path ? t('common.copied') : t('common.copy_path') }}
                                    </v-tooltip>
                                </v-btn>
                                <div class="flex-grow-1 text-truncate mr-2">
                                    {{ item.path }}
                                </div>
                            </div>
                        </template>
                        <template v-slot:item.type="{ item }">
                            <div class="d-flex flex-wrap ga-1">
                                <v-chip v-for="type in item.type.split(', ')" :key="type" size="small"
                                    :color="getTypeColor(type.trim() as CacheCategory)">
                                    {{ type.trim() }}
                                </v-chip>
                            </div>
                        </template>
                        <template v-slot:item.lastModified="{ item }">
                            <div class="text-caption">
                                <div>{{ formatDate(item.lastModified) }}</div>
                                <div class="text-grey">{{ getRelativeTime(item.lastModified) }}</div>
                            </div>
                        </template>
                        <template v-slot:item.totalCacheSize="{ item }">
                            <div>
                                <div class="font-weight-medium">{{ formatSize(item.selectedCacheSize || 0) }}</div>
                                <div class="text-caption text-grey"
                                    v-if="item.selectedCacheSize !== item.totalCacheSize">
                                    {{ t('common.of') }} {{ formatSize(item.totalCacheSize) }} {{ t('common.total') }}
                                </div>
                            </div>
                        </template>
                        <template v-slot:item.cacheInfo="{ item }">
                            <CacheGroup :cache-groups="item.caches" :is-scanning="isScanning" :is-deleting="isDeleting"
                                @cache-selection-changed="updateCacheSelection(item)"
                                @open-folder-tree="openFolderTree" />
                        </template>
                    </v-data-table>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { failsThreshold } from '../../../main/thresholds'
import { minAgeDays, minSizeMb } from '../../composables/useCleanerRules'
import CacheGroup from './CacheGroup.vue'
import type { ProjectInfo, CacheGroup as CacheGroupType, CacheCategory, CacheMatch } from '@/types'
import { getTypeColor } from '@/utils/categoryColors'
import { formatSize, formatDate } from '@/utils/formatters'
import { matchesCategory, matchesPathQuery } from '@/utils/tableFilter'

const { t } = useI18n()

// Props
const props = defineProps<{
    projects: ProjectInfo[]
    isScanning?: boolean
    isDeleting?: boolean
}>()

// Emits
const emit = defineEmits<{
    'open-folder-tree': [folderPath: string]
    'cache-selection-changed': []
}>()

// Computed properties
const totalSelectedCacheSize = computed(() => {
    return props.projects.reduce((total, project) => {
        return total + (project.selectedCacheSize || 0)
    }, 0)
})

const pathQuery = ref<string | null>('')
const categoryFilter = ref<string | null>('')

const filteredProjects = computed(() => {
    const query = pathQuery.value ?? ''
    const category = categoryFilter.value ?? ''
    return props.projects.filter(project =>
        matchesPathQuery(project.path, query) && matchesCategory(project.type, category)
    )
})

const typeOptions = computed(() => {
    const types = new Set<string>()
    for (const project of props.projects) {
        for (const part of project.type.split(',')) {
            const type = part.trim()
            if (type) types.add(type)
        }
    }
    return [
        { title: t('common.all'), value: '' },
        ...[...types].sort((a, b) => a.localeCompare(b)).map(type => ({ title: type, value: type })),
    ]
})

const translatedHeaders = computed(() => [
    { title: t('common.project_path'), key: 'path', sortable: true },
    { title: t('common.project_type'), key: 'type', sortable: true },
    { title: t('common.last_updated'), key: 'lastModified', sortable: true },
    { title: t('common.selected_size'), key: 'totalCacheSize', sortable: true },
    { title: t('common.cache_details'), key: 'cacheInfo', sortable: false },
])

const getRelativeTime = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return t('common.today')
    return `${diffDays} ${t('common.days_ago')}`
}

const openFolderTree = (folderPath: string): void => {
    emit('open-folder-tree', folderPath)
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

const thresholdRules = () => ({
    minAgeDays: minAgeDays.value,
    minSizeMb: minSizeMb.value
})

const canAutoSelect = (match: Pick<CacheMatch, 'size' | 'modifiedAt'>): boolean => {
    return !failsThreshold(match.size, match.modifiedAt, thresholdRules())
}

const selectAllCaches = (): void => {
    props.projects.forEach(project => {
        project.caches.forEach(group => {
            group.matches.forEach(match => {
                if (canAutoSelect(match)) match.selected = true
            })
            updateCacheGroupSelection(group)
        })
        updateCacheSelection(project)
    })
    emit('cache-selection-changed')
}

const deselectAllCaches = (): void => {
    props.projects.forEach(project => {
        project.caches.forEach(group => {
            group.matches.forEach(match => match.selected = false)
            updateCacheGroupSelection(group)
        })
        updateCacheSelection(project)
    })
    emit('cache-selection-changed')
}

const updateCacheGroupSelection = (cacheGroup: CacheGroupType): void => {
    // Recalculate selected cache size for the group
    cacheGroup.selectedSize = cacheGroup.matches
        .filter(match => match.selected)
        .reduce((sum, match) => sum + match.size, 0)
}

const updateCacheSelection = (project: ProjectInfo): void => {
    // Recalculate selected cache size for the entire project
    project.selectedCacheSize = project.caches
        .reduce((sum, group) => sum + group.selectedSize, 0)
}
</script>

<style scoped>
.filter-path {
    flex: 1 1 240px;
    min-width: 200px;
}

.filter-category {
    flex: 0 1 220px;
    min-width: 160px;
}
</style>