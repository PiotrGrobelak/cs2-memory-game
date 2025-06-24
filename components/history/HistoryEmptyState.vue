<template>
  <div class="text-center py-12">
    <i class="pi pi-inbox text-6xl text-gray-400 mb-4" />
    <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
      No Games Played Yet
    </h3>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      Start playing to see your game history and statistics here.
    </p>
    <NuxtLink to="/">
      <Button label="Start Playing" icon="pi pi-play" severity="success" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import Button from "primevue/button";
</script>
