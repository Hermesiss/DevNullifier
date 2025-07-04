<template>
    <v-snackbar v-model="show" :color="color" timeout="4000">
        {{ text }}
        <template #actions>
            <v-btn @click="show = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    modelValue: boolean
    text: string
    color?: string
}>()

const emits = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

const show = computed({
    get: () => props.modelValue,
    set: (val: boolean) => emits('update:modelValue', val),
})
</script>