<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header -->
      <HistoryHeader
        :has-history="hasHistory"
        @clear-history="confirmClearHistory"
      />

      <!-- Filters and Export Section -->
      <HistoryFilters
        v-model:selected-difficulty="selectedDifficulty"
        v-model:search-query="searchQuery"
        :has-history="hasHistory"
        :has-filtered-results="hasFilteredResults"
        :difficulty-options="difficultyOptions"
        @export-history="exportToJSON"
      />

      <!-- Statistics Cards -->
      <HistoryStats :has-history="hasHistory" :stats="stats" />

      <!-- History Content -->
      <Card>
        <template #content>
          <div v-if="loading" class="text-center py-8">
            <ProgressSpinner />
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              Loading game history...
            </p>
          </div>

          <!-- Empty State -->
          <HistoryEmptyState v-else-if="!hasHistory" />

          <!-- Game History -->
          <div v-else>
            <!-- Mobile Cards View -->
            <div class="block md:hidden space-y-4">
              <HistoryMobileCard
                v-for="(game, index) in filteredHistory"
                :key="game.id"
                :game="game"
                :index="index"
                @copy-seed="copySeed"
              />
            </div>

            <!-- Desktop Table View -->
            <HistoryTable :games="filteredHistory" @copy-seed="copySeed" />
          </div>
        </template>
      </Card>
    </div>

    <!-- Confirmation Dialog -->
    <ConfirmDialog />
    <Toast position="top-right" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useClipboard } from "@vueuse/core";

import Card from "primevue/card";
import ProgressSpinner from "primevue/progressspinner";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";

import HistoryHeader from "~/components/history/HistoryHeader.vue";
import HistoryFilters from "~/components/history/HistoryFilters.vue";
import HistoryStats from "~/components/history/HistoryStats.vue";
import HistoryEmptyState from "~/components/history/HistoryEmptyState.vue";
import HistoryMobileCard from "~/components/history/HistoryMobileCard.vue";
import HistoryTable from "~/components/history/HistoryTable.vue";

import { useHistoryData } from "~/composables/history/useHistoryData";
import { useHistoryFilters } from "~/composables/history/useHistoryFilters";
import { useHistoryStats } from "~/composables/history/useHistoryStats";

definePageMeta({
  layout: "default",
  title: "Game History - CS2 Memory Game",
  description: "View your game history and statistics",
});

useHead({
  title: "Game History - CS2 Memory Game",
  meta: [
    {
      name: "description",
      content: "View your complete game history and performance statistics",
    },
  ],
});

const { loading, gameHistory, hasHistory, loadHistory, clearHistory } =
  useHistoryData();
const {
  selectedDifficulty,
  searchQuery,
  difficultyOptions,
  filteredHistory,
  hasFilteredResults,
} = useHistoryFilters(gameHistory);
const { stats } = useHistoryStats(gameHistory);

const confirm = useConfirm();
const toast = useToast();
const { copy } = useClipboard();

const confirmClearHistory = () => {
  confirm.require({
    message:
      "Are you sure you want to clear all game history? This action cannot be undone.",
    header: "Clear Game History",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: async () => {
      try {
        await clearHistory();
        toast.add({
          severity: "success",
          summary: "Success",
          detail: "Game history cleared successfully",
          life: 3000,
        });
      } catch (error) {
        console.error("Error clearing history:", error);
        toast.add({
          severity: "error",
          summary: "Error",
          detail: "Failed to clear game history",
          life: 3000,
        });
      }
    },
  });
};

const copySeed = async (seed: string) => {
  try {
    await copy(seed);
    toast.add({
      severity: "success",
      summary: "Copied",
      detail: "Seed copied to clipboard",
      life: 2000,
    });
  } catch (error) {
    console.error("Failed to copy seed:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to copy seed",
      life: 3000,
    });
  }
};

const exportToJSON = async () => {
  try {
    const data = {
      exportDate: new Date().toISOString(),
      totalGames: gameHistory.value.length,
      filteredGames: filteredHistory.value.length,
      games: filteredHistory.value,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cs2-memory-game-history-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Game history exported successfully",
      life: 3000,
    });
  } catch (error) {
    console.error("Export failed:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to export game history",
      life: 3000,
    });
  }
};

onMounted(async () => {
  try {
    await loadHistory();
  } catch (error) {
    console.error("Error loading game history:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to load game history",
      life: 3000,
    });
  }
});
</script>
