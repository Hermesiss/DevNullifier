<template>
    <div>
        <ControlPanel :is-scanning="isScanning" :is-deleting="isDeleting" :items-length="items.length"
            :scan-progress="scanProgress" @scan="startScan" @select-all="selectAll" @deselect-all="deselectAll"
            @show-info="showInfo = true" />

        <ResultsTable v-model="selectedPaths" :items="items" :is-scanning="isScanning" :is-deleting="isDeleting"
            @open-folder-tree="openFolderTree" />

        <DeleteFailureList :failures="failedDeletes" :disabled="isDeleting" @retry="retryFailed" />

        <DeleteDialog v-model="showDeleteDialog" :selected-count="selectedPaths.length" :selected-size="selectedSize"
            :permanent="permanentDelete" @confirm="deleteSelected" />

        <FolderTreeViewer v-model="showFolderTree" :folder-path="selectedFolderPath" />
        <ToolCachesInfoDialog v-model="showInfo" />

        <v-footer app class="pa-0">
            <ActionsBar :status-text="statusText" :disk-status="diskStatus" :delete-progress="0"
                :scan-progress="isScanning ? scanProgress : null" :selected-count="selectedPaths.length"
                :is-scanning="isScanning" :is-deleting="isDeleting" @delete="confirmDelete" />
        </v-footer>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { failsThreshold } from '../../main/thresholds'
import { applyRetryResult, summarizeDeleteResults, unsuccessfulDeletes } from '../utils/deleteResults'
import { useCleanerRules } from '../composables/useCleanerRules'
import { useDiskStatus } from '../composables/useDiskStatus'
import { useElevationPrompt } from '../composables/useElevationPrompt'
import type { DeleteResult, ToolCacheItem } from '@/types'
import ControlPanel from './ToolCachesCleaner/ControlPanel.vue'
import ResultsTable from './ToolCachesCleaner/ResultsTable.vue'
import ToolCachesInfoDialog from './ToolCachesCleaner/ToolCachesInfoDialog.vue'
import DeleteDialog from './DeleteDialog.vue'
import DeleteFailureList from './DeleteFailureList.vue'
import FolderTreeViewer from './FolderTreeViewer.vue'
import ActionsBar from './ActionsBar.vue'

const { t, locale } = useI18n()
const { permanentDelete, minAgeDays, minSizeMb, whenRulesSaved } = useCleanerRules()
useElevationPrompt()

const emit = defineEmits<{
    showNotification: [text: string, color?: string]
}>()

const items = ref<ToolCacheItem[]>([])
const selectedPaths = ref<string[]>([])
const isScanning = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const showFolderTree = ref(false)
const showInfo = ref(false)
const selectedFolderPath = ref('')
const statusText = ref(t('common.ready'))
const failedDeletes = ref<DeleteResult[]>([])
const deletionSizes = new Map<string, number>()
const scanRoot = ref<string | null>(null)
const scanProgress = ref(0)
const acceptScanEvents = ref(false)

const selectedSize = computed(() =>
    items.value
        .filter(item => selectedPaths.value.includes(item.path))
        .reduce((sum, item) => sum + item.size, 0)
)

const foundSize = computed(() => items.value.reduce((sum, item) => sum + item.size, 0))

const { diskStatus } = useDiskStatus(scanRoot, selectedSize, foundSize)

const thresholdRules = () => ({
    minAgeDays: minAgeDays.value,
    minSizeMb: minSizeMb.value
})

const showNotification = (message: string, type = 'info'): void => {
    emit('showNotification', message, type)
}

const openFolderTree = (folderPath: string): void => {
    selectedFolderPath.value = folderPath
    showFolderTree.value = true
}

const selectAll = (): void => {
    const rules = thresholdRules()
    const selected = new Set(selectedPaths.value)
    for (const item of items.value) {
        if (!failsThreshold(item.size, null, rules)) selected.add(item.path)
    }
    selectedPaths.value = items.value.map(item => item.path).filter(path => selected.has(path))
}

const deselectAll = (): void => {
    selectedPaths.value = []
}

const insertFoundItem = (item: ToolCacheItem): void => {
    if (items.value.some(existing => existing.path === item.path)) return
    const next = [...items.value, item]
    next.sort((a, b) => b.size - a.size)
    items.value = next
}

const clearScanListeners = (): void => {
    window.electronAPI.removeAllListeners?.('tool-cache-scan-progress')
    window.electronAPI.removeAllListeners?.('tool-cache-found')
}

const setupScanListeners = (): void => {
    clearScanListeners()
    window.electronAPI.onToolCacheScanProgress?.(progress => {
        if (!acceptScanEvents.value) return
        const total = Math.max(progress.total, 1)
        scanProgress.value = (progress.checked / total) * 100
        if (progress.path) {
            statusText.value = t('common.tool_cache_scan_progress', {
                checked: progress.checked,
                total: progress.total,
                path: progress.path
            })
        }
    })
    window.electronAPI.onToolCacheFound?.(item => {
        if (!acceptScanEvents.value) return
        insertFoundItem(item)
    })
}

