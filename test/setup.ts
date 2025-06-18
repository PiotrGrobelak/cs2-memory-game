import { vi } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia } from "pinia";

// Mock global fetch for API tests
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// Mock Canvas API for game engine tests
const canvasContextMock = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
};

const canvasMock = {
  getContext: vi.fn(() => canvasContextMock),
  width: 800,
  height: 600,
};

vi.stubGlobal(
  "HTMLCanvasElement",
  class {
    constructor() {
      return canvasMock;
    }
    getContext(contextId: string) {
      console.log("getContext", contextId);
      return canvasContextMock;
    }
  },
);

// Configure Vue Test Utils with Pinia
config.global.plugins = [createPinia()];

// Mock CSS animations
vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
  return setTimeout(callback, 16);
});

vi.stubGlobal("cancelAnimationFrame", (id: number) => {
  clearTimeout(id);
});
