import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryInfoDialog from '../CategoryInfoDialog.vue';
import type { DeveloperCategory } from '@/types';

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VDialog: {
    name: 'v-dialog',
    template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    props: ['modelValue']
  },
  VCard: {
    name: 'v-card',
    template: '<div class="v-card"><slot /></div>'
  },
  VCardTitle: {
    name: 'v-card-title',
    template: '<div class="v-card-title"><slot /></div>'
  },
  VCardText: {
    name: 'v-card-text',
    template: '<div class="v-card-text"><slot /></div>'
  },
  VCardActions: {
    name: 'v-card-actions',
    template: '<div class="v-card-actions"><slot /></div>'
  },
  VRow: {
    name: 'v-row',
    template: '<div class="v-row"><slot /></div>'
  },
  VCol: {
    name: 'v-col',
    template: '<div class="v-col"><slot /></div>',
    props: ['cols']
  },
  VChip: {
    name: 'v-chip',
    template: '<div class="v-chip" :class="[color, size]"><slot /></div>',
    props: ['size', 'color', 'variant']
  },
  VChipGroup: {
    name: 'v-chip-group',
    template: '<div class="v-chip-group"><slot /></div>'
  },
  VIcon: {
    name: 'v-icon',
    template: '<i class="v-icon"><slot /></i>',
    props: ['start', 'size']
  },
  VSpacer: {
    name: 'v-spacer',
    template: '<div class="v-spacer" />'
  },
  VBtn: {
    name: 'v-btn',
    template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>'
  },
  VAlert: {
    name: 'v-alert',
    template: '<div class="v-alert" :class="[type, variant]"><slot /></div>',
    props: ['type', 'variant']
  }
});

describe('CategoryInfoDialog', () => {
  const mockCategory: DeveloperCategory = {
    id: 'nodejs',
    name: 'Node.js / JS / TS',
    enabled: true,
    detectionFiles: ['package.json', 'yarn.lock'],
    cachePatterns: ['node_modules/', 'dist/'],
    warning: true,
    warningText: 'Warning message'
  };

  it('renders correctly when open with category data', () => {
    const wrapper = mount(CategoryInfoDialog, {
      props: {
        modelValue: true,
        category: mockCategory
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.text()).toContain('Node.js / JS / TS');
    expect(wrapper.text()).toContain('Detection Files');
    expect(wrapper.text()).toContain('Cache Patterns to Clean');
    expect(wrapper.text()).toContain('Warning message');
  });

  it('does not render when modelValue is false', () => {
    const wrapper = mount(CategoryInfoDialog, {
      props: {
        modelValue: false,
        category: mockCategory
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.v-dialog').exists()).toBe(false);
  });

  it('shows warning section only when warning is true', () => {
    const wrapper = mount(CategoryInfoDialog, {
      props: {
        modelValue: true,
        category: { ...mockCategory, warning: false }
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.v-alert').exists()).toBe(false);
  });

  it('displays all detection files', () => {
    const wrapper = mount(CategoryInfoDialog, {
      props: {
        modelValue: true,
        category: mockCategory
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const chips = wrapper.findAll('.v-chip');
    expect(chips.some(chip => chip.text().includes('package.json'))).toBe(true);
    expect(chips.some(chip => chip.text().includes('yarn.lock'))).toBe(true);
  });

  it('displays all cache patterns', () => {
    const wrapper = mount(CategoryInfoDialog, {
      props: {
        modelValue: true,
        category: mockCategory
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const chips = wrapper.findAll('.v-chip');
    expect(chips.some(chip => chip.text().includes('node_modules/'))).toBe(true);
    expect(chips.some(chip => chip.text().includes('dist/'))).toBe(true);
  });

  it('emits update:modelValue when close button is clicked', async () => {
    const wrapper = mount(CategoryInfoDialog, {
      props: {
        modelValue: true,
        category: mockCategory
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    await wrapper.find('.v-btn').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });
}); 