<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card>
      <v-card-title class="text-h5">
        <v-icon left>mdi-information-outline</v-icon>
        {{ t("about.title") }}
      </v-card-title>

      <v-card-text>
        <div class="d-flex align-center mb-3">
          <img :src="appIcon" alt="" class="mr-3" width="48" height="48" />
          <div>
            <div class="text-h6">DevNullifier</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ t("update.version", { version }) }}
            </div>
          </div>
        </div>

        <p class="mb-2">{{ t("about.description") }}</p>
        <div class="d-flex align-center">
          <span>{{ t("about.license") }}</span>
          <v-btn class="ml-2" variant="text" color="info" @click="openRepo">
            {{ t("about.source") }}
          </v-btn>
        </div>

        <v-divider class="my-4" />

        <p v-if="releases.length === 0" class="text-medium-emphasis mb-0">
          {{ t("about.changelog_empty") }}
        </p>
        <v-expansion-panels v-else v-model="opened">
          <v-expansion-panel v-for="release in releases" :key="release.version">
            <v-expansion-panel-title>
              {{ releaseTitle(release) }}
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <section v-for="section in release.sections" :key="section.title" class="mb-3">
                <div class="text-subtitle-2">{{ section.title }}</div>
                <ul class="about-notes">
                  <li
                    v-for="(item, index) in section.items"
                    :key="index"
                    :style="{ marginLeft: `${item.depth * 16}px` }"
                  >
                    {{ item.text }}
                  </li>
                </ul>
              </section>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t("common.close") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import pkg from "../../../package.json";
import changelogEn from "../../../CHANGELOG.md?raw";
import changelogRu from "../../../CHANGELOG.ru.md?raw";
import appIcon from "../../assets/icon-48.png";
import { aboutRepositoryUrl } from "../../main/aboutLink";
import {
  expandedReleaseIndex,
  parseChangelog,
  releasesForLocale,
  type ChangelogRelease
} from "../utils/changelog";

const open = defineModel<boolean>({ required: true });
const { t, locale } = useI18n();
const version = pkg.version;
const opened = ref<number>();

const english = parseChangelog(changelogEn);
const russian = parseChangelog(changelogRu);
const releases = computed(() => releasesForLocale(english, russian, locale.value));

watch(
  releases,
  list => {
    const index = expandedReleaseIndex(list, version);
    opened.value = index >= 0 ? index : undefined;
  },
  { immediate: true }
);

function releaseTitle(release: ChangelogRelease): string {
  return release.label ? `${release.version} — ${release.label}` : release.version;
}

async function openRepo(): Promise<void> {
  try {
    await window.electronAPI.openAboutLink(aboutRepositoryUrl);
  } catch (error) {
    console.error("Failed to open repository:", error);
  }
}
</script>

<style scoped>
.about-notes {
  margin: 4px 0 0;
  padding-left: 1.2rem;
}
</style>
