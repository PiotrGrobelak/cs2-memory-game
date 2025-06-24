import { vi } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia } from "pinia";

// Mock global fetch for API tests
global.fetch = vi.fn();

// Mock localStorage with actual storage functionality
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageData[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    Reflect.deleteProperty(localStorageData, key);
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageData).forEach((key) => {
      Reflect.deleteProperty(localStorageData, key);
    });
  }),
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
  }
);

// Mock Audio API for game sounds tests
vi.stubGlobal(
  "Audio",
  class MockAudio {
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    load = vi.fn();
    currentTime = 0;
    volume = 1;
    preload = "auto";
    src = "";
    duration = 0;
    paused = true;
    ended = false;
    muted = false;
    readyState = 4; // HAVE_ENOUGH_DATA

    constructor(src?: string) {
      if (src) this.src = src;
    }
  }
);

vi.stubGlobal(
  "HTMLAudioElement",
  class MockHTMLAudioElement {
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    load = vi.fn();
    currentTime = 0;
    volume = 1;
    preload = "auto";
    src = "";
    duration = 0;
    paused = true;
    ended = false;
    muted = false;
    readyState = 4; // HAVE_ENOUGH_DATA
  }
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
