import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NotificationSnackbar from '../NotificationSnackbar.vue';

// Create mock components for Vuetify
const createVuetifyMocks = () => ({
  VSnackbar: {
    name: 'v-snackbar',
    template: '<div class="v-snackbar" :class="color"><slot /><slot name="actions" /></div>',
    props: ['modelValue', 'color']
  },
  VBtn: {
    name: 'v-btn',
    template: '<button class="v-btn"><slot /></button>'
  }
});

describe('NotificationSnackbar', () => {
  it('renders correctly with default props', () => {
    const wrapper = mount(NotificationSnackbar, {
      props: {
        modelValue: true,
        text: 'Test notification'
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.text()).toContain('Test notification');
    expect(wrapper.text()).toContain('Close');
  });

  it('renders with custom color', () => {
    const wrapper = mount(NotificationSnackbar, {
      props: {
        modelValue: true,
        text: 'Test notification',
        color: 'success'
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    expect(wrapper.find('.v-snackbar').classes()).toContain('success');
  });

  it('emits update:modelValue when close button is clicked', async () => {
    const wrapper = mount(NotificationSnackbar, {
      props: {
        modelValue: true,
        text: 'Test notification'
      },
      global: {
        components: createVuetifyMocks()
      }
    });

    await wrapper.find('.v-btn').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });
}); 