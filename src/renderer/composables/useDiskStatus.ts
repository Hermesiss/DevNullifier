import { computed, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useI18n } from "vue-i18n";
import { formatSize } from "../utils/formatters";
import { selectedSharePercent } from "../utils/diskShare";

export function useDiskStatus(
  scanRoot: MaybeRefOrGetter<string | null | undefined>,
  selectedBytes: MaybeRefOrGetter<number>
) {
  const { t } = useI18n();
  const freeBytes = ref<number | null>(null);

  async function refreshFreeBytes(): Promise<void> {
    const path = toValue(scanRoot);
    if (!path) {
      freeBytes.value = null;
      return;
    }
    try {
      const result = await window.electronAPI.diskFree(path);
      freeBytes.value = result?.free ?? null;
    } catch {
      freeBytes.value = null;
    }
  }

  watch(() => toValue(scanRoot), () => void refreshFreeBytes(), { immediate: true });

  const diskStatusText = computed(() => {
    const free = freeBytes.value;
    if (free === null || !Number.isFinite(free) || free <= 0) {
      return null;
    }
    const selected = toValue(selectedBytes);
    const share = selectedSharePercent(selected, free);
    const percent = share === null ? "0" : String(Math.round(share * 10) / 10);
    return t("common.disk_status", {
      free: formatSize(free),
      selected: formatSize(selected),
      percent
    });
  });

  return { diskStatusText };
}
