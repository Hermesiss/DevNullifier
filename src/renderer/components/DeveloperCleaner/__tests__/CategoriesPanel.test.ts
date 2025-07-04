import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import CategoriesPanel from '../CategoriesPanel.vue';
import type { DeveloperCategory } from '@/types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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
    template: '<div class="v-card"><slot /></div>',
    props: ['variant']
  },
  VCardTitle: {
    name: 'v-card-title',
    template: '<div class="v-card-title"><slot /></div>'
  },
  VCardText: {
    name: 'v-card-text',
    template: '<div class="v-card-text"><slot /></div>'
  },
  VIcon: {
    name: 'v-icon',
    template: '<i class="v-icon"><slot /></i>'
  },
  VChip: {
    name: 'v-chip',
    template: '<div class="v-chip" :class="color"><slot /></div>',
    props: ['size', 'color']
  },
  VSpacer: {
    name: 'v-spacer',
    template: '<div class="v-spacer" />'
  },
  VBtn: {
    name: 'v-btn',
    template: '<button class="v-btn" :class="variant" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['variant', 'size']
  },
  VCheckbox: {
    name: 'v-checkbox',
    template: '<input type="checkbox" class="v-checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'color', 'density']
  },
  VExpandTransition: {
    name: 'v-expand-transition',
    template: '<div class="v-expand-transition"><slot /></div>'
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

describe('CategoriesPanel', () => {
  const mockCategories: DeveloperCategory[] = [
    {
      id: 'nodejs',
      name: 'Node.js / JS / TS',
      enabled: true,
      detectionFiles: ['package.json', 'yarn.lock'],
      cachePatterns: ['node_modules/', 'dist/'],
      warning: true,
      warningText: 'Warning text'
    },
    {
      id: 'python',
      name: 'Python',
      enabled: false,
      detectionFiles: ['requirements.txt', 'setup.py'],
      cachePatterns: ['__pycache__/', '.venv/'],
      warning: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('renders correctly with initial categories', () => {
    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    expect(wrapper.text()).toContain('Development Categories');
    expect(wrapper.text()).toContain('1/2 enabled');
    expect(wrapper.findAll('.v-card').length).toBe(3); // Main card + 2 category cards
  });

  it('emits categories-changed when category is toggled', async () => {
    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const checkbox = wrapper.findAll('.v-checkbox')[1]; // Python category checkbox
    await checkbox.setValue(true);

    expect(wrapper.emitted('categories-changed')?.[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'python', enabled: true })
      ])
    );
  });

  it('enables all categories when Enable All is clicked', async () => {
    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const enableAllButton = wrapper.findAll('.v-btn').find(btn => btn.text().includes('Enable All'));
    await enableAllButton?.trigger('click');

    const emittedCategories = wrapper.emitted('categories-changed')?.[0][0] as DeveloperCategory[];
    expect(emittedCategories.every(cat => cat.enabled)).toBe(true);
  });

  it('disables all categories when Disable All is clicked', async () => {
    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const disableAllButton = wrapper.findAll('.v-btn').find(btn => btn.text().includes('Disable All'));
    await disableAllButton?.trigger('click');

    const emittedCategories = wrapper.emitted('categories-changed')?.[0][0] as DeveloperCategory[];
    expect(emittedCategories.every(cat => !cat.enabled)).toBe(true);
  });

  it('emits category-info when info button is clicked', async () => {
    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Find the first category's info button
    const categoryCard = wrapper.findAll('.v-card')[1]; // First category card
    const infoButton = categoryCard.find('.v-btn');
    await infoButton?.trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick(); // Wait for another tick for event emission

    const emittedEvent = wrapper.emitted('category-info')?.[0][0] as DeveloperCategory;
    expect(emittedEvent).toBeDefined();
    expect(emittedEvent.id).toBe('nodejs');
  });

  it('loads category states from localStorage on mount', async () => {
    const savedStates = {
      nodejs: false,
      python: true
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedStates));

    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    await wrapper.vm.$nextTick();
    const emittedCategories = wrapper.emitted('categories-changed')?.[0][0] as DeveloperCategory[];
    expect(emittedCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'nodejs', enabled: false }),
        expect.objectContaining({ id: 'python', enabled: true })
      ])
    );
  });

  it('saves category states to localStorage when changed', async () => {
    const wrapper = mount(CategoriesPanel, {
      props: {
        initialCategories: mockCategories
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Wait for component to mount and initialize
    await wrapper.vm.$nextTick();

    // Get the component instance
    const vm = wrapper.vm as any;
    
    // Toggle both categories to ensure a known state
    vm.categories[0].enabled = false;  // nodejs: true -> false
    vm.categories[1].enabled = true;   // python: false -> true
    
    // Call the save method directly
    vm.saveCategoryStates();
    await wrapper.vm.$nextTick();

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'developer-cleaner-categories',
      JSON.stringify({
        nodejs: false,
        python: true
      })
    );
  });
}); 