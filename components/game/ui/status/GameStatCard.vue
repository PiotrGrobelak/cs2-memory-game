<template>
  <Card class="transition-all duration-200 hover:shadow-md">
    <template #content>
      <div class="flex items-center gap-3">
        <i :class="`pi ${icon} text-${color}-500 text-2xl`" />
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
import Card from "primevue/card";

// Props
interface Props {
  icon: string;
  label: string;
  value: string | number;
  color?: "blue" | "purple" | "green" | "yellow" | "red";
}

withDefaults(defineProps<Props>(), {
  color: "blue",
});
</script>
