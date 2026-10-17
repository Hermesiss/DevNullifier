import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import ActionsBar from "../ActionsBar.vue";
import en from "../../locales/en.json";
import type { DiskStatus } from "../../composables/useDiskStatus";

const i18n = createI18n({ legacy: false, locale: "en", messages: { en } });

const disk: DiskStatus = {
  usedBytes: 800,
  otherUsedBytes: 600,
  foundBytes: 200,
  freeBytes: 200,
  selectedBytes: 80,
  foundOfUsedPercent: 25,
  selectedOfFoundPercent: 40,
  selectedOfUsedPercent: 10,
  usedText: "800 B",
  foundText: "200 B",
  freeText: "200 B",
  selectedText: "80 B",
  percent: "10"
};

describe("ActionsBar disk bar", () => {
  it("puts found on the right of used and selected inside found", () => {
    const wrapper = mount(ActionsBar, {
      props: {
        statusText: "Ready",
        diskStatus: disk,
        deleteProgress: 0,
        selectedCount: 1,
        isScanning: false,
        isDeleting: false
      },
      global: {
        plugins: [i18n],
        stubs: {
          "v-card": { template: "<div><slot /></div>" },
          "v-card-text": { template: "<div><slot /></div>" },
          "v-row": { template: "<div><slot /></div>" },
          "v-col": { template: "<div><slot /></div>" },
          "v-spacer": true,
          "v-chip": { template: "<span><slot /></span>" },
          "v-btn": { template: "<button><slot /></button>" },
          "v-icon": true,
          "v-progress-linear": true
        }
      }
    });

    expect(wrapper.get(".disk-used").attributes("style")).toContain("flex-grow: 600");
    expect(wrapper.get(".disk-found").attributes("style")).toContain("flex-grow: 200");
    expect(wrapper.get(".disk-selected").attributes("style")).toContain("width: 40%");
    expect(wrapper.get(".disk-free").attributes("style")).toContain("flex-grow: 200");
    expect(wrapper.text()).toContain("Found 200 B");
    expect(wrapper.text()).toContain("Will free 80 B (10% of used)");
  });
});
