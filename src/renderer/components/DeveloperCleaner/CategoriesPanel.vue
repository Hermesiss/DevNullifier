<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card>
                <v-card-title class="pb-2 cursor-pointer" @click="showCategories = !showCategories">
                    <v-icon :class="{ 'rotate-90': showCategories }" class="mr-2 transition-transform">
                        mdi-chevron-right
                    </v-icon>
                    Development Categories ({{ enabledCount }}/{{ categories.length }} enabled)
                    <v-spacer />
                    <v-chip size="small" v-if="!hasEnabledCategories"
                        :color="hasEnabledCategories ? 'success' : 'warning'">
                        {{ hasEnabledCategories ? 'Ready' : 'No categories enabled' }}
                    </v-chip>
                </v-card-title>

                <v-expand-transition>
                    <v-card-text v-show="showCategories" class="pt-0">
                        <v-row class="mb-2">
                            <v-col cols="auto">
                                <v-btn variant="outlined" size="small" @click="enableAll">
                                    <v-icon left size="small">mdi-check-all</v-icon>
                                    Enable All
                                </v-btn>
                            </v-col>
                            <v-col cols="auto">
                                <v-btn variant="outlined" size="small" @click="disableAll">
                                    <v-icon left size="small">mdi-close-box-multiple</v-icon>
                                    Disable All
                                </v-btn>
                            </v-col>
                        </v-row>

                        <v-row dense>
                            <v-col cols="6" sm="4" md="3" lg="2" v-for="category in categories" :key="category.id">
                                <v-card variant="outlined" class="pa-2 category-card"
                                    :class="{ 'bg-success-lighten-4': category.enabled }">
                                    <div class="d-flex align-center h-100">
                                        <v-checkbox v-model="category.enabled" color="primary" hide-details
                                            density="compact" @change="saveCategoryStates" />
                                        <div class="flex-grow-1 ml-1 d-flex align-center justify-space-between">
                                            <span class="text-caption font-weight-medium">{{ category.name }}</span>
                                            <v-btn icon variant="text" size="x-small"
                                                @click.stop="showCategoryInfo(category)">
                                                <v-icon size="small" :color="category.warning ? 'warning' : 'info'">
                                                    {{ category.warning ? 'mdi-alert-circle' : 'mdi-information' }}
                                                </v-icon>
                                            </v-btn>
                                        </div>
                                    </div>
                                </v-card>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-expand-transition>
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

// Props
const props = defineProps({
    initialCategories: {
        type: Array,
        required: true
    }
})

// Emits
const emit = defineEmits(['category-info', 'categories-changed'])

// Reactive state
const categories = ref([...props.initialCategories])
const showCategories = ref(false)

// localStorage key
const STORAGE_KEYS = {
    CATEGORIES: 'developer-cleaner-categories',
    SHOW_CATEGORIES: 'developer-cleaner-show-categories'
}

// Computed properties
const hasEnabledCategories = computed(() =>
    categories.value.some(cat => cat.enabled)
)

const enabledCount = computed(() =>
    categories.value.filter(cat => cat.enabled).length
)

// Methods
const saveCategoryStates = () => {
    const states = {}
    categories.value.forEach(cat => {
        states[cat.id] = cat.enabled
    })
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(states))
    emit('categories-changed', categories.value)
}

const loadCategoryStates = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
        if (stored) {
            const states = JSON.parse(stored)
            categories.value.forEach(cat => {
                if (states.hasOwnProperty(cat.id)) {
                    cat.enabled = states[cat.id]
                }
            })
        }
    } catch (error) {
        console.error('Error loading category states:', error)
    }
}

const enableAll = () => {
    categories.value.forEach(cat => cat.enabled = true)
    saveCategoryStates()
}

const disableAll = () => {
    categories.value.forEach(cat => cat.enabled = false)
    saveCategoryStates()
}

const showCategoryInfo = (category) => {
    emit('category-info', category)
}

// Watch for changes in showCategories and save to localStorage
watch(showCategories, (newValue) => {
    localStorage.setItem(STORAGE_KEYS.SHOW_CATEGORIES, JSON.stringify(newValue))
})

// Load saved states on mount
onMounted(() => {
    loadCategoryStates()

    // Load show categories preference
    const showCategoriesStored = localStorage.getItem(STORAGE_KEYS.SHOW_CATEGORIES)
    if (showCategoriesStored !== null) {
        showCategories.value = JSON.parse(showCategoriesStored)
    }

    // Emit initial categories state
    emit('categories-changed', categories.value)
})

// Expose computed properties for parent access
defineExpose({
    hasEnabledCategories,
    enabledCount,
    categories: computed(() => categories.value)
})
</script>

<style scoped>
.rotate-90 {
    transform: rotate(90deg);
}

.transition-transform {
    transition: transform 0.2s ease;
}

.cursor-pointer {
    cursor: pointer;
}

.category-card {
    height: 48px;
    min-height: 48px;
}
</style>