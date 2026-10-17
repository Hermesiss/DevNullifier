<template>
    <v-card flat width="100%" class="rounded-0">
        <DiskStrip :disk-status="diskStatus" />

        <v-card-text>
            <v-row align="center" no-gutters>
                <v-col cols="auto" class="ml-2">
                    <v-chip color="info" variant="outlined">{{ statusText }}</v-chip>
                </v-col>

                <v-spacer />

                <v-col cols="auto" v-if="isScanning && scanProgress != null" class="mx-4">
                    <v-progress-linear :model-value="scanProgress" color="primary" height="8" rounded
                        style="width: 220px" />
                </v-col>

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
import { useI18n } from 'vue-i18n'
import type { DiskStatus } from '../composables/useDiskStatus'
import DiskStrip from './DiskStrip.vue'

const { t } = useI18n()

defineProps<{
    statusText: string
    diskStatus?: DiskStatus | null
    deleteProgress: number
    scanProgress?: number | null
    selectedCount: number
    isScanning: boolean
    isDeleting: boolean
}>()

defineEmits<{
    delete: []
}>()
</script>
