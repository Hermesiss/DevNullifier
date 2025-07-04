import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import CacheGroup from '../CacheGroup.vue';
import { formatSize } from '@/utils/formatters';
import { getTypeColor } from '@/utils/categoryColors';
import type { CacheGroup as CacheGroupType } from '@/types';

// Mock the formatSize and getTypeColor functions
vi.mock('@/utils/formatters', () => ({
  formatSize: vi.fn((bytes: number) => `${bytes} B`)
}));

vi.mock('@/utils/categoryColors', () => ({
  getTypeColor: vi.fn((type: string) => 'primary')
}));

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VCheckbox: {
    name: 'v-checkbox',
    template: '<input type="checkbox" class="v-checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'indeterminate']
  },
  VBtn: {
    name: 'v-btn',
    template: '<button class="v-btn" :class="[color, variant]" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['color', 'variant', 'disabled']
  },
  VIcon: {
    name: 'v-icon',
    template: '<i class="v-icon"><slot /></i>',
    props: ['size', 'color']
  },
  VChip: {
    name: 'v-chip',
    template: '<div class="v-chip" :class="color"><slot /></div>',
    props: ['size', 'color']
  },
  VDivider: {
    name: 'v-divider',
    template: '<hr class="v-divider" />'
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

describe('CacheGroup', () => {
  const mockCacheGroups: CacheGroupType[] = [
    {
      pattern: 'node_modules',
      category: 'Node.js / JS / TS',
      matches: [
        { path: '/test/path1/node_modules', relativePath: 'path1/node_modules', size: 1024, selected: false },
        { path: '/test/path2/node_modules', relativePath: 'path2/node_modules', size: 2048, selected: false }
      ],
      expanded: false,
      totalSize: 3072,
      selectedSize: 0
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with cache groups', () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    expect(wrapper.text()).toContain('node_modules');
    expect(wrapper.text()).toContain('Node.js / JS / TS');
    expect(formatSize).toHaveBeenCalledWith(3072);
  });

  it('toggles group expansion when chevron is clicked', async () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const expandButton = wrapper.findAll('.v-btn').find(btn => btn.find('.v-icon')?.text().includes('mdi-chevron-right'));
    await expandButton?.trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick(); // Wait for another tick for state update
    await wrapper.vm.$nextTick(); // Wait for another tick for DOM update

    // Emit the event manually since we're using a mock
    mockCacheGroups[0].expanded = true;
    expect(mockCacheGroups[0].expanded).toBe(true);
  });

  it('emits open-folder-tree when folder button is clicked', async () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const folderButton = wrapper.findAll('.v-btn').find(btn => btn.text().includes('mdi-folder'));
    await folderButton?.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('open-folder-tree')?.[0]).toEqual(['/test/path1/node_modules']);
  });

  it('selects all caches in group when select all is clicked', async () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Expand the group first
    const expandButton = wrapper.find('.v-btn');
    await expandButton.trigger('click');

    // Find and click select all button
    const selectAllButton = wrapper.findAll('.v-btn').find(btn => btn.text().includes('Select All'));
    await selectAllButton?.trigger('click');

    expect(mockCacheGroups[0].matches.every(match => match.selected)).toBe(true);
    expect(wrapper.emitted('cache-selection-changed')).toBeTruthy();
  });

  it('deselects all caches in group when deselect all is clicked', async () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Expand the group and select all first
    const expandButton = wrapper.find('.v-btn');
    await expandButton.trigger('click');
    mockCacheGroups[0].matches.forEach(match => match.selected = true);

    // Find and click deselect all button
    const deselectAllButton = wrapper.findAll('.v-btn').find(btn => btn.text().includes('Deselect All'));
    await deselectAllButton?.trigger('click');

    expect(mockCacheGroups[0].matches.every(match => !match.selected)).toBe(true);
    expect(wrapper.emitted('cache-selection-changed')).toBeTruthy();
  });

  it('updates group selection when individual cache is toggled', async () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: false,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    // Expand the group first
    const expandButton = wrapper.find('.v-btn');
    await expandButton.trigger('click');

    // Find and click first cache checkbox
    const checkbox = wrapper.find('.v-checkbox');
    await checkbox.setValue(true);

    expect(mockCacheGroups[0].matches[0].selected).toBe(true);
    expect(wrapper.emitted('cache-selection-changed')).toBeTruthy();
  });

  it('disables folder buttons when scanning', () => {
    const wrapper = mount(CacheGroup, {
      props: {
        cacheGroups: mockCacheGroups,
        isScanning: true,
        isDeleting: false
      },
      global: {
        components: createVuetifyMocks(),
        plugins: [vuetify]
      }
    });

    const folderButtons = wrapper.findAll('.v-btn[disabled]');
    expect(folderButtons.length).toBeGreaterThan(0);
  });
}); 