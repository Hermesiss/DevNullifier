<template>
    <v-card>
        <v-card-title>
            <span>{{ t('common.found_games') }}</span>
            <v-spacer />
            <v-chip v-if="totalSize > 0" color="info" variant="outlined">
                {{ formatSize(totalSize) }}
            </v-chip>
        </v-card-title>

        <div class="d-flex flex-wrap ga-3 px-4 pb-2">
            <v-text-field v-model="pathQuery" class="filter-path" :label="t('common.search_path')"
                prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" hide-details clearable
                autocomplete="off" />
        </div>

        <v-data-table :headers="headers" :items="filteredItems" item-value="id" :loading="isScanning"
            :loading-text="t('common.loading')" :items-per-page="50"
            :sort-by="[{ key: 'size', order: 'desc' }]" class="dn-results-table">
            <template #item.launcherLabel="{ item }">
                <v-chip size="x-small" variant="tonal" color="info">{{ item.launcherLabel }}</v-chip>
            </template>

            <template #item.name="{ item }">
                <div class="font-weight-medium">{{ item.name }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.appId }}</div>
            </template>

            <template #item.kind="{ item }">
                <v-chip size="x-small" variant="outlined">{{ kindLabel(item.kind) }}</v-chip>
            </template>

            <template #item.lastPlayedAt="{ item }">
                <span :title="absoluteLastPlayed(item.lastPlayedAt)">
                    {{ relativeLastPlayed(item.lastPlayedAt) }}
                </span>
            </template>

            <template #item.path="{ item }">
                <div class="d-flex align-center">
                    <v-btn icon variant="text" size="small" class="ml-2"
                        :disabled="isScanning || isUninstalling || !item.installPath"
                        @click="openInFileManager(item.installPath)">
                        <v-icon size="small">mdi-open-in-new</v-icon>
                    </v-btn>
                    <v-btn icon variant="text" size="small"
                        :disabled="isScanning || isUninstalling || !item.installPath"
                        @click="copyPath(item.installPath)">
                        <v-icon size="small">mdi-content-copy</v-icon>
                    </v-btn>
                    <span class="flex-grow-1 dn-path" :title="item.installPath">{{ item.installPath }}</span>
                </div>
            </template>

            <template #item.size="{ item }">
                <div class="dn-num font-weight-medium">{{ formatSize(item.size) }}</div>
            </template>

            <template #item.actions="{ item }">
                <v-btn color="error" variant="tonal" size="small"
                    :loading="uninstallingId === item.id"
                    :disabled="isScanning || (isUninstalling && uninstallingId !== item.id)"
                    @click="$emit('uninstall', item)">
                    <v-icon start size="small">mdi-delete-outline</v-icon>
                    {{ t('common.games_uninstall') }}
                </v-btn>
            </template>
        </v-data-table>
    </v-card>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSize } from '@/utils/formatters'
import { matchesPathQuery } from '@/utils/tableFilter'
import type { GameApp, GameAppKind } from '@/types'

const { t } = useI18n()

const props = defineProps<{
    items: GameApp[]
    isScanning: boolean
    isUninstalling: boolean
    uninstallingId: string | null
}>()

defineEmits<{
    uninstall: [item: GameApp]
}>()

const pathQuery = ref('')
const copiedPath = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const headers = computed(() => [
    { title: t('common.games_launcher'), key: 'launcherLabel', sortable: true },
    { title: t('common.games_name'), key: 'name', sortable: true },
    { title: t('common.games_kind'), key: 'kind', sortable: true },
    { title: t('common.size'), key: 'size', sortable: true, align: 'end' as const },
    { title: t('common.games_last_played'), key: 'lastPlayedAt', sortable: true },
    { title: t('common.path'), key: 'path', sortable: false },
    { title: '', key: 'actions', sortable: false, align: 'end' as const },
])

const totalSize = computed(() => props.items.reduce((sum, item) => sum + item.size, 0))

const filteredItems = computed(() =>
    props.items.filter(item =>
        matchesPathQuery(item.installPath, pathQuery.value) ||
        matchesPathQuery(item.name, pathQuery.value) ||
        matchesPathQuery(item.appId, pathQuery.value)
    )
)

const kindLabel = (kind: GameAppKind): string => t(`common.games_kind_${kind}`)

const relativeLastPlayed = (lastPlayedAt: number | null): string => {
    if (lastPlayedAt === null) return t('common.games_never_played')
    const diffDays = Math.floor((Date.now() - lastPlayedAt) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return t('common.today')
    return `${diffDays} ${t('common.days_ago')}`
}

const absoluteLastPlayed = (lastPlayedAt: number | null): string => {
    if (lastPlayedAt === null) return ''
    const date = new Date(lastPlayedAt)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleString()
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
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
        copiedPath.value = null
    }, 1500)
}

onUnmounted(() => {
    if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style scoped>
.filter-path {
    min-width: 220px;
    max-width: 420px;
    flex: 1 1 220px;
}
</style>
