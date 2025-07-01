<template>
    <v-dialog v-model="show" max-width="500">
        <v-card>
            <v-card-title class="text-h5">
                <v-icon left color="error">mdi-alert</v-icon>
                Confirm Deletion
            </v-card-title>

            <v-card-text>
                <p>This will permanently delete <strong>{{ selectedCount }}</strong> folders.</p>
                <p class="text-warning">⚠️ This action cannot be undone!</p>
                <p>Total size to be deleted: <strong>{{ formatSize(selectedSize) }}</strong></p>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn @click="show = false">Cancel</v-btn>
                <v-btn color="error" @click="confirmDelete">Delete</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { filesize } from 'filesize'

const props = defineProps({
    modelValue: Boolean,
    selectedCount: Number,
    selectedSize: Number,
})

const emits = defineEmits(['update:modelValue', 'confirm'])

const show = computed({
    get: () => props.modelValue,
    set: (val) => emits('update:modelValue', val),
})

const confirmDelete = () => {
    emits('confirm')
}

const formatSize = (bytes) => filesize(bytes, { binary: true })
</script>