const startScan = async (): Promise<void> => {
    if (!window.electronAPI.scanGlobalCaches) {
        showNotification(t('common.error'), 'error')
        return
    }

    isScanning.value = true
    acceptScanEvents.value = true
    scanProgress.value = 0
    statusText.value = t('common.loading')
    selectedPaths.value = []
    items.value = []
    setupScanListeners()

    try {
        const lang = locale.value?.toString().startsWith('ru') ? 'ru' : 'en'
        const found = await window.electronAPI.scanGlobalCaches(lang)
        // Reconcile with final list in case an event was missed.
        items.value = [...found].sort((a, b) => b.size - a.size)
        scanProgress.value = 100
        statusText.value = t('common.found_tool_caches_count', { count: items.value.length })
        if (items.value.length === 0) {
            showNotification(t('common.no_tool_caches'), 'info')
        } else {
            showNotification(t('common.found_tool_caches_count', { count: items.value.length }), 'success')
        }
    } catch (error) {
        console.error('Tool cache scan error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error')}: ${errorMessage}`, 'error')
        statusText.value = t('common.ready')
    } finally {
        acceptScanEvents.value = false
        isScanning.value = false
        clearScanListeners()
    }
}

const confirmDelete = (): void => {
    if (selectedPaths.value.length === 0) {
        showNotification(t('common.no_caches_selected_delete'), 'warning')
        return
    }
    showDeleteDialog.value = true
}

const recordDeletionLog = async (
    results: Array<{ path: string; success: boolean | 'partial' }>,
    sizes: Map<string, number>
): Promise<void> => {
    if (results.length === 0) return
    try {
        await window.electronAPI.appendDeletionLog(results.map(result => {
            const raw = sizes.get(result.path)
            return {
                path: result.path,
                size: typeof raw === 'number' && Number.isFinite(raw) ? raw : 0,
                status: result.success === true
                    ? 'success' as const
                    : result.success === 'partial'
                        ? 'partial' as const
                        : 'error' as const
            }
        }))
    } catch (error) {
        console.error('Failed to append deletion log:', error)
    }
}

const deleteSelected = async (): Promise<void> => {
    showDeleteDialog.value = false
    if (selectedPaths.value.length === 0) return

    isDeleting.value = true
    statusText.value = t('common.deleting_cache_folders', { count: selectedPaths.value.length })
    try {
        await whenRulesSaved()
        deletionSizes.clear()
        for (const item of items.value) deletionSizes.set(item.path, item.size)

        const paths = [...selectedPaths.value]
        const results = await window.electronAPI.deleteFolders(paths)
        await recordDeletionLog(results, deletionSizes)
        failedDeletes.value = unsuccessfulDeletes(results)
        const { successCount, partialCount, failCount } = summarizeDeleteResults(results)

        const parts: string[] = []
        if (successCount > 0) parts.push(`${successCount} ${t('common.deleted')}`)
        if (partialCount > 0) parts.push(`${partialCount} ${t('common.partial')}`)
        if (failCount > 0) parts.push(`${failCount} ${t('common.failed')}`)

        const fullyDeleted = failCount === 0 && partialCount === 0
        showNotification(
            fullyDeleted
                ? t('common.success_deleted_cache', { count: successCount })
                : parts.join(', '),
            fullyDeleted ? 'success' : 'warning'
        )
        statusText.value = `${t('common.deletion_complete')}: ${parts.join(', ')}`

        const deletedPaths = new Set(
            results.filter(result => result.success === true).map(result => result.path)
        )
        items.value = items.value.filter(item => !deletedPaths.has(item.path))
        selectedPaths.value = selectedPaths.value.filter(path => !deletedPaths.has(path))
    } catch (error) {
        console.error('Delete error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_deletion')}: ${errorMessage}`, 'error')
        statusText.value = t('common.deletion_failed')
    } finally {
        isDeleting.value = false
    }
}

const retryFailed = async (path: string): Promise<void> => {
    if (isDeleting.value) return
    isDeleting.value = true
    statusText.value = t('common.deleting_cache_folders', { count: 1 })
    try {
        await whenRulesSaved()
        const results = await window.electronAPI.deleteFolders([path])
        await recordDeletionLog(results, deletionSizes)
        failedDeletes.value = applyRetryResult(failedDeletes.value, path, results)
        const { successCount, partialCount, failCount } = summarizeDeleteResults(results)
        const parts: string[] = []
        if (successCount > 0) parts.push(`${successCount} ${t('common.deleted')}`)
        if (partialCount > 0) parts.push(`${partialCount} ${t('common.partial')}`)
        if (failCount > 0) parts.push(`${failCount} ${t('common.failed')}`)
        const fullyDeleted = failCount === 0 && partialCount === 0
        showNotification(
            fullyDeleted
                ? t('common.success_deleted_cache', { count: successCount })
                : parts.join(', '),
            fullyDeleted ? 'success' : 'warning'
        )
        statusText.value = `${t('common.deletion_complete')}: ${parts.join(', ')}`
        if (results.some(result => result.path === path && result.success === true)) {
            items.value = items.value.filter(item => item.path !== path)
            selectedPaths.value = selectedPaths.value.filter(item => item !== path)
        }
    } catch (error) {
        console.error('Delete error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        showNotification(`${t('common.error_deletion')}: ${errorMessage}`, 'error')
        statusText.value = t('common.deletion_failed')
    } finally {
        isDeleting.value = false
    }
}

onMounted(async () => {
    try {
        scanRoot.value = await window.electronAPI.getUserHome()
    } catch (error) {
        console.error('Failed to read home directory:', error)
    }
})

onUnmounted(() => {
    acceptScanEvents.value = false
    clearScanListeners()
})
</script>
