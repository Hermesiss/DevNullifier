<template>
    <v-card flat width="100%" class="rounded-0">
        <div v-if="diskStatus" class="disk-strip">
            <div class="disk-bar" role="img" :aria-label="diskLabel">
                <div class="disk-used" :style="{ flexGrow: diskStatus.otherUsedBytes }"></div>
                <div class="disk-found" :style="{ flexGrow: diskStatus.foundBytes }">
                    <div class="disk-selected" :style="{ width: diskStatus.selectedOfFoundPercent + '%' }"></div>
                </div>
                <div class="disk-free" :style="{ flexGrow: diskStatus.freeBytes }"></div>
            </div>
            <div class="disk-legend text-caption text-medium-emphasis">
                <span class="swatch swatch-used"></span>
                {{ t('common.disk_used', { size: diskStatus.usedText }) }}
                <span class="swatch swatch-found"></span>
                {{ t('common.disk_found', { size: diskStatus.foundText }) }}
                <span class="swatch swatch-selected"></span>
                {{ t('common.disk_selected', { size: diskStatus.selectedText, percent: diskStatus.percent }) }}
                <span class="swatch swatch-free"></span>
                {{ t('common.disk_free', { size: diskStatus.freeText }) }}
            </div>
        </div>

        <v-card-text>
            <v-row align="center" no-gutters>
                <v-col cols="auto" class="ml-2">
                    <v-chip color="info" variant="outlined">{{ statusText }}</v-chip>
                </v-col>

                <v-spacer />

                <v-col cols="auto" v-if="isDeleting">
                    <v-progress-linear :model-value="deleteProgress" color="error" height="8" rounded
                        style="width: 200px" class="mx-4" />
                </v-col>

                <v-col cols="auto" class="mr-2">
                    <v-btn color="error" :disabled="selectedCount === 0 || isScanning || isDeleting"
                        :loading="isDeleting" @click="$emit('delete')">
                        <v-icon left>mdi-delete</v-icon>
                        {{ t('common.delete_selected') }} ({{ selectedCount }})
                    </v-btn>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiskStatus } from '../composables/useDiskStatus'

const { t } = useI18n()

const props = defineProps<{
    statusText: string
    diskStatus?: DiskStatus | null
    deleteProgress: number
    selectedCount: number
    isScanning: boolean
    isDeleting: boolean
}>()

defineEmits<{
    delete: []
}>()

const diskLabel = computed(() => {
    const disk = props.diskStatus
    if (!disk) return ''
    return [
        t('common.disk_used', { size: disk.usedText }),
        t('common.disk_found', { size: disk.foundText }),
        t('common.disk_selected', { size: disk.selectedText, percent: disk.percent }),
        t('common.disk_free', { size: disk.freeText })
    ].join('. ')
})
</script>

<style scoped>
.disk-strip {
    width: 100%;
}

.disk-bar {
    display: flex;
    width: 100%;
    height: 16px;
    overflow: hidden;
    border-radius: 6px;
    border: 1px solid var(--dn-border, rgba(var(--v-theme-on-surface), 0.12));
    background: rgba(var(--v-theme-on-surface), 0.08);
}

.disk-used,
.disk-found,
.disk-free {
    flex-basis: 0;
    min-width: 0;
    height: 100%;
}

.disk-used {
    background: rgba(var(--v-theme-on-surface), 0.38);
}

.disk-found {
    position: relative;
    background: rgba(var(--v-theme-info), 0.55);
}

.disk-selected {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgb(var(--v-theme-primary));
}

.disk-free {
    background: rgba(var(--v-theme-success), 0.55);
}

.disk-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 6px 12px;
    padding: 4px 16px 0;
    text-align: center;
}

.swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 2px;
    border-radius: 2px;
    vertical-align: -1px;
}

.swatch-used {
    background: rgba(var(--v-theme-on-surface), 0.38);
}

.swatch-found {
    background: rgba(var(--v-theme-info), 0.55);
}

.swatch-selected {
    background: rgb(var(--v-theme-primary));
}

.swatch-free {
    background: rgba(var(--v-theme-success), 0.55);
}
</style>
