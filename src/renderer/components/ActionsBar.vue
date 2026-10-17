<template>
    <v-card flat width="100%" class="rounded-0">
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

                <v-col cols="auto" class="mr-4">
                    <v-switch v-model="permanentDelete" class="permanent-delete-switch" density="compact"
                        hide-details="auto" persistent-hint :color="permanentDelete ? 'error' : undefined"
                        :disabled="isScanning || isDeleting" :label="t('common.delete_permanently')"
                        :hint="t('common.delete_permanently_hint')" />
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

const { t } = useI18n()

const props = defineProps<{
    statusText: string
    deleteProgress: number
    selectedCount: number
    isScanning: boolean
    isDeleting: boolean
}>()

const emit = defineEmits<{
    delete: []
}>()

const permanentDelete = defineModel<boolean>("permanentDelete", { default: false })
</script>

<style scoped>
.permanent-delete-switch {
    max-width: 280px;
}
</style>