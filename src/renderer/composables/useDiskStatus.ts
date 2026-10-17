import { computed, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { formatSize } from "../utils/formatters";
import { diskUsage } from "../utils/diskShare";

export interface DiskStatus {
  usedBytes: number;
  otherUsedBytes: number;
  foundBytes: number;
  freeBytes: number;
  selectedBytes: number;
  foundOfUsedPercent: number;
  selectedOfFoundPercent: number;
  selectedOfUsedPercent: number;
  usedText: string;
  foundText: string;
  freeText: string;
  selectedText: string;
  percent: string;
}

export function useDiskStatus(
  scanRoot: MaybeRefOrGetter<string | null | undefined>,
  selectedBytes: MaybeRefOrGetter<number>,
  foundBytes: MaybeRefOrGetter<number>
) {
  const freeBytes = ref<number | null>(null);
  const totalBytes = ref<number | null>(null);

  async function refreshFreeBytes(): Promise<void> {
    const path = toValue(scanRoot);
    if (!path) {
      freeBytes.value = null;
      totalBytes.value = null;
      return;
    }
    try {
      const result = await window.electronAPI.diskFree(path);
      freeBytes.value = result?.free ?? null;
      totalBytes.value = result?.total ?? null;
    } catch {
      freeBytes.value = null;
      totalBytes.value = null;
    }
  }

  watch(() => toValue(scanRoot), () => void refreshFreeBytes(), { immediate: true });

  const diskStatus = computed<DiskStatus | null>(() => {
    const free = freeBytes.value;
    const total = totalBytes.value;
    if (free === null || total === null) return null;
    const usage = diskUsage(toValue(selectedBytes), toValue(foundBytes), free, total);
    if (!usage) return null;
    const percent = String(Math.round(usage.selectedOfUsedPercent * 10) / 10);
    return {
      ...usage,
      usedText: formatSize(usage.usedBytes),
      foundText: formatSize(usage.foundBytes),
      freeText: formatSize(usage.freeBytes),
      selectedText: formatSize(usage.selectedBytes),
      percent
    };
  });

  return { diskStatus };
}
