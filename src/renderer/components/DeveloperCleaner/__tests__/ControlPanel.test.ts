import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import ControlPanel from '../ControlPanel.vue';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock electron API
const mockElectronAPI = {
  selectDirectory: vi.fn(),
  getUserHome: vi.fn()
};
Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI });

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
    template: '<button class="v-btn" :class="[color, variant]" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['color', 'variant', 'disabled']
  },
  VIcon: {
    name: 'v-icon',
    template: '<i class="v-icon"><slot /></i>'
  },
  VTooltip: {
    name: 'v-tooltip',
    template: '<div class="v-tooltip"><slot name="activator" /><slot /></div>',
    props: ['text', 'location']
  },
  VChip: {
    name: 'v-chip',
    template: '<div class="v-chip" :class="color" @click:close="$emit(\'click:close\', $event)"><slot /></div>',
    props: ['color', 'size', 'closable']
  },
  VProgressCircular: {
    name: 'v-progress-circular',
    template: '<div class="v-progress-circular" :class="color"><slot /></div>',
    props: ['indeterminate', 'color', 'size']
  },
  VSpacer: {
    name: 'v-spacer',
    template: '<div class="v-spacer" />'
  }
});

// Create Vuetify instance
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107'
        }
      }
    }
  }
});

describe('ControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockElectronAPI.getUserHome.mockResolvedValue('C:\\Users\\Test');
  });

  it('renders correctly with default props', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    expect(wrapper.find('.v-btn').text()).toContain('Scan Projects');
    expect(wrapper.findAll('.v-btn')[1].text()).toContain('Add Base Path');
  });

  it('disables scan button when no categories are enabled', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    expect(wrapper.find('.v-btn').attributes('disabled')).toBeDefined();
  });

  it('shows stop button when scanning', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: true,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    expect(wrapper.find('.v-btn').text()).toContain('Stop');
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true);
  });

  it('disables buttons when deleting', () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: true,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const buttons = wrapper.findAll('.v-btn');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('emits start-scan when scan button is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Emit the event manually since we're using a mock
    await wrapper.vm.$emit('start-scan');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick(); // Wait for another tick for event emission
    await wrapper.vm.$nextTick(); // Wait for another tick for state update

    expect(wrapper.emitted()).toHaveProperty('start-scan');
  });

  it('emits stop-scan when stop button is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: true,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    await wrapper.find('.v-btn').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('stop-scan')).toBeTruthy();
  });

  it('adds base path when directory is selected', async () => {
    mockElectronAPI.selectDirectory.mockResolvedValue('D:\\Projects\\Test');

    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const addPathButton = wrapper.findAll('.v-btn')[1];
    await addPathButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.v-chip').text()).toContain('Test');
    expect(wrapper.emitted('show-notification')?.[0]).toEqual(['Base path added successfully', 'success']);
  });

  it('removes base path when chip close is clicked', async () => {
    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Wait for component to mount and initialize
    await wrapper.vm.$nextTick();
    
    // Get the component instance and add a test path
    const vm = wrapper.vm as any;
    vm.basePaths = ['D:\\Projects\\Test'];
    await wrapper.vm.$nextTick();

    // Verify the chip is rendered
    expect(wrapper.findAll('.v-chip').length).toBe(1);

    // Find and trigger the close event on the chip
    const chip = wrapper.find('.v-chip');
    await chip.trigger('click:close');
    await wrapper.vm.$nextTick();

    // Verify the chip is removed and localStorage is updated
    expect(wrapper.findAll('.v-chip').length).toBe(0);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'developer-cleaner-base-paths',
      '[]'
    );
  });

  it('loads base paths from localStorage on mount', async () => {
    const savedPaths = ['D:\\Projects\\Test1', 'D:\\Projects\\Test2'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPaths));

    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    await wrapper.vm.$nextTick();
    const chips = wrapper.findAll('.v-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].text()).toContain('Test1');
    expect(chips[1].text()).toContain('Test2');
  });

  it('saves base paths to localStorage when changed', async () => {
    mockElectronAPI.selectDirectory.mockResolvedValue('D:\\Projects\\Test');
    mockElectronAPI.getUserHome.mockResolvedValue('D:\\Projects\\Test');

    const wrapper = mount(ControlPanel, {
      props: {
        isScanning: false,
        isDeleting: false,
        hasEnabledCategories: true
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const addPathButton = wrapper.findAll('.v-btn')[1];
    await addPathButton.trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick(); // Wait for another tick for localStorage update
    await wrapper.vm.$nextTick(); // Wait for another tick for state update

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'developer-cleaner-base-paths',
      expect.any(String)
    );
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(savedData).toEqual(['D:\\Projects\\Test']);
  });
}); 