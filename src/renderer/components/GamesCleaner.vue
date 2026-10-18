<template>
    <div>
        <ControlPanel
            :is-scanning="isScanning"
            :is-uninstalling="isUninstalling"
            :last-played-filter="lastPlayedFilter"
            :launcher-filter="launcherFilter"
            @scan="startScan"
            @show-info="showInfo = true"
            @update:last-played-filter="lastPlayedFilter = $event"
            @update:launcher-filter="launcherFilter = $event"
        />

        <ResultsTable
            :items="filteredItems"
            :is-scanning="isScanning"
            :is-uninstalling="isUninstalling"
            :uninstalling-id="uninstallingId"
            @uninstall="uninstallItem"
            @preview-uninstall="previewUninstall"
        />

        <GamesInfoDialog v-model="showInfo" />

        <v-footer app class="pa-0">
            <v-card flat width="100%" class="rounded-0">
                <DiskStrip :disk-status="diskStatus" />
                <v-card-text>
                    <v-row align="center" no-gutters>
                        <v-col cols="auto" class="ml-2">
                            <v-chip color="info" variant="outlined">{{ statusText }}</v-chip>
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-footer>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GameApp } from '@/types'
import { useDiskStatus } from '../composables/useDiskStatus'
import {
    matchesLastPlayedFilter,
    type LastPlayedFilter
} from '@/utils/gamesLastPlayedFilter'
import {
    matchesLauncherFilter,
    type LauncherFilter
} from '@/utils/gamesLauncherFilter'
import ControlPanel from './GamesCleaner/ControlPanel.vue'
import ResultsTable from './GamesCleaner/ResultsTable.vue'
import GamesInfoDialog from './GamesCleaner/GamesInfoDialog.vue'
import DiskStrip from './DiskStrip.vue'

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
const launcherFilter = ref<LauncherFilter>('all')
const statusText = ref(t('common.ready'))
const scanRoot = ref<string | null>(null)
const previewSize = ref(0)

const filteredItems = computed(() =>
    items.value.filter(
        item =>
            matchesLauncherFilter(item.launcherId, launcherFilter.value) &&
            matchesLastPlayedFilter(item.lastPlayedAt, lastPlayedFilter.value)
    )
)

const foundSize = computed(() => items.value.reduce((sum, item) => sum + item.size, 0))
const selectedSize = computed(() => previewSize.value)

const { diskStatus, refreshDiskStatus } = useDiskStatus(scanRoot, selectedSize, foundSize)

const previewUninstall = (item: GameApp | null): void => {
    previewSize.value = item?.size ?? 0
}

const startScan = async (): Promise<void> => {
    if (isScanning.value || isUninstalling.value) return
    isScanning.value = true
    previewSize.value = 0
    window.electronAPI.removeAllListeners('games-scan-launcher')
    window.electronAPI.onGamesScanLauncher((launcher: string) => {
        statusText.value = t('common.games_scanning', { launcher })
    })
    try {
        const next = await window.electronAPI.scanGames()
        items.value = next
        scanRoot.value = next.find(item => item.installPath)?.installPath ?? null
        await refreshDiskStatus()
        statusText.value =
            next.length === 0
                ? t('common.games_none_found')
                : t('common.games_found_count', { count: next.length })
    } catch (error) {
        console.error('Games scan error:', error)
        items.value = []
        scanRoot.value = null
        statusText.value = t('common.error_scan')
        emit('showNotification', t('common.error_scan'), 'error')
    } finally {
        window.electronAPI.removeAllListeners('games-scan-launcher')
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
            const message =
                item.launcherId === 'epic'
                    ? t('common.games_uninstall_epic_manual', { name: item.name })
                    : t('common.games_uninstall_opened', { name: item.name })
            emit('showNotification', message, 'info')
            statusText.value = message
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
