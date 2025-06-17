import Aura from "@primeuix/themes/aura";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

  // Modules
  modules: [
    "@primevue/nuxt-module",
    "@nuxt/test-utils/module",
    "@nuxtjs/tailwindcss",
    "@nuxt/eslint",
    "@pinia/nuxt",
  ],

  primevue: {
    options: {
      theme: {
        preset: Aura,
      },
    },
  },

  // TypeScript Configuration
  typescript: {
    typeCheck: true,
  },
});
