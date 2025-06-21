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
    "@vueuse/nuxt",
  ],

  css: ["primeicons/primeicons.css"],

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

  // // PixiJS Configuration for optimal performance
  // build: {
  //   transpile: ["pixi.js"],
  // },

  vite: {
    optimizeDeps: {
      include: ["pixi.js"],
    },
    define: {
      global: "globalThis",
    },
  },
});
