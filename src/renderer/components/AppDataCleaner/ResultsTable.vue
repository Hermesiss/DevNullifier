<template>
    <v-card>
        <v-card-title>
            <span>Found Folders</span>
            <v-spacer />
            <v-chip v-if="totalSize > 0" color="info" variant="outlined">
                {{ formatSize(selectedSize) }} / {{ formatSize(totalSize) }}
            </v-chip>
        </v-card-title>

        <v-data-table v-model="selected" :headers="headers" :items="uniqueItems" :items-per-page="50" item-value="path"
            show-select :loading="isScanning" loading-text="Scanning for folders..."
            :sort-by="[{ key: 'size', order: 'desc' }]" class="elevation-1">
            <template #item.size="{ item }">
                {{ formatSize(item.size) }}
            </template>

            <template #item.path="{ item }">
                <div class="d-flex align-center">
                    <v-btn icon variant="text" size="small" @click="openFolderTree(item.path)" :disabled="isScanning"
                        class="ml-2">
                        <v-icon size="small" color="primary">mdi-folder-open</v-icon>
                    </v-btn>
                    <span class="flex-grow-1">
                        {{ item.path }}
                    </span>
                </div>
            </template>
        </v-data-table>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatSize } from '@/utils/formatters'
import { FolderItem } from '@/types/common'

const props = defineProps<{
    folders?: FolderItem[]
    modelValue?: string[]
    isScanning?: boolean
}>()

const emits = defineEmits<{
    'update:modelValue': [value: string[]]
    'open-folder-tree': [folderPath: string]
}>()

// Create unique items with IDs
const uniqueItems = computed(() => {
    const seen = new Map<string, FolderItem & { id: string }>();
    return (props.folders || []).map(folder => {
        const existingFolder = seen.get(folder.path);
        if (existingFolder) {
            return existingFolder;
        }
        const uniqueFolder = {
            ...folder,
            id: `${folder.path}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        seen.set(folder.path, uniqueFolder);
        return uniqueFolder;
    });
});

const selected = computed({
    get: () => props.modelValue || [],
    set: (val: string[]) => emits('update:modelValue', val),
})

const headers = [
    { title: 'Path', key: 'path', sortable: true },
    { title: 'Size', key: 'size', sortable: true, width: '150px' },
]

const totalSize = computed(() => uniqueItems.value.reduce((sum, f) => sum + f.size, 0))
const selectedSize = computed(() =>
    (selected.value || []).reduce((sum, path) => {
        const folder = uniqueItems.value.find((f) => f.path === path)
        return sum + (folder ? folder.size : 0)
    }, 0),
)

const openFolderTree = (folderPath: string): void => {
    emits('open-folder-tree', folderPath)
}
</script>

<style scoped>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>