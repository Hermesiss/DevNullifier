import { createApp } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

import App from "./App.vue";

const vuetify = createVuetify({
  components: {
    ...components
  },
  directives,
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        colors: {
          primary: "#1976D2",
          secondary: "#424242",
          accent: "#82B1FF",
          error: "#FF5252",
          info: "#2196F3",
          success: "#4CAF50",
          warning: "#FFC107"
        }
      },
      dark: {
        colors: {
          primary: "#90CAF9",
          secondary: "#9E9E9E",
          accent: "#BBDEFB",
          error: "#EF5350",
          info: "#64B5F6",
          success: "#81C784",
          warning: "#FFD54F"
        }
      }
    }
  }
});

const app = createApp(App);
app.use(vuetify);
app.mount("#app");
