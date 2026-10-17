<template>
    <div>
        <ControlPanel
            :is-scanning="isScanning"
            :is-uninstalling="isUninstalling"
            :last-played-filter="lastPlayedFilter"
            @scan="startScan"
            @show-info="showInfo = true"
            @update:last-played-filter="lastPlayedFilter = $event"
        />

        <ResultsTable
            :items="filteredItems"
            :is-scanning="isScanning"
            :is-uninstalling="isUninstalling"
            :uninstalling-id="uninstallingId"
            @uninstall="uninstallItem"
        />

        <GamesInfoDialog v-model="showInfo" />

        <v-footer app class="pa-0">
            <div class="dn-games-status px-4 py-2 text-body-2">
                {{ statusText }}
            </div>
        </v-footer>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GameApp } from '@/types'
import {
    matchesLastPlayedFilter,
    type LastPlayedFilter
} from '@/utils/gamesLastPlayedFilter'
import ControlPanel from './GamesCleaner/ControlPanel.vue'
import ResultsTable from './GamesCleaner/ResultsTable.vue'
import GamesInfoDialog from './GamesCleaner/GamesInfoDialog.vue'

const { t } = useI18n()

const emit = defineEmits<{
    showNotification: [text: string, color?: string]
}>()

const items = ref<GameApp[]>([])
const isScanning = ref(false)
const isUninstalling = ref(false)
const uninstallingId = ref<string | null>(null)
const showInfo = ref(false)
const lastPlayedFilter = ref<LastPlayedFilter>('all')
const statusText = ref(t('common.ready'))

const filteredItems = computed(() =>
    items.value.filter(item => matchesLastPlayedFilter(item.lastPlayedAt, lastPlayedFilter.value))
)

const startScan = async (): Promise<void> => {
    if (isScanning.value || isUninstalling.value) return
    isScanning.value = true
    statusText.value = t('common.games_scanning')
    try {
        const next = await window.electronAPI.scanGames()
        items.value = next
        statusText.value =
            next.length === 0
                ? t('common.games_none_found')
                : t('common.games_found_count', { count: next.length })
    } catch (error) {
        console.error('Games scan error:', error)
        items.value = []
        statusText.value = t('common.error_scan')
        emit('showNotification', t('common.error_scan'), 'error')
    } finally {
        isScanning.value = false
    }
}

const uninstallItem = async (item: GameApp): Promise<void> => {
    if (isScanning.value || isUninstalling.value) return
    isUninstalling.value = true
    uninstallingId.value = item.id
    try {
        const result = await window.electronAPI.uninstallGame({
            launcherId: item.launcherId,
            appId: item.appId
        })
        if (result.ok) {
            emit('showNotification', t('common.games_uninstall_opened', { name: item.name }), 'info')
            statusText.value = t('common.games_uninstall_opened', { name: item.name })
        } else {
            const message = result.error || t('common.games_uninstall_failed')
            emit('showNotification', message, 'error')
            statusText.value = message
        }
    } catch (error) {
        console.error('Games uninstall error:', error)
        emit('showNotification', t('common.games_uninstall_failed'), 'error')
        statusText.value = t('common.games_uninstall_failed')
    } finally {
        isUninstalling.value = false
        uninstallingId.value = null
    }
}
</script>

<style scoped>
.dn-games-status {
    width: 100%;
    border-top: 1px solid var(--dn-border);
    background: rgb(var(--v-theme-surface));
}
</style>
