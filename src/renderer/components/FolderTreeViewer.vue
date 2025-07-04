<template>
    <v-dialog v-model="isOpen" max-width="800" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon left>mdi-folder-open</v-icon>
                Folder Contents
                <v-spacer />
                <v-chip size="small" color="info">{{ folderPath }}</v-chip>
                <v-btn icon variant="text" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pa-0" style="height: 500px; overflow-y: auto;">
                <v-progress-linear v-if="loading" indeterminate color="primary" />

                <div v-if="error" class="pa-4">
                    <v-alert type="error" variant="tonal">
                        <v-icon start>mdi-alert-circle</v-icon>
                        {{ error }}
                    </v-alert>
                </div>

                <div v-if="!loading && !error && treeData.length > 0" class="tree-container">
                    <div v-for="treeItem in flattenTreeData(treeData)" :key="treeItem.item.id"
                        class="tree-item d-flex align-center pa-1" :style="{
                            marginLeft: treeItem.depth * 12 + 'px',
                            borderLeft: treeItem.depth > 0 ? '2px solid rgba(0,0,0,0.12)' : 'none',
                            backgroundColor: treeItem.depth > 0 ? 'rgba(0,0,0,' + (treeItem.depth * 0.015) + ')' : 'transparent'
                        }" @click="toggleItem(treeItem.item)">


                        <!-- Expand/Collapse Button -->
                        <v-btn v-if="treeItem.item.isDirectory" icon variant="text" size="x-small"
                            class="me-1 flex-shrink-0" @click.stop="toggleItem(treeItem.item)">
                            <v-icon size="small">
                                {{ treeItem.isExpanded ? 'mdi-menu-down' : 'mdi-menu-right' }}
                            </v-icon>
                        </v-btn>

                        <!-- Spacer for files -->
                        <div v-else class="me-1" style="width: 24px;"></div>

                        <!-- File/Folder Icon -->
                        <v-icon :color="getIconColor(treeItem.item)" size="small" class="me-2 flex-shrink-0">
                            {{ getItemIcon(treeItem.item) }}
                        </v-icon>

                        <!-- Name -->
                        <span class="text-body-2 flex-grow-1 text-truncate">{{ treeItem.item.name }}</span>

                        <!-- Size/Count Info -->
                        <v-chip v-if="!treeItem.item.isDirectory && treeItem.item.size" size="x-small"
                            variant="outlined" color="grey" class="ms-2 flex-shrink-0">
                            {{ formatSize(treeItem.item.size) }}
                        </v-chip>

                        <v-chip v-else-if="treeItem.item.isDirectory && treeItem.item.itemCount" size="x-small"
                            variant="outlined" color="amber" class="ms-2 flex-shrink-0">
                            {{ treeItem.item.itemCount }} items
                        </v-chip>
                    </div>
                </div>

                <div v-if="!loading && !error && treeData.length === 0" class="pa-4 text-center">
                    <v-icon size="64" color="grey">mdi-folder-open</v-icon>
                    <p class="text-grey mt-2">Folder is empty</p>
                </div>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn @click="close">Close</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatSize } from '@/utils/formatters'

interface TreeItem {
    id: string
    name: string
    path: string
    isDirectory: boolean
    size?: number
    itemCount?: number
    children: TreeItem[]
}

interface FlatTreeItem {
    item: TreeItem
    depth: number
    isExpanded: boolean
}

// Props
const props = defineProps<{
    modelValue: boolean
    folderPath: string
}>()

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

// Reactive state
const isOpen = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const treeData = ref<TreeItem[]>([])
const expandedItems = ref(new Set<string>())
const loadedItems = ref(new Set<string>())

// Watch for prop changes
watch(() => props.modelValue, (newVal) => {
    isOpen.value = newVal
    if (newVal && props.folderPath) {
        loadFolderContents()
    }
})

watch(isOpen, (newVal) => {
    emit('update:modelValue', newVal)
})

// Methods
const close = (): void => {
    isOpen.value = false
    treeData.value = []
    error.value = null
    expandedItems.value.clear()
    loadedItems.value.clear()
}

