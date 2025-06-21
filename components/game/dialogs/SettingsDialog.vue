<template>
  <Dialog
    :visible="visible"
    header="Game Settings"
    modal
    class="w-full max-w-md"
    @update:visible="handleVisibilityChange"
  >
    <div class="space-y-6">
      <!-- Options -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium">Enable Sound Effects</label>
          <ToggleButton
            on-icon="pi pi-volume-up"
            off-icon="pi pi-volume-off"
            :model-value="enableSound"
          />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm font-medium">Enable Parallax Effects</label>
          <ToggleButton
            on-icon="pi pi-eye"
            off-icon="pi pi-eye-slash"
            :model-value="enableParallax"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          @click="handleCancel"
        />
        <Button label="Apply" severity="success" @click="handleApply" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import ToggleButton from "primevue/togglebutton";

interface Settings {
  enableSound: boolean;
  enableParallax: boolean;
}

// Props
interface Props {
  visible: boolean;
  enableSound: boolean;
  enableParallax: boolean;
}

// Emits
interface Emits {
  (e: "apply", settings: Settings): void;
  (e: "close"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const enableSound = ref(props.enableSound);
const enableParallax = ref(props.enableParallax);

const handleVisibilityChange = (newVisible: boolean) => {
  if (!newVisible) {
    emit("close");
  }
};

// Methods
const handleCancel = () => {
  // Reset form
  enableSound.value = true;
  enableParallax.value = true;

  emit("close");
};

const handleApply = () => {
  const settings = {
    enableSound: enableSound.value,
    enableParallax: enableParallax.value,
  };

  emit("apply", settings);
  emit("close");
};
</script>
