<!-- UpdateButton.vue -->
<template>
    <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props" :loading="checking" :color="updateAvailable ? 'warning' : undefined">
                <v-icon>{{ updateAvailable ? 'mdi-download-circle' : 'mdi-update' }}</v-icon>
            </v-btn>
        </template>

        <v-card min-width="300" class="pa-4">
            <v-card-title class="text-h6">
                {{ t('update.title') }}
            </v-card-title>

            <v-card-text>
                <div class="mb-4">
                    <v-switch v-model="useBetaChannel" :label="t('update.beta')" color="warning" hide-details
                        @change="handleBetaChannelChange" />
                </div>

                <div v-if="checking" class="d-flex align-center">
                    <v-progress-circular indeterminate size="24" class="mr-2" />
                    {{ t('update.checking') }}
                </div>

                <div v-else-if="error" class="text-error">
                    {{ error }}
                </div>

                <div v-else-if="updateAvailable" class="text-body-1">
                    <p>{{ t('update.available') }}</p>
                    <p class="text-caption" v-if="updateInfo">
                        {{ t('update.version', { version: updateInfo.version }) }}
                        <br>
                        {{ t('update.size', { size: formatBytes(updateInfo.files?.[0]?.size || 0) }) }}
                    </p>
                    <div v-if="downloadProgress" class="mt-2">
                        <v-progress-linear :model-value="downloadProgress.percent" color="primary" height="20">
                            <template v-slot:default="{ value }">
                                <span class="white--text">{{ Math.ceil(value) }}%</span>
                            </template>
                        </v-progress-linear>
                        <div class="text-caption mt-1">
                            {{ t('update.transferred', { done: formatBytes(downloadProgress.transferred), total: formatBytes(downloadProgress.total) }) }}
                            <br>
                            {{ t('update.speed', { speed: formatBytes(downloadProgress.bytesPerSecond) }) }}
                        </div>
                    </div>
                </div>

                <div v-else class="text-body-1">
                    {{ t('update.up_to_date') }}
                </div>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn v-if="!checking && !error" :color="updateAvailable ? 'warning' : 'primary'" :loading="checking"
                    @click="updateAvailable ? installUpdate() : checkForUpdates()">
                    {{ updateAvailable ? t('update.install') : t('update.check') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-menu>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const checking = ref(false);
const error = ref<string | null>(null);
const updateAvailable = ref(false);
const updateInfo = ref<any>(null);
const downloadProgress = ref<any>(null);
const useBetaChannel = ref(localStorage.getItem('useBetaChannel') === 'true');

// Format bytes to human readable format
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Check for updates
async function checkForUpdates() {
    checking.value = true;
    error.value = null;
    try {
        await window.electronAPI.checkForUpdates();
    } catch (err) {
        error.value = err instanceof Error ? err.message : t('update.failed_check');
    } finally {
        checking.value = false;
    }
}

// Install update
async function installUpdate() {
    try {
        await window.electronAPI.quitAndInstall();
    } catch (err) {
        error.value = err instanceof Error ? err.message : t('update.failed_install');
    }
}

// Handle update status events
function handleUpdateStatus(status: { message: string; data?: any }) {
    switch (status.message) {
        case 'Update available.':
            updateAvailable.value = true;
            updateInfo.value = status.data;
            break;
        case 'Update not available.':
            updateAvailable.value = false;
            updateInfo.value = null;
            break;
        case 'Download progress':
            downloadProgress.value = status.data;
            break;
        case 'Error in auto-updater.':
            error.value = status.data?.message || t('update.error');
            break;
        case 'Update downloaded':
            // The update is ready to install
            break;
    }
}

async function handleBetaChannelChange() {
    localStorage.setItem('useBetaChannel', useBetaChannel.value.toString());
    await window.electronAPI.setUpdateChannel(useBetaChannel.value ? 'latest-dev' : 'latest');
    checkForUpdates();
}

onMounted(async () => {
    window.electronAPI.onUpdateStatus(handleUpdateStatus);
    // Set initial update channel
    await window.electronAPI.setUpdateChannel(useBetaChannel.value ? 'latest-dev' : 'latest');
});

onUnmounted(() => {
    window.electronAPI.removeAllListeners('update-status');
});
</script>