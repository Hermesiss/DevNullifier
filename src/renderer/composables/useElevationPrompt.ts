import { onMounted, onUnmounted, ref } from "vue";

export const accessDeniedOutsideProfile = ref(false);

let listeners = 0;

function markAccessDenied(): void {
  accessDeniedOutsideProfile.value = true;
}

export function useElevationPrompt() {
  onMounted(() => {
    if (!window.electronAPI?.onScanAccessDenied) return;
    if (listeners === 0) {
      window.electronAPI.onScanAccessDenied(markAccessDenied);
    }
    listeners += 1;
  });

  onUnmounted(() => {
    listeners = Math.max(0, listeners - 1);
    if (listeners === 0) {
      window.electronAPI?.removeAllListeners?.("scan-access-denied");
    }
  });

  return { accessDeniedOutsideProfile };
}
