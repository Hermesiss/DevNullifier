<template>
    <v-row>
        <v-col cols="12">
            <v-card>
                <v-card-title>
                    <div class="d-flex ga-2">
                        <v-icon left>mdi-folder-multiple</v-icon>
                        Development Projects ({{ projects.length }})
                        <v-spacer />
                        <!-- Select / deselect caches -->
                        <v-chip v-if="totalSelectedCacheSize > 0" color="success" size="small">
                            {{ formatSize(totalSelectedCacheSize) }} cache selected
                        </v-chip>
                        <v-btn variant="outlined" color="primary" size="small"
                            :disabled="projects.length === 0 || isScanning || isDeleting" @click="selectAllCaches">
                            <v-icon left size="small">mdi-folder-check</v-icon>
                            Select All Caches
                        </v-btn>

                        <v-btn variant="outlined" color="warning" size="small"
                            :disabled="projects.length === 0 || isScanning || isDeleting" @click="deselectAllCaches">
                            <v-icon left size="small">mdi-folder-remove</v-icon>
                            Deselect All Caches
                        </v-btn>

                    </div>
                </v-card-title>
                <v-card-text>
                    <v-data-table :headers="headers" :items="projects" :items-per-page="50" :loading="isScanning"
                        item-value="path" class="elevation-1">
                        <template v-slot:item.path="{ item }">
                            <div class="d-flex align-center">
                                <v-btn icon variant="text" size="small" @click="openFolderTree(item.path)"
                                    :disabled="isScanning || isDeleting" class="ml-2">
                                    <v-icon size="small" color="primary">mdi-folder-open</v-icon>
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
                                    of {{ formatSize(item.totalCacheSize) }} total
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
import { computed } from 'vue'
import CacheGroup from './CacheGroup.vue'
import type { ProjectInfo, CacheGroup as CacheGroupType, CacheCategory } from '@/types'
import { getTypeColor } from '@/utils/categoryColors'
import { formatSize, formatDate } from '@/utils/formatters'

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

const headers = [
    { title: 'Project Path', key: 'path', sortable: true },
    { title: 'Last Updated', key: 'lastModified', sortable: true },
    { title: 'Selected Size', key: 'totalCacheSize', sortable: true },
    { title: 'Cache Details', key: 'cacheInfo', sortable: false },
]

const getRelativeTime = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
}

const openFolderTree = (folderPath: string): void => {
    emit('open-folder-tree', folderPath)
}

const selectAllCaches = (): void => {
    props.projects.forEach(project => {
        project.caches.forEach(group => {
            group.matches.forEach(match => match.selected = true)
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
/* Add any specific styles for the results table here */
</style>