import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DeleteDialog from '../DeleteDialog.vue';
import { formatSize } from '@/utils/formatters';

// Mock the formatSize function
vi.mock('@/utils/formatters', () => ({
  formatSize: vi.fn((bytes: number) => `${bytes} B`)
}));

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VDialog: {
    name: 'v-dialog',
    template: '<div class="v-dialog"><slot /></div>',
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
  VIcon: {
    name: 'v-icon',
    template: '<i class="v-icon"><slot /></i>'
  },
  VSpacer: {
    name: 'v-spacer',
    template: '<div class="v-spacer" />'
  },
  VBtn: {
    name: 'v-btn',
    template: '<button class="v-btn" :class="color"><slot /></button>',
    props: ['color']
  }
});

describe('DeleteDialog', () => {
  it('renders correctly with provided props', () => {
    const wrapper = mount(DeleteDialog, {
      props: {
        modelValue: true,
        selectedCount: 5,
        selectedSize: 1024
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.text()).toContain('Confirm Deletion');
    expect(wrapper.text()).toContain('5');
    expect(formatSize).toHaveBeenCalledWith(1024);
  });

  it('emits update:modelValue when Cancel button is clicked', async () => {
    const wrapper = mount(DeleteDialog, {
      props: {
        modelValue: true,
        selectedCount: 5,
        selectedSize: 1024
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const cancelButton = wrapper.findAll('.v-btn').find(btn => btn.text() === 'Cancel');
    await cancelButton?.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  it('emits confirm and closes dialog when Delete button is clicked', async () => {
    const wrapper = mount(DeleteDialog, {
      props: {
        modelValue: true,
        selectedCount: 5,
        selectedSize: 1024
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    const deleteButton = wrapper.findAll('.v-btn').find(btn => btn.text() === 'Delete');
    await deleteButton?.trigger('click');
    
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
    expect(wrapper.emitted('confirm')).toBeTruthy();
  });

  it('displays warning message about permanent deletion', () => {
    const wrapper = mount(DeleteDialog, {
      props: {
        modelValue: true,
        selectedCount: 5,
        selectedSize: 1024
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.text-warning').text()).toContain('⚠️ This action cannot be undone!');
  });
}); 