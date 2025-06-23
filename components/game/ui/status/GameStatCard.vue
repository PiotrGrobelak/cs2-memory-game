<template>
  <Card
    class="transition-all duration-200 hover:shadow-md"
    :pt="{ body: { class: 'p-1!' } }"
  >
    <template #content>
      <div :class="contentClass">
        <i :class="iconClass" />
        <div class="min-w-0 flex-1">
          <div :class="labelClass">
            {{ label }}
          </div>
          <div :class="valueClass">
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

const contentClass = computed(() => [
  "flex items-center",
  // Mobile: compact spacing, Desktop: more generous spacing
  "gap-2 md:gap-3",
]);

const iconClass = computed(() => [
  "pi",
  props.icon,
  `text-${props.color}-500`,
  // Mobile: smaller icon, Desktop: larger icon
  "text-base md:text-xl",
  "flex-shrink-0", // Prevent icon from shrinking
]);

const labelClass = computed(() => [
  "text-gray-600 dark:text-gray-400",
  // Mobile: smaller text, Desktop: normal text
  "text-xs md:text-sm",
  "font-medium",
]);

const valueClass = computed(() => [
  "font-semibold",
  // Mobile: smaller text, Desktop: larger text
  "text-sm md:text-lg",
  "truncate", // Prevent text overflow on very small screens
]);
</script>
