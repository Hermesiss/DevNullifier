<template>
    <v-card>
        <v-card-text>
            <v-row align="center">
                <v-col cols="auto">
                    <v-chip color="info" variant="outlined">{{ statusText }}</v-chip>
                </v-col>

                <v-spacer />

                <v-col cols="auto" v-if="isDeleting">
                    <v-progress-linear :model-value="deleteProgress" color="error" height="8" rounded
                        style="width: 200px" />
                </v-col>

                <v-col cols="auto">
                    <v-btn color="error" :disabled="selectedCount === 0 || isScanning || isDeleting"
                        :loading="isDeleting" @click="$emit('delete')">
                        <v-icon left>mdi-delete</v-icon>
                        Delete Selected ({{ selectedCount }})
                    </v-btn>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script setup>
const props = defineProps({
    statusText: String,
    deleteProgress: Number,
    selectedCount: Number,
    isScanning: Boolean,
    isDeleting: Boolean,
})
</script>