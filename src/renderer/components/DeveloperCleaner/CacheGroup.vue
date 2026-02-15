<template>
    <div class="text-caption">
        <div v-for="cacheGroup in cacheGroups" :key="cacheGroup.pattern" class="mb-2">
            <!-- Cache Group Header -->
            <div class="d-flex align-center pa-2 rounded" :class="headerBackgroundClass">
                <!-- Master checkbox for the group -->
                <v-checkbox :model-value="getCacheGroupCheckboxState(cacheGroup) ?? false"
                    :indeterminate="getCacheGroupCheckboxState(cacheGroup) === null" color="primary" hide-details
                    density="compact" class="mr-2"
                    @update:model-value="(value) => onCacheGroupCheckboxChange(cacheGroup, !!value)" />

                <!-- Expand/collapse button (only if multiple matches) -->
                <v-btn v-if="cacheGroup.matches.length > 1" icon variant="text" size="x-small"
                    @click="cacheGroup.expanded = !cacheGroup.expanded">
                    <v-icon size="small" :class="{ 'rotate-90': cacheGroup.expanded }">
                        mdi-chevron-right
                    </v-icon>
                </v-btn>

                <!-- Show folder button for single match on the same line -->
                <v-btn v-if="cacheGroup.matches.length === 1" icon variant="text" size="x-small"
                    @click="openFolderTree(cacheGroup.matches[0].path)" :disabled="isScanning || isDeleting"
                    class="mr-2">
                    <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                </v-btn>

                <div class="flex-grow-1" :class="cacheGroup.matches.length > 1 ? 'ml-2' : 'ml-0'">
                    <div class="font-weight-medium">
                        <!-- For single match, show actual path and size -->
                        <span v-if="cacheGroup.matches.length === 1">
                            {{ cacheGroup.matches[0].relativePath }} • {{
                                formatSize(cacheGroup.matches[0].size) }}
                        </span>
                        <!-- For multiple matches, show pattern -->
                        <span v-else>{{ cacheGroup.pattern }}</span>
                    </div>
                    <div :class="secondaryTextClass">
                        {{ cacheGroup.matches.length }}
                        {{ cacheGroup.matches.length === 1 ? t('common.match') : t('common.matches') }} •
                        {{ formatSize(cacheGroup.selectedSize) }} {{ t('common.of') }} {{
                            formatSize(cacheGroup.totalSize) }} {{ t('common.selected') }}
                    </div>
                </div>

                <v-chip size="x-small"
                    :color="cacheGroup.category === 'Unity' ? 'purple' : getTypeColor(cacheGroup.category)">
                    {{ cacheGroup.category }}
                </v-chip>
            </div>

            <!-- Multiple Matches (expandable) -->
            <v-expand-transition v-if="cacheGroup.matches.length > 1">
                <div v-show="cacheGroup.expanded" class="ml-4 mt-2">
                    <!-- Group Selection Controls -->
                    <div class="d-flex justify-space-between align-center mb-2">
                        <v-btn size="x-small" variant="text" @click="selectAllCachesInGroup(cacheGroup)"
                            :disabled="allGroupCachesSelected(cacheGroup)">
                            {{ t('common.select_all') }}
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="deselectAllCachesInGroup(cacheGroup)"
                            :disabled="noGroupCachesSelected(cacheGroup)">
                            {{ t('common.deselect_all') }}
                        </v-btn>
                        <v-chip size="x-small" color="primary">
                            {{cacheGroup.matches.filter(m => m.selected).length}}/{{
                                cacheGroup.matches.length }}
                            {{ t('common.selected') }}
                        </v-chip>
                    </div>

                    <!-- Individual Matches -->
                    <div v-for="match in cacheGroup.matches" :key="match.path" class="mb-1 d-flex align-center">
                        <v-checkbox v-model="match.selected" color="primary" hide-details density="compact" class="mr-2"
                            @change="updateCacheGroupSelection(cacheGroup)" />
                        <v-btn icon variant="text" size="x-small" @click="openFolderTree(match.path)"
                            :disabled="isScanning || isDeleting">
                            <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                        </v-btn>
                        <div class="flex-grow-1">
                            <div class="font-weight-medium">{{ match.relativePath }}</div>
                            <div :class="secondaryTextClass">{{ formatSize(match.size) }}</div>
                        </div>
                    </div>
                </div>
            </v-expand-transition>
        </div>

        <!-- Project-level controls -->
        <v-divider v-if="cacheGroups.length > 1" class="mt-2 mb-1" />
        <div class="d-flex justify-space-between align-center mt-1">
            <v-btn size="x-small" variant="text" @click="selectAllCaches" :disabled="allCachesSelected">
                {{ t('common.select_all') }}
            </v-btn>
            <v-btn size="x-small" variant="text" @click="deselectAllCaches" :disabled="noCachesSelected">
                {{ t('common.deselect_all') }}
            </v-btn>
            <v-chip size="x-small" color="primary">
                {{ selectedCacheCount }} {{ t('common.of') }} {{ totalCacheCount }}
                {{ t('common.selected') }}
            </v-chip>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'
