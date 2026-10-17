import { createApp } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import "./styles/theme.css";

import App from "./App.vue";
import i18n from "./i18n";

const lightColors = {
  primary: "#FFC928",
  "on-primary": "#292C32",
  secondary: "#3478D4",
  "on-secondary": "#FFFFFF",
  accent: "#F58A24",
  error: "#D94C4C",
  "on-error": "#FFFFFF",
  info: "#3478D4",
  "on-info": "#FFFFFF",
  success: "#2D8659",
  "on-success": "#FFFFFF",
  warning: "#F58A24",
  "on-warning": "#292C32",
  background: "#F5F5F2",
  "on-background": "#292C32",
  surface: "#FFFFFF",
  "on-surface": "#292C32",
  "surface-variant": "#ECEDE8",
  "on-surface-variant": "#292C32",
  "surface-bright": "#FFFFFF",
  "surface-light": "#ECEDE8",
  outline: "#DCDDD7",
  "outline-variant": "#DCDDD7"
};

const darkColors = {
  primary: "#FFC928",
  "on-primary": "#292C32",
  secondary: "#5B93E0",
  "on-secondary": "#202226",
  accent: "#F58A24",
  error: "#D94C4C",
  "on-error": "#FFFFFF",
  info: "#5B93E0",
  "on-info": "#202226",
  success: "#71D6A0",
  "on-success": "#202226",
  warning: "#F58A24",
  "on-warning": "#292C32",
  background: "#202226",
  "on-background": "#F0F0EC",
  surface: "#2B2E34",
  "on-surface": "#F0F0EC",
  "surface-variant": "#363940",
  "on-surface-variant": "#F0F0EC",
  "surface-bright": "#363940",
  "surface-light": "#363940",
  outline: "#41444B",
  "outline-variant": "#41444B"
};

const vuetify = createVuetify({
  components: {
    ...components
  },
  directives,
  defaults: {
    VBtn: {
      rounded: "md",
      style: "text-transform: none; letter-spacing: normal;"
    },
    VCard: {
      rounded: "md",
      elevation: 0
    },
    VTextField: {
      rounded: "md"
    },
    VSelect: {
      rounded: "md"
    },
    VChip: {
      rounded: "md"
    },
    VDialog: {
      scrim: true
    },
    VCheckbox: {
      color: "primary"
    },
    VCheckboxBtn: {
      color: "primary"
    },
    VSlider: {
      color: "primary"
    },
    VProgressLinear: {
      rounded: true
    }
  },
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        dark: false,
        colors: lightColors
      },
      dark: {
        dark: true,
        colors: darkColors
      }
    }
  }
});

const app = createApp(App);
app.use(i18n);
app.use(vuetify);
app.mount("#app");
