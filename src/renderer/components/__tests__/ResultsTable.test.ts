import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ResultsTable from '../ResultsTable.vue';
import { formatSize } from '@/utils/formatters';
import type { FolderItem } from '@/types/common';

// Mock the formatSize function
vi.mock('@/utils/formatters', () => ({
  formatSize: vi.fn((bytes: number) => `${bytes} B`)
}));

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VCard: {
    name: 'v-card',
    template: '<div class="v-card"><slot /></div>'
  },
  VCardTitle: {
    name: 'v-card-title',
    template: '<div class="v-card-title"><slot /></div>'
  },
  VSpacer: {
    name: 'v-spacer',
    template: '<div class="v-spacer" />'
  },
  VChip: {
    name: 'v-chip',
    template: '<div class="v-chip"><slot /></div>'
  },
  VDataTable: {
    name: 'v-data-table',
    template: '<div class="v-data-table"><slot /></div>',
    props: ['items', 'headers', 'loading', 'items-per-page', 'sort-by', 'modelValue'],
    emits: ['update:modelValue']
  },
  VTooltip: {
    name: 'v-tooltip',
    template: '<div class="v-tooltip"><slot name="activator" /><slot /></div>'
  }
});

describe('ResultsTable', () => {
  const mockFolders: FolderItem[] = [
    { path: '/test/path1', size: 1024 },
    { path: '/test/path2', size: 2048 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with folders', () => {
    const wrapper = mount(ResultsTable, {
      props: {
        folders: mockFolders,
        modelValue: [],
        isScanning: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    // Check if title is rendered
    expect(wrapper.find('.v-card-title').text()).toContain('Found Folders');

    // Check if total size is displayed
    expect(formatSize).toHaveBeenCalledWith(0); // Selected size
    expect(formatSize).toHaveBeenCalledWith(3072); // Total size (1024 + 2048)
  });

  it('computes total size correctly', async () => {
    const wrapper = mount(ResultsTable, {
      props: {
        folders: mockFolders,
        modelValue: ['/test/path1'],
        isScanning: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const dataTable = wrapper.findComponent({ name: 'v-data-table' });
    const items = dataTable.vm.items;
    const totalSize = items.reduce((acc: number, item: FolderItem) => acc + item.size, 0);

    expect(totalSize).toBe(3072);
    // Check if selected size is computed correctly
    expect(formatSize).toHaveBeenCalledWith(1024); // Selected size (path1)
    expect(formatSize).toHaveBeenCalledWith(3072); // Total size
  });

  it('shows loading state', () => {
    const wrapper = mount(ResultsTable, {
      props: {
        folders: [],
        modelValue: [],
        isScanning: true
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const dataTable = wrapper.findComponent({ name: 'v-data-table' });
    expect(dataTable.props('loading')).toBe(true);
  });

  it('emits update:modelValue when selection changes', async () => {
    const wrapper = mount(ResultsTable, {
      props: {
        folders: mockFolders,
        modelValue: [],
        isScanning: false
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const dataTable = wrapper.findComponent({ name: 'v-data-table' });
    await dataTable.vm.$emit('update:modelValue', ['/test/path1']);
    
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['/test/path1']]);
  });
}); 