const getFileIcon = (filename: string): string => {
    if (!filename) return 'mdi-file'

    // Special case for "more items" indicator
    if (filename.startsWith('... and ') && filename.includes('more items')) {
        return 'mdi-dots-horizontal'
    }

    const ext = filename.split('.').pop()?.toLowerCase()
    const iconMap: Record<string, string> = {
        // Code files
        'js': 'mdi-language-javascript',
        'ts': 'mdi-language-typescript',
        'py': 'mdi-language-python',
        'java': 'mdi-language-java',
        'cs': 'mdi-language-csharp',
        'cpp': 'mdi-language-cpp',
        'c': 'mdi-language-c',
        'h': 'mdi-code-tags',
        'hpp': 'mdi-code-tags',
        'rs': 'mdi-language-rust',
        'go': 'mdi-language-go',
        'php': 'mdi-language-php',
        'rb': 'mdi-language-ruby',
        'swift': 'mdi-language-swift',

        // Web files
        'html': 'mdi-language-html5',
        'css': 'mdi-language-css3',
        'scss': 'mdi-sass',
        'less': 'mdi-sass',

        // Config/Data files
        'json': 'mdi-code-json',
        'xml': 'mdi-xml',
        'yaml': 'mdi-code-tags',
        'yml': 'mdi-code-tags',
        'toml': 'mdi-code-tags',
        'ini': 'mdi-cog',
        'env': 'mdi-cog',

        // Build/Package files
        'dockerfile': 'mdi-docker',
        'makefile': 'mdi-hammer-wrench',
        'gradle': 'mdi-gradle',
        'maven': 'mdi-file-xml-box',

        // Documentation
        'md': 'mdi-language-markdown',
        'txt': 'mdi-file-document',
        'pdf': 'mdi-file-pdf-box',
        'doc': 'mdi-file-word',
        'docx': 'mdi-file-word',

        // Media
        'png': 'mdi-file-image',
        'jpg': 'mdi-file-image',
        'jpeg': 'mdi-file-image',
        'gif': 'mdi-file-image',
        'svg': 'mdi-svg',
        'mp4': 'mdi-file-video',
        'mp3': 'mdi-file-music',

        // Archives
        'zip': 'mdi-folder-zip',
        'tar': 'mdi-folder-zip',
        'gz': 'mdi-folder-zip',
        '7z': 'mdi-folder-zip',
        'rar': 'mdi-folder-zip',
    }

    return iconMap[ext || ''] || 'mdi-file'
}

// Helper functions for the tree view
const getItemIcon = (item: TreeItem): string => {
    if (item.isDirectory) {
        return 'mdi-folder'
    }
    return getFileIcon(item.name)
}

const getIconColor = (item: TreeItem): string => {
    return item.isDirectory ? 'amber' : 'blue-grey'
}

// Inline TreeItem component rendering
const renderTreeItem = (item: TreeItem, depth = 0): FlatTreeItem => {
    const isExpanded = expandedItems.value.has(item.id)

    return {
        item,
        depth,
        isExpanded
    }
}

const flattenTreeData = (items: TreeItem[], depth = 0): FlatTreeItem[] => {
    const result: FlatTreeItem[] = []

    for (const item of items) {
        result.push(renderTreeItem(item, depth))

        if (expandedItems.value.has(item.id) && item.children && item.children.length > 0) {
            result.push(...flattenTreeData(item.children, depth + 1))
        }
    }

    return result
}

const loadFolderContents = async (): Promise<void> => {
    if (!props.folderPath) return

    loading.value = true
    error.value = null

    try {
        const contents = await window.electronAPI.getFolderContents(props.folderPath)
        treeData.value = contents.map((item: any) => ({
            ...item,
            id: item.path,
            name: item.name,
            children: []
        }))
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        error.value = `Failed to load folder contents: ${errorMessage}`
        console.error('Error loading folder contents:', err)
    } finally {
        loading.value = false
    }
}

// Toggle item expansion
const toggleItem = (item: TreeItem): void => {
    if (!item.isDirectory) return

    if (expandedItems.value.has(item.id)) {
        expandedItems.value.delete(item.id)
    } else {
        expandedItems.value.add(item.id)
        // Load children if not loaded yet
        if (!loadedItems.value.has(item.id)) {
            loadItemChildren(item)
        }
    }
}

// Load children for an item
const loadItemChildren = async (item: TreeItem): Promise<void> => {
    if (!item.isDirectory || loadedItems.value.has(item.id)) return

    try {
        const contents = await window.electronAPI.getFolderContents(item.path)

        item.children = contents.map((childItem: any) => ({
            ...childItem,
            id: childItem.path,
            name: childItem.name,
            children: []
        }))

        loadedItems.value.add(item.id)

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to load children for ${item.name}:`, errorMessage)
        item.children = []
    }
}


</script>

<style scoped>
.tree-container {
    font-family: 'Roboto Mono', monospace;
    font-size: 14px;
}

.tree-item {
    cursor: pointer;
    min-height: 36px;
    border-radius: 0;
    transition: all 0.2s ease;
    position: relative;
}

.tree-item:hover {
    background-color: rgba(0, 0, 0, 0.06);
}

.tree-item:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background-color: transparent;
    transition: background-color 0.2s;
}

.tree-item:hover:before {
    background-color: rgba(25, 118, 210, 0.3);
}

.tree-item.selected {
    background-color: rgba(25, 118, 210, 0.12);
}

.flex-shrink-0 {
    flex-shrink: 0;
}

.flex-grow-1 {
    flex-grow: 1;
}

.text-truncate {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.depth-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: rgba(0, 0, 0, 0.08);
    pointer-events: none;
    z-index: 1;
}
</style>