import type { CacheGroup } from '@/types'
import { getTypeColor } from '@/utils/categoryColors'
import { formatSize } from '@/utils/formatters'

// i18n
const { t } = useI18n()

// Theme
const theme = useTheme()

// Props
const props = defineProps<{
    cacheGroups: CacheGroup[]
    isScanning?: boolean
    isDeleting?: boolean
}>()

// Emits
const emit = defineEmits<{
    'cache-selection-changed': []
    'open-folder-tree': [folderPath: string]
}>()

// Theme-aware computed properties
const headerBackgroundClass = computed(() => {
    return theme.global.name.value === 'dark' ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'
})

const secondaryTextClass = computed(() => {
    return theme.global.name.value === 'dark' ? 'text-grey-lighten-1' : 'text-grey'
})

// Computed properties
const allCachesSelected = computed(() => {
    return props.cacheGroups.length > 0 && props.cacheGroups.every(group =>
        group.matches.length > 0 && group.matches.every(match => match.selected)
    )
})

const noCachesSelected = computed(() => {
    return !props.cacheGroups.some(group => group.matches.some(match => match.selected))
})

const selectedCacheCount = computed(() => {
    return props.cacheGroups.reduce((total, group) =>
        total + group.matches.filter(match => match.selected).length, 0
    )
})

const totalCacheCount = computed(() => {
    return props.cacheGroups.reduce((total, group) => total + group.matches.length, 0)
})

// Methods
const openFolderTree = (folderPath: string): void => {
    emit('open-folder-tree', folderPath)
}

const selectAllCaches = (): void => {
    props.cacheGroups.forEach(group => {
        group.matches.forEach(match => match.selected = true)
        updateCacheGroupSelection(group)
    })
    emit('cache-selection-changed')
}

const deselectAllCaches = (): void => {
    props.cacheGroups.forEach(group => {
        group.matches.forEach(match => match.selected = false)
        updateCacheGroupSelection(group)
    })
    emit('cache-selection-changed')
}

const selectAllCachesInGroup = (cacheGroup: CacheGroup): void => {
    cacheGroup.matches.forEach(match => match.selected = true)
    updateCacheGroupSelection(cacheGroup)
    emit('cache-selection-changed')
}

const deselectAllCachesInGroup = (cacheGroup: CacheGroup): void => {
    cacheGroup.matches.forEach(match => match.selected = false)
    updateCacheGroupSelection(cacheGroup)
    emit('cache-selection-changed')
}

const allGroupCachesSelected = (cacheGroup: CacheGroup): boolean => {
    return cacheGroup.matches.length > 0 && cacheGroup.matches.every(match => match.selected)
}

const noGroupCachesSelected = (cacheGroup: CacheGroup): boolean => {
    return !cacheGroup.matches.some(match => match.selected)
}

const updateCacheGroupSelection = (cacheGroup: CacheGroup): void => {
    // Recalculate selected cache size for the group
    cacheGroup.selectedSize = cacheGroup.matches
        .filter(match => match.selected)
        .reduce((sum, match) => sum + match.size, 0)
}

// Get checkbox state for a cache group
const getCacheGroupCheckboxState = (cacheGroup: CacheGroup): boolean | null => {
    const selectedCount = cacheGroup.matches.filter(match => match.selected).length
    const totalCount = cacheGroup.matches.length

    if (selectedCount === 0) return false
    if (selectedCount === totalCount) return true
    return null // indeterminate state
}

// Handle cache group checkbox click
const onCacheGroupCheckboxChange = (cacheGroup: CacheGroup, newValue: boolean): void => {
    if (newValue) {
        selectAllCachesInGroup(cacheGroup)
    } else {
        deselectAllCachesInGroup(cacheGroup)
    }
}
</script>

<style scoped>
.rotate-90 {
    transform: rotate(90deg);
}
</style>