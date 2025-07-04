import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ActionsBar from "../ActionsBar.vue";

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VCard: {
    name: "v-card",
    template: '<div class="v-card"><slot /></div>',
    props: ["flat"]
  },
  VCardText: {
    name: "v-card-text",
    template: '<div class="v-card-text"><slot /></div>'
  },
  VRow: {
    name: "v-row",
    template: '<div class="v-row"><slot /></div>',
    props: ["align", "no-gutters"]
  },
  VCol: {
    name: "v-col",
    template: '<div class="v-col"><slot /></div>',
    props: ["cols"]
  },
  VChip: {
    name: "v-chip",
    template: '<div class="v-chip" :class="color"><slot /></div>',
    props: ["color", "variant"]
  },
  VSpacer: {
    name: "v-spacer",
    template: '<div class="v-spacer" />'
  },
  VProgressLinear: {
    name: "v-progress-linear",
    template:
      '<div class="v-progress-linear" :style="{ width: \'200px\' }"><slot /></div>',
    props: ["modelValue", "color", "height", "rounded"]
  },
  VBtn: {
    name: "v-btn",
    template:
      '<button class="v-btn" :class="color" :disabled="disabled"><slot /></button>',
    props: ["color", "disabled", "loading"]
  },
  VIcon: {
    name: "v-icon",
    template: '<i class="v-icon"><slot /></i>'
  }
});

describe("ActionsBar", () => {
  it("renders correctly with default props", () => {
    const wrapper = mount(ActionsBar, {
      props: {
        statusText: "Ready",
        deleteProgress: 0,
        selectedCount: 0,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find(".v-chip").text()).toBe("Ready");
    expect(wrapper.find(".v-btn").text()).toContain("Delete Selected (0)");
  });

  it("shows progress bar when deleting", () => {
    const wrapper = mount(ActionsBar, {
      props: {
        statusText: "Deleting...",
        deleteProgress: 50,
        selectedCount: 5,
        isScanning: false,
        isDeleting: true
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find(".v-progress-linear").exists()).toBe(true);
  });

  it("disables delete button when scanning", () => {
    const wrapper = mount(ActionsBar, {
      props: {
        statusText: "Scanning...",
        deleteProgress: 0,
        selectedCount: 5,
        isScanning: true,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find(".v-btn").attributes("disabled")).toBeDefined();
  });

  it("disables delete button when no items selected", () => {
    const wrapper = mount(ActionsBar, {
      props: {
        statusText: "Ready",
        deleteProgress: 0,
        selectedCount: 0,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find(".v-btn").attributes("disabled")).toBeDefined();
  });

  it("emits delete event when delete button is clicked", async () => {
    const wrapper = mount(ActionsBar, {
      props: {
        statusText: "Ready",
        deleteProgress: 0,
        selectedCount: 5,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    await wrapper.find(".v-btn").trigger("click");
    expect(wrapper.emitted("delete")).toBeTruthy();
  });
});
