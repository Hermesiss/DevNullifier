<template>
    <v-dialog v-model="showDialog" max-width="720" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center">
                <span>{{ title }}</span>
                <v-spacer />
                <v-chip v-if="totalSize > 0" color="info" variant="outlined" size="small">
                    {{ formatSize(selectedSize) }} / {{ formatSize(totalSize) }}
                </v-chip>
            </v-card-title>

            <v-card-text>
                <div class="d-flex flex-wrap ga-2 mb-3">
                    <v-text-field v-model="query" :label="t('common.search_path')" density="compact"
                        variant="outlined" hide-details clearable prepend-inner-icon="mdi-magnify"
                        class="temp-details-search" autocomplete="off" />
                    <v-btn variant="outlined" size="small" :disabled="isBusy"
                        @click="selectFiltered(true)">{{ t('common.select_all') }}</v-btn>
                    <v-btn variant="outlined" size="small" :disabled="isBusy"
                        @click="selectFiltered(false)">{{ t('common.deselect_all') }}</v-btn>
                </div>

                <v-data-table :headers="headers" :items="filtered" item-value="path"
                    :items-per-page="50" density="compact" class="dn-results-table"
                    :sort-by="[{ key: 'size', order: 'desc' }]">
                    <template #item.selected="{ item }">
                        <v-checkbox :model-value="selectedPaths.includes(item.path)" color="primary"
                            hide-details density="compact" :disabled="isBusy"
                            @update:model-value="(value) => toggle(item.path, !!value)" />
                    </template>
                    <template #item.label="{ item }">
                        <div class="font-weight-medium">{{ item.label }}</div>
                        <div class="text-caption dn-path text-medium-emphasis" :title="item.path">{{ item.path }}</div>
                    </template>
                    <template #item.size="{ item }">
                        <span class="dn-num">{{ formatSize(item.size) }}</span>
                    </template>
                </v-data-table>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="showDialog = false">{{ t('common.close') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSize } from '@/utils/formatters'
import { matchesPathQuery } from '@/utils/tableFilter'
import type { ToolCacheChild } from '@/types'

const { t } = useI18n()

const props = defineProps<{
    modelValue: boolean
    title: string
    children: ToolCacheChild[]
    selectedPaths: string[]
    isBusy?: boolean
}>()

const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    'update:selectedPaths': [paths: string[]]
}>()

const showDialog = ref(props.modelValue)
const query = ref('')

watch(() => props.modelValue, value => {
    showDialog.value = value
    if (value) query.value = ''
})

watch(showDialog, value => emit('update:modelValue', value))

const headers = computed(() => [
    { title: '', key: 'selected', sortable: false, width: '48px' },
    { title: t('common.path'), key: 'label', sortable: true },
    { title: t('common.size'), key: 'size', sortable: true, align: 'end' as const }
])

const filtered = computed(() => {
    const q = query.value.trim()
    if (!q) return props.children
    return props.children.filter(
        child =>
            matchesPathQuery(child.path, q) ||
            child.label.toLowerCase().includes(q.toLowerCase())
    )
})

const totalSize = computed(() => props.children.reduce((sum, child) => sum + child.size, 0))

const selectedSize = computed(() =>
    props.children
        .filter(child => props.selectedPaths.includes(child.path))
        .reduce((sum, child) => sum + child.size, 0)
)

const isBusy = computed(() => props.isBusy === true)

const toggle = (path: string, on: boolean): void => {
    const next = props.selectedPaths.filter(item => item !== path)
    if (on) next.push(path)
    emit('update:selectedPaths', next)
}

const selectFiltered = (on: boolean): void => {
    const filteredPaths = new Set(filtered.value.map(child => child.path))
    const next = props.selectedPaths.filter(path => !filteredPaths.has(path))
    if (on) next.push(...filteredPaths)
    emit('update:selectedPaths', next)
}
</script>

<style scoped>
.temp-details-search {
    min-width: 220px;
    flex: 1 1 220px;
}
</style>
