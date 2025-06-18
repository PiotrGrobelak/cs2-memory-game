<template>
  <Button
    icon="pi pi-share-alt"
    severity="success"
    outlined
    :disabled="disabled"
    aria-label="Share Game"
    class="transition-all duration-200 hover:shadow-md"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
import Button from "primevue/button";

// Props
interface Props {
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});

// Emits
interface Emits {
  (e: "click"): void;
}

defineEmits<Emits>();
</script>
