<template>
  <Dialog
    :visible="visible"
    header="Game Settings"
    :modal="true"
    :closable="true"
    class="w-full max-w-md"
    @hide="handleCancel"
  >
    <div class="space-y-6">
      <!-- Difficulty Selection -->
      <div>
        <label class="block text-sm font-medium mb-2">Difficulty</label>
        <div class="grid grid-cols-3 gap-2">
          <Button
            v-for="diff in difficulties"
            :key="diff.name"
            :label="diff.label"
            :severity="
              selectedDifficulty === diff.name ? 'success' : 'secondary'
            "
            :outlined="selectedDifficulty !== diff.name"
            size="small"
            class="flex flex-col items-center p-3"
            @click="selectedDifficulty = diff.name"
          >
            <template #default>
              <div class="text-center">
                <div class="font-semibold">{{ diff.label }}</div>
                <div class="text-xs opacity-70">{{ diff.cardCount }} cards</div>
              </div>
            </template>
          </Button>
        </div>
      </div>

      <!-- Seed Input -->
      <div>
        <label class="block text-sm font-medium mb-2">
          Custom Seed (Optional)
        </label>
        <InputText
          v-model="customSeed"
          placeholder="Enter custom seed..."
          class="w-full"
          :class="{ 'p-invalid': seedValidationError }"
        />
        <small v-if="seedValidationError" class="p-error">
          {{ seedValidationError }}
        </small>
        <small v-else class="text-gray-500">
          Leave empty for random seed
        </small>
      </div>

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
        <Button
          label="Apply"
          severity="success"
          :disabled="!!seedValidationError"
          @click="handleApply"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import ToggleButton from "primevue/togglebutton";

interface Difficulty {
  name: "easy" | "medium" | "hard";
  label: string;
  cardCount: number;
}
interface Settings {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
  enableSound: boolean;
  enableParallax: boolean;
}

// Props
interface Props {
  visible: boolean;
  difficulties: Difficulty[];
  seedValidator?: (seed: string) => { isValid: boolean; error: string | null };
}

// Emits
interface Emits {
  (e: "visible", value: boolean): void;
  (e: "apply", settings: Settings): void;
  (e: "cancel"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const selectedDifficulty = ref<"easy" | "medium" | "hard">("easy");
const customSeed = ref("");
const enableSound = ref(true);
const enableParallax = ref(true);

// Computed
const seedValidationError = computed(() => {
  if (!customSeed.value || !props.seedValidator) return null;
  const validation = props.seedValidator(customSeed.value);
  return validation.isValid ? null : validation.error;
});

// Methods
const handleCancel = () => {
  // Reset form
  selectedDifficulty.value = "easy";
  customSeed.value = "";
  enableSound.value = true;
  enableParallax.value = true;

  emit("cancel");
  emit("visible", false);
};

const handleApply = () => {
  const settings = {
    difficulty: selectedDifficulty.value,
    seed: customSeed.value || undefined,
    enableSound: enableSound.value,
    enableParallax: enableParallax.value,
  };

  emit("apply", settings);
  emit("visible", false);
};

// Watch for external changes
watch(
  () => props.visible,
  (newValue) => {
    if (!newValue) {
      // Reset form when dialog closes
      selectedDifficulty.value = "easy";
      customSeed.value = "";
    }
  },
);
</script>
