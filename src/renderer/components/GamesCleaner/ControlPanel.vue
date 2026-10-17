<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card class="dn-surface-card">
                <v-card-text>
                    <v-row align="center">
                        <v-col cols="auto">
                            <v-btn color="primary" :loading="isScanning" :disabled="isUninstalling" @click="$emit('scan')">
                                <v-icon start>mdi-magnify</v-icon>
                                {{ t('common.scan') }}
                            </v-btn>
                        </v-col>

                        <v-col cols="12" sm="4" md="3">
                            <v-select
                                :model-value="lastPlayedFilter"
                                :items="filterOptions"
                                :label="t('common.games_last_played_filter')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                :disabled="isScanning"
                                @update:model-value="$emit('update:lastPlayedFilter', $event)"
                            />
                        </v-col>

                        <v-spacer />

                        <v-col cols="auto">
                            <v-btn icon variant="text" :aria-label="t('common.games_info')"
                                @click="$emit('show-info')">
                                <v-icon>mdi-information-outline</v-icon>
                                <v-tooltip activator="parent" location="bottom">
                                    {{ t('common.games_info') }}
                                </v-tooltip>
                            </v-btn>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-progress-linear :indeterminate="isScanning" :height="4"
                    :model-value="isScanning ? undefined : 100" color="primary" />
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LastPlayedFilter } from '@/utils/gamesLastPlayedFilter'

const { t } = useI18n()

defineProps<{
    isScanning: boolean
    isUninstalling: boolean
    lastPlayedFilter: LastPlayedFilter
}>()

defineEmits<{
    scan: []
    'show-info': []
    'update:lastPlayedFilter': [value: LastPlayedFilter]
}>()

const filterOptions = computed(() => [
    { title: t('common.games_filter_all'), value: 'all' as const },
    { title: t('common.games_filter_never'), value: 'never' as const },
    { title: t('common.games_filter_30'), value: '30' as const },
    { title: t('common.games_filter_90'), value: '90' as const },
    { title: t('common.games_filter_365'), value: '365' as const },
])
</script>
