import { onMounted, ref, watch } from "vue";

const permanentDelete = ref(false);
let applyingRemote = false;
let localChange = false;
let persist: Promise<void> = Promise.resolve();

watch(
  permanentDelete,
  value => {
    if (applyingRemote) return;
    localChange = true;
    if (!window.electronAPI?.setCleanerRules) return;

    persist = persist.catch(() => undefined).then(async () => {
      await window.electronAPI.setCleanerRules({ permanentDelete: value });
    });
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
