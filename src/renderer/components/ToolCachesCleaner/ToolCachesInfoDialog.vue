<template>
    <v-dialog v-model="showDialog" max-width="880" scrollable>
        <v-card class="tool-caches-info">
            <v-card-title class="d-flex align-center pb-1">
                <v-icon start>mdi-information-outline</v-icon>
                {{ t('common.tool_caches_info_title') }}
            </v-card-title>

            <v-card-text class="pt-2">
                <v-progress-linear v-if="loading" indeterminate class="mb-4" />
                <v-alert v-else-if="error" type="error" variant="tonal" class="mb-0">{{ error }}</v-alert>

                <template v-else-if="categories.length > 0">
                    <p class="text-body-2 text-medium-emphasis mb-4">
                        {{ t('common.tool_caches_info_hint') }}
                    </p>

                    <div class="tool-caches-info__layout">
                        <nav class="tool-caches-info__cats" aria-label="categories">
                            <button
                                v-for="category in categories"
                                :key="category.id"
                                type="button"
                                class="tool-caches-info__cat"
                                :class="{ 'tool-caches-info__cat--active': category.id === activeCategoryId }"
                                @click="activeCategoryId = category.id"
                            >
                                <span class="tool-caches-info__cat-label">{{ category.label }}</span>
                                <span class="tool-caches-info__cat-count">{{ category.items.length }}</span>
                            </button>
                        </nav>

                        <div class="tool-caches-info__list">
                            <h3 class="tool-caches-info__list-title">{{ activeCategory?.label }}</h3>

                            <article
                                v-for="item in activeCategory?.items ?? []"
                                :key="item.id"
                                class="tool-caches-info__card"
                            >
                                <header class="tool-caches-info__card-head">
                                    <span class="tool-caches-info__card-name">{{ item.label }}</span>
                                </header>
                                <code class="tool-caches-info__path" :title="item.path">{{ item.path }}</code>
                                <p class="tool-caches-info__desc">{{ item.description }}</p>

                                <div v-if="item.parts.length > 0" class="tool-caches-info__parts">
                                    <div v-for="part in item.parts" :key="part.id" class="tool-caches-info__part">
                                        <div class="tool-caches-info__part-name">{{ part.label }}</div>
                                        <code class="tool-caches-info__path tool-caches-info__path--nested"
                                            :title="part.path">{{ part.path }}</code>
                                        <p class="tool-caches-info__desc">{{ part.description }}</p>
                                    </div>
                                </div>
                                <p v-else-if="item.discoversChildren" class="tool-caches-info__desc mt-2">
                                    {{ t('common.tool_discovers_children') }}
                                </p>
                            </article>
                        </div>
                    </div>
                </template>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn @click="closeDialog">{{ t('common.close') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ToolCacheCatalogCategory } from '@/types'

const { t, locale } = useI18n()

const props = defineProps<{
    modelValue?: boolean
}>()

const emit = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

const showDialog = ref(props.modelValue ?? false)
const loading = ref(false)
const error = ref('')
const categories = ref<ToolCacheCatalogCategory[]>([])
const activeCategoryId = ref('')

const activeCategory = computed(() =>
    categories.value.find(category => category.id === activeCategoryId.value) ?? categories.value[0] ?? null
)

watch(() => props.modelValue, (newValue) => {
    showDialog.value = newValue ?? false
})

watch(showDialog, (newValue) => {
    emit('update:modelValue', newValue)
    if (newValue) void loadCatalog()
})

watch(locale, () => {
    if (showDialog.value) void loadCatalog()
})

const loadCatalog = async (): Promise<void> => {
    loading.value = true
    error.value = ''
    try {
        if (!window.electronAPI.getToolCacheCatalog) {
            throw new Error(t('common.error'))
        }
        const lang = locale.value?.toString().startsWith('ru') ? 'ru' : 'en'
        const next = await window.electronAPI.getToolCacheCatalog(lang)
        categories.value = next
        if (!next.some(category => category.id === activeCategoryId.value)) {
            activeCategoryId.value = next[0]?.id ?? ''
        }
    } catch (err) {
        console.error('Tool cache catalog error:', err)
        error.value = err instanceof Error ? err.message : t('common.error')
        categories.value = []
        activeCategoryId.value = ''
    } finally {
        loading.value = false
    }
}

const closeDialog = (): void => {
    showDialog.value = false
}
</script>

<style scoped>
.tool-caches-info__layout {
    display: grid;
    grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
    gap: 16px;
    min-height: 420px;
    max-height: 62vh;
}

.tool-caches-info__cats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
    padding-right: 4px;
    border-right: 1px solid var(--dn-border);
}

.tool-caches-info__cat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    margin: 0;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: var(--dn-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--dn-transition), border-color var(--dn-transition);
}

.tool-caches-info__cat:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.tool-caches-info__cat--active {
    background: rgba(var(--v-theme-info), 0.12);
    border-color: rgba(var(--v-theme-info), 0.35);
}

.tool-caches-info__cat-label {
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.3;
}

.tool-caches-info__cat-count {
    flex-shrink: 0;
    min-width: 1.5rem;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(var(--v-theme-on-surface), 0.08);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
    opacity: 0.8;
}

.tool-caches-info__list {
    overflow: auto;
    padding-right: 4px;
}

.tool-caches-info__list-title {
    margin: 0 0 12px;
    font-size: 0.95rem;
    font-weight: 700;
}

.tool-caches-info__card {
    margin-bottom: 10px;
    padding: 12px 14px;
    border: 1px solid var(--dn-border);
    border-radius: var(--dn-radius);
    background: rgba(var(--v-theme-surface-variant), 0.35);
}

.tool-caches-info__card:last-child {
    margin-bottom: 0;
}

.tool-caches-info__card-head {
    margin-bottom: 8px;
}

.tool-caches-info__card-name {
    font-size: 0.875rem;
    font-weight: 700;
}

.tool-caches-info__path {
    display: block;
    margin-bottom: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(var(--v-theme-on-surface), 0.06);
    color: rgba(var(--v-theme-on-surface), 0.78);
    font-family: var(--dn-mono);
    font-size: 0.72rem;
    line-height: 1.4;
    word-break: break-all;
    white-space: pre-wrap;
}

.tool-caches-info__desc {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: rgba(var(--v-theme-on-surface), 0.65);
}

.tool-caches-info__parts {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--dn-border);
}

.tool-caches-info__part {
    margin-top: 10px;
}

.tool-caches-info__part-name {
    font-size: 0.8125rem;
    font-weight: 600;
    margin-bottom: 4px;
}

.tool-caches-info__path--nested {
    font-size: 0.68rem;
}

@media (max-width: 700px) {
    .tool-caches-info__layout {
        grid-template-columns: 1fr;
        max-height: none;
    }

    .tool-caches-info__cats {
        flex-direction: row;
        flex-wrap: wrap;
        border-right: none;
        border-bottom: 1px solid var(--dn-border);
        padding-bottom: 8px;
        margin-bottom: 4px;
    }

    .tool-caches-info__cat {
        width: auto;
    }

    .tool-caches-info__list {
        max-height: 50vh;
    }
}
</style>
