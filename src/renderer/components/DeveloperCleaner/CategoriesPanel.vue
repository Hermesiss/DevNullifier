<template>
    <v-row class="mb-4">
        <v-col cols="12">
            <v-card>
                <v-card-title class="pb-2 cursor-pointer" @click="showCategories = !showCategories">
                    <v-icon :class="{ 'rotate-90': showCategories }" class="mr-2 transition-transform">
                        mdi-chevron-right
                    </v-icon>
                    {{ t('common.dev_categories') }} ({{ enabledCount }}/{{ categories.length }} {{ t('common.enabled')
                    }})
                    <v-spacer />
                    <v-chip size="small" v-if="!hasEnabledCategories"
                        :color="hasEnabledCategories ? 'success' : 'warning'">
                        {{ hasEnabledCategories ? t('common.ready') : t('common.no_categories_enabled') }}
                    </v-chip>
                </v-card-title>

                <v-expand-transition>
                    <v-card-text v-show="showCategories" class="pt-0">
                        <template v-if="rulesLoaded">
                        <v-row class="mb-2">
                            <v-col cols="auto">
                                <v-btn variant="outlined" size="small" @click="enableAll">
                                    <v-icon left size="small">mdi-check-all</v-icon>
                                    {{ t('common.enable_all') }}
                                </v-btn>
                            </v-col>
                            <v-col cols="auto">
                                <v-btn variant="outlined" size="small" @click="disableAll">
                                    <v-icon left size="small">mdi-close-box-multiple</v-icon>
                                    {{ t('common.disable_all') }}
                                </v-btn>
                            </v-col>
                            <v-col cols="auto">
                                <v-tooltip :text="t('common.preset_regenerable_hint')" location="top">
                                    <template #activator="{ props: tooltipProps }">
                                        <v-btn v-bind="tooltipProps" variant="outlined" size="small"
                                            @click="applyPreset('regenerable')">
                                            {{ t('common.preset_regenerable') }}
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </v-col>
                            <v-col cols="auto">
                                <v-tooltip :text="t('common.preset_aggressive_hint')" location="top">
                                    <template #activator="{ props: tooltipProps }">
                                        <v-btn v-bind="tooltipProps" variant="outlined" size="small"
                                            @click="applyPreset('aggressive')">
                                            {{ t('common.preset_aggressive') }}
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </v-col>
                            <v-col cols="auto">
                                <v-btn variant="outlined" size="small" @click="showCustomRules = true">
                                    <v-icon left size="small">mdi-plus</v-icon>
                                    {{ t('common.custom_keywords') }} / {{ t('common.custom_categories') }}
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
                                        <div class="flex-grow-1 ml-1 d-flex align-center justify-space-between overflow-hidden">
                                            <span class="text-caption font-weight-medium text-truncate">
                                                {{ categoryLabel(category) }}
                                            </span>
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
                        <CustomScanRulesDialog v-model="showCustomRules" @saved="onCustomRulesSaved" />
                        </template>
                    </v-card-text>
                </v-expand-transition>
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyCategoryPreset, type CategoryPreset } from '@/utils/categoryPresets'
import type { DeveloperCategory } from '@/types'
import type { CustomCategory, CustomScanRules } from '../../../main/customScanRules'
import CustomScanRulesDialog from './CustomScanRulesDialog.vue'

const { t } = useI18n()

// Props
const props = defineProps<{
    initialCategories: DeveloperCategory[]
}>()

// Emits
const emit = defineEmits<{
    'category-info': [category: DeveloperCategory]
    'categories-changed': [categories: DeveloperCategory[]]
}>()

// Reactive state
const categories = ref([...props.initialCategories])
const showCategories = ref(false)
const showCustomRules = ref(false)
const rulesLoaded = ref(false)
const builtInIds = new Set(props.initialCategories.map(category => category.id))

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
const saveCategoryStates = (): void => {
    const states: Record<string, boolean> = {}
    categories.value.forEach(cat => {
        states[cat.id] = cat.enabled
    })
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(states))
    emit('categories-changed', categories.value)
}

const readStoredStates = (): Record<string, boolean> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
        if (!stored) return {}
        const parsed: unknown = JSON.parse(stored)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return parsed as Record<string, boolean>
    } catch (error) {
        console.error('Error loading category states:', error)
        return {}
    }
}

const categoryLabel = (category: DeveloperCategory): string => {
    if (!builtInIds.has(category.id)) return category.name
    return t('common.category_names.' + category.id)
}

const applyCustomCategories = (customCategories: CustomCategory[]): void => {
    const states = readStoredStates()
    const current = new Map(categories.value.map(category => [category.id, category]))
    const builtIns = props.initialCategories.map(category => {
        const existing = current.get(category.id) ?? category
        if (Object.prototype.hasOwnProperty.call(states, category.id)) {
            existing.enabled = states[category.id]
        }
        return existing
    })
    const custom = customCategories
        .filter(category => !builtInIds.has(category.id))
        .map(category => ({
            id: category.id,
            name: category.name,
            enabled: Object.prototype.hasOwnProperty.call(states, category.id)
                ? states[category.id]
                : true,
            detectionFiles: [...category.detectionFiles],
            cachePatterns: [...category.cachePatterns]
        }))
    categories.value = [...builtIns, ...custom]
    emit('categories-changed', categories.value)
}

const onCustomRulesSaved = (rules: CustomScanRules): void => {
    applyCustomCategories(rules.categories)
}

const enableAll = (): void => {
    categories.value.forEach(cat => cat.enabled = true)
    saveCategoryStates()
}

const disableAll = (): void => {
    categories.value.forEach(cat => cat.enabled = false)
    saveCategoryStates()
}

const applyPreset = (preset: CategoryPreset): void => {
    categories.value = applyCategoryPreset(categories.value, preset)
    saveCategoryStates()
}

const showCategoryInfo = (category: DeveloperCategory): void => {
    emit('category-info', category)
}

// Watch for changes in showCategories and save to localStorage
watch(showCategories, (newValue) => {
    localStorage.setItem(STORAGE_KEYS.SHOW_CATEGORIES, JSON.stringify(newValue))
})

// Load saved states on mount
onMounted(async () => {
    const showCategoriesStored = localStorage.getItem(STORAGE_KEYS.SHOW_CATEGORIES)
    if (showCategoriesStored !== null) {
        try {
            showCategories.value = JSON.parse(showCategoriesStored)
        } catch {
            showCategories.value = false
        }
    }

    let custom: CustomCategory[] = []
    try {
        if (window.electronAPI?.getCustomScanRules) {
            custom = (await window.electronAPI.getCustomScanRules()).categories
        }
    } catch (error) {
        console.error('Error loading custom scan rules:', error)
    }
    applyCustomCategories(custom)
    rulesLoaded.value = true
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