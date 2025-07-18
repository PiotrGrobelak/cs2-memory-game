<template>
  <Dialog
    :visible="visible"
    header="Start New Game"
    modal
    class="w-full max-w-lg"
    @update:visible="handleVisibilityChange"
  >
    <div class="space-y-4">
      <p class="text-gray-600 dark:text-gray-400">
        Configure your new game settings below:
      </p>

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

      <!-- Seed Options -->
      <div>
        <label class="block text-sm font-medium mb-2">Seed Options</label>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <RadioButton
              v-model="seedOption"
              input-id="random"
              value="random"
            />
            <label for="random" class="text-sm">
              Random seed (recommended)
            </label>
          </div>
          <div class="flex items-center gap-2">
            <RadioButton
              v-model="seedOption"
              input-id="custom"
              value="custom"
            />
            <label for="custom" class="text-sm">Custom seed</label>
          </div>
          <div class="flex items-center gap-2">
            <RadioButton
              v-model="seedOption"
              input-id="history"
              value="history"
            />
            <label for="history" class="text-sm">From history</label>
          </div>
        </div>

        <!-- Custom Seed Input -->
        <div v-if="seedOption === 'custom'" class="mt-3">
          <InputText
            v-model="customSeed"
            placeholder="Enter custom seed..."
            class="w-full"
            :class="{ 'p-invalid': seedValidationError }"
          />
          <small v-if="seedValidationError" class="p-error">
            {{ seedValidationError }}
          </small>
        </div>

        <!-- Seed History -->
        <div v-if="seedOption === 'history'" class="mt-3">
          <Select
            v-model="selectedHistorySeed"
            :options="seedHistory"
            placeholder="Select from history"
            class="w-full"
            :disabled="seedHistory.length === 0"
          />
          <small v-if="seedHistory.length === 0" class="text-gray-500">
            No seeds in history
          </small>
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
          label="Start Game"
          severity="success"
          :disabled="!canStartGame"
          @click="handleStartGame"
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
import RadioButton from "primevue/radiobutton";
import Select from "primevue/select";

interface Difficulty {
  name: "easy" | "medium" | "hard";
  label: string;
  cardCount: number;
  gridSize: { rows: number; cols: number };
}

// Props
interface Props {
  visible: boolean;
  difficulties: Difficulty[];
  seedHistory: string[];
  seedValidator?: (seed: string) => { isValid: boolean; error: string | null };
}

interface StartGameOptions {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
}

// Emits
interface Emits {
  (e: "start-game", options: StartGameOptions): void;
  (e: "close"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const selectedDifficulty = ref<"easy" | "medium" | "hard">("easy");
const seedOption = ref<"random" | "custom" | "history">("random");
const customSeed = ref("");
const selectedHistorySeed = ref("");

// Computed
const seedValidationError = computed(() => {
  if (
    seedOption.value !== "custom" ||
    !customSeed.value ||
    !props.seedValidator
  )
    return null;
  const validation = props.seedValidator(customSeed.value);
  return validation.isValid ? null : validation.error;
});

const canStartGame = computed(() => {
  if (seedOption.value === "custom") {
    return !seedValidationError.value && customSeed.value.length > 0;
  }
  if (seedOption.value === "history") {
    return !!selectedHistorySeed.value;
  }
  return true; // Random seed
});

// Methods
const handleVisibilityChange = (newVisible: boolean) => {
  if (!newVisible) {
    emit("close");
  }
};

const handleCancel = () => {
  resetForm();
  emit("close");
};

const handleStartGame = () => {
  let finalSeed: string | undefined;

  switch (seedOption.value) {
    case "custom":
      finalSeed = customSeed.value;
      break;
    case "history":
      finalSeed = selectedHistorySeed.value;
      break;
    default:
      finalSeed = undefined;
  }

  const options = {
    difficulty: selectedDifficulty.value,
    seed: finalSeed,
  };

  emit("start-game", options);
  emit("close");
  resetForm();
};

const resetForm = () => {
  selectedDifficulty.value = "easy";
  seedOption.value = "random";
  customSeed.value = "";
  selectedHistorySeed.value = "";
};

// Watch for external changes
watch(
  () => props.visible,
  (newValue) => {
    if (!newValue) {
      resetForm();
    }
  },
);
</script>
