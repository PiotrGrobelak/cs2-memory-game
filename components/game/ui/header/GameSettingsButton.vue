<template>
  <Button
    icon="pi pi-cog"
    severity="secondary"
    outlined
    aria-label="Settings"
    class="transition-all duration-200 hover:shadow-md"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
import Button from "primevue/button";

interface Emits {
  (e: "click"): void;
}

defineEmits<Emits>();
</script>
