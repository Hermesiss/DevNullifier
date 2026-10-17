import { onMounted, ref, watch } from "vue";
import type { CleanerRules } from "../../main/cleanerRules";

const permanentDelete = ref(false);
export const minAgeDays = ref<number | null>(null);
export const minSizeMb = ref<number | null>(null);
let applyingRemote = false;
let localChange = false;
let thresholdsLocal = false;
let persist: Promise<unknown> = Promise.resolve();

export function cleanerThresholdsActive(age: number | null, size: number | null): boolean {
  const active = (value: number | null) =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  return active(age) || active(size);
}

export function setLocalThresholds(age: number | null, size: number | null): void {
  thresholdsLocal = true;
  minAgeDays.value = age;
  minSizeMb.value = size;
}

export function enqueueCleanerRulesSave(
  partial: Partial<CleanerRules>
): Promise<CleanerRules | undefined> {
  let saved: CleanerRules | undefined;
  persist = persist.catch(() => undefined).then(async () => {
    if (!window.electronAPI?.setCleanerRules) return;
    saved = await window.electronAPI.setCleanerRules(partial);
  });
  return persist.then(() => saved);
}

watch(
  permanentDelete,
  value => {
    if (applyingRemote) return;
    localChange = true;
    void enqueueCleanerRulesSave({ permanentDelete: value });
  },
  { flush: "sync" }
);

export function useCleanerRules() {
  onMounted(async () => {
    if (!window.electronAPI?.getCleanerRules) return;

    try {
      const rules = await window.electronAPI.getCleanerRules();
      applyingRemote = true;
      if (!localChange) permanentDelete.value = rules.permanentDelete;
      if (!thresholdsLocal) {
        minAgeDays.value = rules.minAgeDays ?? null;
        minSizeMb.value = rules.minSizeMb ?? null;
      }
    } catch (error) {
      console.error("Failed to load cleaner rules:", error);
    } finally {
      applyingRemote = false;
    }
  });

  async function whenRulesSaved(): Promise<void> {
    await persist;
  }

  return { permanentDelete, minAgeDays, minSizeMb, whenRulesSaved };
}
