import { onMounted, ref, watch } from "vue";
import type { CleanerRules } from "../../main/cleanerRules";

const permanentDelete = ref(false);
let applyingRemote = false;
let localChange = false;
let persist: Promise<unknown> = Promise.resolve();

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
      if (localChange) return;
      applyingRemote = true;
      permanentDelete.value = rules.permanentDelete;
    } catch (error) {
      console.error("Failed to load cleaner rules:", error);
    } finally {
      applyingRemote = false;
    }
  });

  async function whenRulesSaved(): Promise<void> {
    await persist;
  }

  return { permanentDelete, whenRulesSaved };
}
