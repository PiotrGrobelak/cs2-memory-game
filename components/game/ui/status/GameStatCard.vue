<template>
  <Card class="transition-all duration-200 hover:shadow-md">
    <template #content>
      <div class="flex items-center gap-3">
        <i :class="iconClass" />
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ label }}
          </div>
          <div class="text-lg font-semibold">
            {{ value }}
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Card from "primevue/card";

// Props
interface Props {
  icon: string;
  label: string;
  value: string | number;
  color?: "blue" | "purple" | "green" | "yellow" | "red";
}

const props = withDefaults(defineProps<Props>(), {
  color: "blue",
});

// Computed class for the icon
const iconClass = computed(() => [
  "pi",
  props.icon,
  `text-${props.color}-500`,
  "text-2xl",
]);
</script>
