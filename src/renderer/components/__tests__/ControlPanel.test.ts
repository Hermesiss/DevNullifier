import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ControlPanel from '../ControlPanel.vue';

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VRow: {
    name: 'v-row',
    template: '<div class="v-row"><slot /></div>'
  },
  VCol: {
    name: 'v-col',
    template: '<div class="v-col"><slot /></div>',
    props: ['cols']
  },
  VCard: {
    name: 'v-card',
    template: '<div class="v-card"><slot /></div>'
  },
  VCardText: {
    name: 'v-card-text',
    template: '<div class="v-card-text"><slot /></div>'
  },
  VBtn: {
    name: 'v-btn',
    template: '<button class="v-btn" :class="[color, variant]" :disabled="disabled"><slot /></button>',
    props: ['color', 'variant', 'disabled', 'loading']
  },
  VIcon: {
    name: 'v-icon',
    template: '<i class="v-icon"><slot /></i>'
  },
  VChip: {
    name: 'v-chip',
    template: '<div class="v-chip"><slot /></div>'
  },
  VSlider: {
    name: 'v-slider',
    template: '<input type="range" class="v-slider" :value="modelValue" :min="min" :max="max" :step="step" :disabled="disabled" @input="$emit(\'update:modelValue\', +$event.target.value)" />',
    props: ['modelValue', 'min', 'max', 'step', 'disabled']
  },
  VSpacer: {
    name: 'v-spacer',
    template: '<div class="v-spacer" />'
  },
  VProgressCircular: {
    name: 'v-progress-circular',
    template: '<div class="v-progress-circular" :class="{ indeterminate }" />',
    props: ['indeterminate']
  }
});

describe('ControlPanel', () => {
  it('renders scan button correctly when not scanning', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 0
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const scanButton = wrapper.find('.v-btn');
    expect(scanButton.text()).toContain('Scan');
    expect(scanButton.find('.v-icon').text()).toContain('mdi-magnify');
    expect(scanButton.classes()).toContain('primary');
  });

  it('renders scan button correctly when scanning', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: true,
        isDeleting: false,
        foldersLength: 0
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const scanButton = wrapper.find('.v-btn');
    expect(scanButton.text()).toContain('Stop');
    expect(scanButton.find('.v-icon').text()).toContain('mdi-stop');
    expect(scanButton.classes()).toContain('error');
  });

  it('emits scan event when scan button is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 0
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    await wrapper.find('.v-btn').trigger('click');
    expect(wrapper.emitted('scan')).toBeTruthy();
  });

  it('emits stop-scan event when stop button is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: true,
        isDeleting: false,
        foldersLength: 0
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    await wrapper.find('.v-btn').trigger('click');
    expect(wrapper.emitted('stop-scan')).toBeTruthy();
  });

  it('disables buttons when deleting', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: true,
        foldersLength: 5
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const buttons = wrapper.findAll('.v-btn');
    buttons.forEach(button => {
      expect(button.attributes('disabled')).toBeDefined();
    });
  });

  it('shows correct depth label', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 0,
        maxDepth: 5
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.v-chip').text()).toContain('Depth: 5');
  });

  it('shows infinity symbol when depth is 0', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 0,
        maxDepth: 0
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.v-chip').text()).toContain('Depth: ∞');
  });

  it('emits update:maxDepth when slider value changes', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 0,
        maxDepth: 5
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const slider = wrapper.find('.v-slider');
    await slider.setValue(7);
    
    expect(wrapper.emitted('update:maxDepth')?.[0]).toEqual([7]);
  });

  it('shows progress circular when scanning', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: true,
        isDeleting: false,
        foldersLength: 0
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.v-progress-circular').exists()).toBe(true);
  });

  it('emits select-all when select all button is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 5
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const selectAllButton = wrapper.findAll('.v-btn').find(btn => btn.text() === 'Select All');
    await selectAllButton?.trigger('click');
    expect(wrapper.emitted('select-all')).toBeTruthy();
  });

  it('emits deselect-all when deselect all button is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        foldersLength: 5
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const deselectAllButton = wrapper.findAll('.v-btn').find(btn => btn.text() === 'Deselect All');
    await deselectAllButton?.trigger('click');
    expect(wrapper.emitted('deselect-all')).toBeTruthy();
  });
}); 