<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card class="dn-surface-card">
                <v-card-text>
                    <v-row align="center">
                        <v-col cols="auto">
                            <v-btn color="primary" :loading="isScanning" :disabled="isDeleting" @click="$emit('scan')">
                                <v-icon start>mdi-magnify</v-icon>
                                {{ t('common.scan') }}
                            </v-btn>
                        </v-col>

                        <v-col cols="auto">
                            <v-btn variant="outlined" :disabled="itemsLength === 0 || isScanning || isDeleting"
                                @click="$emit('select-all')">
                                {{ t('common.select_all') }}
                            </v-btn>
                        </v-col>
                        <v-col cols="auto">
                            <v-btn variant="outlined" :disabled="itemsLength === 0 || isScanning || isDeleting"
                                @click="$emit('deselect-all')">
                                {{ t('common.deselect_all') }}
                            </v-btn>
                        </v-col>

                        <v-col cols="auto">
                            <v-btn variant="outlined" color="info" :disabled="isScanning || isDeleting || isPruning"
                                @click="$emit('prune-docker')">
                                {{ t('common.prune_docker') }}
                            </v-btn>
                        </v-col>
                        <v-col cols="auto">
                            <v-btn variant="outlined" color="info" :disabled="isScanning || isDeleting || isPruning"
                                @click="$emit('prune-podman')">
                                {{ t('common.prune_podman') }}
                            </v-btn>
                        </v-col>

                        <v-spacer />

                        <v-col cols="auto">
                            <v-btn icon variant="text" :aria-label="t(infoLabelKey)"
                                @click="$emit('show-info')">
                                <v-icon>mdi-information-outline</v-icon>
                                <v-tooltip activator="parent" location="bottom">
                                    {{ t(infoLabelKey) }}
                                </v-tooltip>
                            </v-btn>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-progress-linear :indeterminate="false" :height="4"
                    :model-value="isScanning ? scanProgress : 100" color="primary" />
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

withDefaults(defineProps<{
    isScanning: boolean
    isDeleting: boolean
    isPruning?: boolean
    itemsLength: number
    scanProgress: number
    infoLabelKey?: string
}>(), {
    infoLabelKey: 'common.tool_caches_info',
    isPruning: false
})

defineEmits<{
    scan: []
    'select-all': []
    'deselect-all': []
    'show-info': []
    'prune-docker': []
    'prune-podman': []
}>()
</script>
