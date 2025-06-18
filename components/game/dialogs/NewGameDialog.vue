<template>
  <Dialog
    :visible="visible"
    header="Start New Game"
    :modal="true"
    :closable="true"
    class="w-full max-w-lg"
    @hide="handleCancel"
  >
    <div class="space-y-4">
      <p class="text-gray-600 dark:text-gray-400">
        Configure your new game settings below:
      </p>

      <!-- Quick Difficulty Buttons -->
      <div>
        <label class="block text-sm font-medium mb-3">
          Select Difficulty
        </label>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card
            v-for="diff in difficulties"
            :key="diff.name"
            class="cursor-pointer transition-all duration-200 hover:shadow-lg hover:transform hover:scale-105"
            :class="{
              'ring-2 ring-blue-500': selectedDifficulty === diff.name,
            }"
            @click="selectedDifficulty = diff.name"
          >
            <template #content>
              <div class="text-center p-2">
                <div class="text-lg font-semibold mb-1">{{ diff.label }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  {{ diff.cardCount }} cards
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ diff.gridSize.rows }}×{{ diff.gridSize.cols }} grid
                </div>
              </div>
            </template>
          </Card>
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
          <Dropdown
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
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import RadioButton from "primevue/radiobutton";
import Dropdown from "primevue/dropdown";

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
  (e: "visible", value: boolean): void;
  (e: "start-game", options: StartGameOptions): void;
  (e: "cancel"): void;
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
const handleCancel = () => {
  resetForm();
  emit("cancel");
  emit("visible", false);
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
  emit("visible", false);
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
