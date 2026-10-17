<template>
  <v-dialog v-model="open" max-width="640">
    <v-card>
      <v-card-title class="text-h5">
        <v-icon left>mdi-shield</v-icon>
        {{ t("common.protected_paths") }}
      </v-card-title>

      <v-card-text>
        <p class="mb-4">{{ t("common.protected_paths_hint") }}</p>

        <v-list v-if="paths.length" density="compact">
          <v-list-item v-for="item in paths" :key="item">
            <v-list-item-title class="protected-path">{{ item }}</v-list-item-title>
            <template v-slot:append>
              <v-btn
                icon
                variant="text"
                :aria-label="t('common.remove_protected_path')"
                @click="removePath(item)"
              >
                <v-icon>mdi-close</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ t("common.remove_protected_path") }}
                </v-tooltip>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
        <p v-else class="text-medium-emphasis">{{ t("common.no_protected_paths") }}</p>

        <v-divider class="my-6" />

        <div class="text-h6 mb-2">{{ t("common.exclude_globs") }}</div>
        <p class="mb-4">{{ t("common.exclude_globs_hint") }}</p>

        <div class="exclude-row mb-2">
          <v-text-field
            v-model="globDraft"
            class="exclude-input"
            density="compact"
            variant="outlined"
            hide-details
            autocomplete="off"
            :label="t('common.exclude_globs')"
            :placeholder="t('common.exclude_glob_placeholder')"
            :aria-label="t('common.exclude_globs')"
            @keydown.enter.prevent="addGlob"
          />
          <v-btn color="primary" variant="text" prepend-icon="mdi-plus" @click="addGlob">
            {{ t("common.add_exclude_glob") }}
          </v-btn>
        </div>

        <v-list v-if="globs.length" density="compact">
          <v-list-item v-for="item in globs" :key="item">
            <v-list-item-title class="protected-path">{{ item }}</v-list-item-title>
            <template v-slot:append>
              <v-btn
                icon
                variant="text"
                :aria-label="t('common.remove_exclude_glob')"
                @click="removeGlob(item)"
              >
                <v-icon>mdi-close</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ t("common.remove_exclude_glob") }}
                </v-tooltip>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>

        <v-divider class="my-6" />
        <p class="mb-4">{{ t("common.threshold_hint") }}</p>
        <v-text-field
          v-model="ageDraft"
          class="mb-4"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          :label="t('common.min_age_days')"
          @blur="saveThresholds"
          @keydown.enter.prevent="saveThresholds"
        />
        <v-text-field
          v-model="sizeDraft"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          :label="t('common.min_size_mb')"
          @blur="saveThresholds"
          @keydown.enter.prevent="saveThresholds"
        />
      </v-card-text>

      <v-card-actions>
        <v-btn color="primary" variant="text" prepend-icon="mdi-folder-plus" @click="addPath">
          {{ t("common.add_protected_path") }}
        </v-btn>
        <v-spacer />
        <v-btn @click="open = false">{{ t("common.close") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  enqueueCleanerRulesSave,
  minAgeDays,
  minSizeMb,
  setLocalThresholds
} from "../composables/useCleanerRules";

const { t } = useI18n();
const open = defineModel<boolean>({ default: false });
const paths = ref<string[]>([]);
const globs = ref<string[]>([]);
const globDraft = ref("");
const ageDraft = ref<string | number>("");
const sizeDraft = ref<string | number>("");
let hydratingThresholds = false;

function isDriveRootPath(value: string): boolean {
  const trimmed = value.trim().replace(/[\\/]+$/, "");
  return trimmed === "" || /^[a-zA-Z]:$/.test(trimmed);
}

watch(open, async isOpen => {
  if (!isOpen || !window.electronAPI?.getCleanerRules) return;
  try {
    const rules = await window.electronAPI.getCleanerRules();
    paths.value = [...rules.protectedPaths];
    globs.value = normalizeGlobs(rules.excludeGlobs ?? []);
    globDraft.value = "";
    hydratingThresholds = true;
    ageDraft.value = formatThreshold(rules.minAgeDays);
    sizeDraft.value = formatThreshold(rules.minSizeMb);
    hydratingThresholds = false;
    const age = rules.minAgeDays ?? null;
    const size = rules.minSizeMb ?? null;
    if (age !== minAgeDays.value || size !== minSizeMb.value) {
      setLocalThresholds(age, size);
    }
  } catch (error) {
    console.error("Failed to load protected paths:", error);
  }
});

async function persist(next: string[]): Promise<void> {
  paths.value = next;
  const saved = await enqueueCleanerRulesSave({ protectedPaths: next });
  if (saved) paths.value = [...saved.protectedPaths];
}

async function addPath(): Promise<void> {
  if (!window.electronAPI?.selectDirectory) return;
  const selected = await window.electronAPI.selectDirectory();
  if (!selected || isDriveRootPath(selected)) return;
  if (paths.value.includes(selected)) return;
  await persist([...paths.value, selected]);
}

async function removePath(target: string): Promise<void> {
  await persist(paths.value.filter(item => item !== target));
}

function normalizeGlobs(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

async function persistGlobs(next: string[]): Promise<void> {
  const cleaned = normalizeGlobs(next);
  globs.value = cleaned;
  const saved = await enqueueCleanerRulesSave({ excludeGlobs: cleaned });
  if (saved) globs.value = normalizeGlobs(saved.excludeGlobs);
}

async function addGlob(): Promise<void> {
  const trimmed = globDraft.value.trim();
  globDraft.value = "";
  if (!trimmed || globs.value.includes(trimmed)) return;
  await persistGlobs([...globs.value, trimmed]);
}

async function removeGlob(target: string): Promise<void> {
  await persistGlobs(globs.value.filter(item => item !== target));
}

function formatThreshold(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(value);
}

function parseThreshold(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

async function saveThresholds(): Promise<void> {
  if (hydratingThresholds) return;
  const age = parseThreshold(ageDraft.value);
  const size = parseThreshold(sizeDraft.value);
  ageDraft.value = formatThreshold(age);
  sizeDraft.value = formatThreshold(size);
  if (age === minAgeDays.value && size === minSizeMb.value) return;
  setLocalThresholds(age, size);
  await enqueueCleanerRulesSave({ minAgeDays: age, minSizeMb: size });
}
</script>

<style scoped>
.protected-path {
  white-space: normal;
  word-break: break-all;
}

.exclude-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.exclude-input {
  flex: 1;
}
</style>
