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

            <v-card-text class="pa-0" style="height: 500px;">
                <v-progress-linear v-if="loading" indeterminate color="primary" />

                <div v-if="error" class="pa-4">
                    <v-alert type="error" variant="tonal">
                        <v-icon start>mdi-alert-circle</v-icon>
                        {{ error }}
                    </v-alert>
                </div>

                <v-treeview v-if="!loading && !error && treeData.length > 0" :items="treeData" item-key="id"
                    item-title="title" item-children="children" density="compact" class="pa-2" open-strategy="multiple">
                    <template v-slot:prepend="{ item }">
                        <v-icon :color="getIconColor(item)" size="small">
                            {{ getItemIcon(item) }}
                        </v-icon>
                    </template>

                    <template v-slot:append="{ item }">
                        <v-chip v-if="!item.isDirectory" size="x-small" variant="outlined" color="grey">
                            {{ formatSize(item.size) }}
                        </v-chip>
                        <v-chip v-else-if="item.itemCount !== undefined" size="x-small" variant="outlined"
                            color="amber">
                            {{ item.itemCount }} items
                        </v-chip>
                    </template>
                </v-treeview>

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

<script setup>
import { ref, watch } from 'vue'
import { filesize } from 'filesize'


// Props
const props = defineProps({
    modelValue: Boolean,
    folderPath: String
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Reactive state
const isOpen = ref(false)
const loading = ref(false)
const error = ref(null)
const treeData = ref([])

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
const close = () => {
    isOpen.value = false
    treeData.value = []
    error.value = null
}

const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    return filesize(bytes, { binary: true })
}

const getFileIcon = (filename) => {
    if (!filename) return 'mdi-file'

    // Special case for "more items" indicator
    if (filename.startsWith('... and ') && filename.includes('more items')) {
        return 'mdi-dots-horizontal'
    }

    const ext = filename.split('.').pop()?.toLowerCase()
    const iconMap = {
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

    return iconMap[ext] || 'mdi-file'
}

// Helper functions for the tree view
const getItemIcon = (item) => {
    if (item.isDirectory) {
        return 'mdi-folder'
    }
    return getFileIcon(item.name || item.title)
}

const getIconColor = (item) => {
    // Special color for "more items" indicator
    if (item.name && item.name.startsWith('... and ') && item.name.includes('more items')) {
        return 'grey'
    }
    return item.isDirectory ? 'amber' : 'blue-grey'
}

const loadFolderContents = async () => {
    if (!props.folderPath) return

    loading.value = true
    error.value = null

    try {
        const treeStructure = await loadFolderTreeRecursive(props.folderPath, 0, 2) // Max 2 levels deep
        treeData.value = treeStructure
    } catch (err) {
        error.value = `Failed to load folder contents: ${err.message}`
        console.error('Error loading folder contents:', err)
    } finally {
        loading.value = false
    }
}

// Recursively load folder tree up to a maximum depth
const loadFolderTreeRecursive = async (folderPath, currentDepth = 0, maxDepth = 2) => {
    try {
        const contents = await window.electronAPI.getFolderContents(folderPath)
        const items = []

        // Limit number of items per directory to prevent UI freezing
        const limitedContents = contents.slice(0, 100)

        for (const item of limitedContents) {
            const treeItem = {
                ...item,
                id: item.path,
                title: item.name,
                children: undefined
            }

            // If it's a directory and we haven't reached max depth, load its children
            if (item.isDirectory && currentDepth < maxDepth) {
                try {
                    // Only load children for first few directories to prevent explosion
                    if (items.filter(i => i.isDirectory).length < 10) {
                        treeItem.children = await loadFolderTreeRecursive(item.path, currentDepth + 1, maxDepth)
                    } else {
                        treeItem.children = [] // Mark as expandable but don't load
                    }
                } catch (childError) {
                    console.warn(`Could not load children for ${item.path}:`, childError.message)
                    treeItem.children = []
                }
            } else if (item.isDirectory) {
                // Directory at max depth - mark as expandable but don't load children
                treeItem.children = []
            }

            items.push(treeItem)
        }

        // If we had to limit contents, add a note
        if (contents.length > limitedContents.length) {
            items.push({
                id: `${folderPath}_more`,
                name: `... and ${contents.length - limitedContents.length} more items`,
                title: `... and ${contents.length - limitedContents.length} more items`,
                isDirectory: false,
                size: 0,
                itemCount: undefined,
                children: undefined
            })
        }

        return items
    } catch (error) {
        console.error(`Error loading folder tree for ${folderPath}:`, error)
        return []
    }
}


</script>

<style scoped>
.v-treeview {
    font-family: 'Roboto Mono', monospace;
}
</style>