<template>
  <v-dialog v-model="open" max-width="760">
    <v-card>
      <v-card-title>
        {{ t("common.custom_keywords") }} / {{ t("common.custom_categories") }}
      </v-card-title>

      <v-card-text>
        <div class="text-h6 mb-2">{{ t("common.custom_keywords") }}</div>
        <div class="rule-row mb-2">
          <v-text-field
            v-model="keywordDraft"
            class="rule-input"
            density="compact"
            variant="outlined"
            hide-details
            autocomplete="off"
            :label="t('common.custom_keywords')"
            :disabled="saving"
            @keydown.enter.prevent="addKeyword"
          />
          <v-btn color="primary" variant="text" prepend-icon="mdi-plus" :disabled="!canAddKeyword || saving" @click="addKeyword">
            {{ t("common.add") }}
          </v-btn>
        </div>

        <v-list v-if="keywords.length" density="compact">
          <v-list-item v-for="keyword in keywords" :key="keyword">
            <v-list-item-title>{{ keyword }}</v-list-item-title>
            <template #append>
              <v-btn
                icon
                variant="text"
                :aria-label="t('common.delete')"
                :disabled="saving"
                @click="removeKeyword(keyword)"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>

        <v-divider class="my-6" />

        <div class="text-h6 mb-2">{{ t("common.custom_categories") }}</div>
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="nameDraft"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              :label="t('common.custom_category_name')"
              :disabled="saving"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="detectionDraft"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              :label="t('common.detection_files')"
              placeholder="package.json, Cargo.toml"
              :disabled="saving"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="patternDraft"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              :label="t('common.cache_patterns')"
              placeholder=".cache/, dist/"
              :disabled="saving"
              @keydown.enter.prevent="addCategory"
            />
          </v-col>
        </v-row>
        <v-btn
          class="mt-2"
          color="primary"
          variant="text"
          prepend-icon="mdi-plus"
          :disabled="!canAddCategory || saving"
          @click="addCategory"
        >
          {{ t("common.add") }}
        </v-btn>

        <v-list v-if="categories.length" density="compact" class="mt-2">
          <v-list-item v-for="category in categories" :key="category.id">
            <v-list-item-title>{{ category.name }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ category.detectionFiles.join(", ") }} — {{ category.cachePatterns.join(", ") }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                icon
                variant="text"
                :aria-label="t('common.delete')"
                :disabled="saving"
                @click="removeCategory(category.id)"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="open = false">{{ t("common.close") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { CustomCategory, CustomCategoryDraft, CustomScanRules, CustomScanRulesUpdate } from "../../../main/customScanRules";

const { t } = useI18n();
const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  saved: [rules: CustomScanRules];
}>();

const keywords = ref<string[]>([]);
const categories = ref<CustomCategory[]>([]);
const keywordDraft = ref("");
const nameDraft = ref("");
const detectionDraft = ref("");
const patternDraft = ref("");
const saving = ref(false);

const canAddKeyword = computed(() => keywordDraft.value.trim().length > 0);
const canAddCategory = computed(
  () =>
    nameDraft.value.trim().length > 0 &&
    splitList(detectionDraft.value).length > 0 &&
    splitList(patternDraft.value).length > 0
);

function splitList(value: string): string[] {
  return value
    .split(",")
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

function toDraft(category: CustomCategory): CustomCategoryDraft {
  return {
    name: category.name,
    detectionFiles: [...category.detectionFiles],
    cachePatterns: [...category.cachePatterns]
  };
}

function clearDrafts(): void {
  keywordDraft.value = "";
  nameDraft.value = "";
  detectionDraft.value = "";
  patternDraft.value = "";
}

watch(open, async isOpen => {
  if (!isOpen || !window.electronAPI?.getCustomScanRules) return;
  try {
    const rules = await window.electronAPI.getCustomScanRules();
    keywords.value = [...rules.keywords];
    categories.value = rules.categories.map(category => ({
      ...category,
      detectionFiles: [...category.detectionFiles],
      cachePatterns: [...category.cachePatterns]
    }));
    clearDrafts();
  } catch (error) {
    console.error("Failed to load custom scan rules:", error);
  }
});

async function persist(partial: CustomScanRulesUpdate): Promise<CustomScanRules | null> {
  if (!window.electronAPI?.setCustomScanRules) return null;
  saving.value = true;
  try {
    const saved = await window.electronAPI.setCustomScanRules(partial);
    keywords.value = [...saved.keywords];
    categories.value = saved.categories.map(category => ({
      ...category,
      detectionFiles: [...category.detectionFiles],
      cachePatterns: [...category.cachePatterns]
    }));
    emit("saved", saved);
    return saved;
  } catch (error) {
    console.error("Failed to save custom scan rules:", error);
    return null;
  } finally {
    saving.value = false;
  }
}

async function addKeyword(): Promise<void> {
  const draft = keywordDraft.value.trim();
  if (!draft || saving.value) return;
  const saved = await persist({ keywords: [...keywords.value, draft] });
  if (saved?.keywords.some(keyword => keyword.toLowerCase() === draft.toLowerCase())) {
    keywordDraft.value = "";
  }
}

async function removeKeyword(keyword: string): Promise<void> {
  if (saving.value) return;
  await persist({ keywords: keywords.value.filter(item => item !== keyword) });
}

async function addCategory(): Promise<void> {
  const name = nameDraft.value.trim();
  const detectionFiles = splitList(detectionDraft.value);
  const cachePatterns = splitList(patternDraft.value);
  if (!name || detectionFiles.length === 0 || cachePatterns.length === 0 || saving.value) return;
  const before = new Set(categories.value.map(category => category.id));
  const saved = await persist({
    categories: [...categories.value.map(toDraft), { name, detectionFiles, cachePatterns }]
  });
  if (saved?.categories.some(category => !before.has(category.id))) {
    nameDraft.value = "";
    detectionDraft.value = "";
    patternDraft.value = "";
  }
}

async function removeCategory(id: string): Promise<void> {
  if (saving.value) return;
  await persist({
    categories: categories.value.filter(category => category.id !== id).map(toDraft)
  });
}
</script>

<style scoped>
.rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-input {
  flex: 1 1 auto;
}
</style>
