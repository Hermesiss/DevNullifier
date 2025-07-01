<template>
    <v-snackbar v-model="show" :color="color" timeout="4000">
        {{ text }}
        <template #actions>
            <v-btn @click="show = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    modelValue: Boolean,
    text: String,
    color: {
        type: String,
        default: 'info',
    },
})

const emits = defineEmits(['update:modelValue'])

const show = computed({
    get: () => props.modelValue,
    set: (val) => emits('update:modelValue', val),
})
</script>