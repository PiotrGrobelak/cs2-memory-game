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
            v-model="enableSound"
            on-icon="pi pi-volume-up"
            off-icon="pi pi-volume-off"
          />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm font-medium">Enable Parallax Effects</label>
          <ToggleButton
            v-model="enableParallax"
            on-icon="pi pi-eye"
            off-icon="pi pi-eye-slash"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Volume</label>
            <span class="text-sm text-gray-600">{{ volume }}%</span>
          </div>
          <Slider
            v-model="volume"
            :min="0"
            :max="100"
            :step="5"
            :disabled="!enableSound"
            class="w-full"
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
import Slider from "primevue/slider";

interface Settings {
  enableSound: boolean;
  enableParallax: boolean;
  volume: number;
}

// Props
interface Props {
  visible: boolean;
  enableSound: boolean;
  enableParallax: boolean;
  volume: number;
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
const volume = ref(props.volume);

const handleVisibilityChange = (newVisible: boolean) => {
  if (!newVisible) {
    emit("close");
  }
};

// Methods
const handleCancel = () => {
  // Reset form to original values
  enableSound.value = props.enableSound;
  enableParallax.value = props.enableParallax;
  volume.value = props.volume;

  emit("close");
};

const handleApply = () => {
  const settings = {
    enableSound: enableSound.value,
    enableParallax: enableParallax.value,
    volume: volume.value,
  };

  console.log("handleApply", settings);

  emit("apply", settings);
  emit("close");
};
</script>
