import { create } from "zustand";
import type { DeviceTheme } from "../theme/deviceThemes";

const DEVICE_THEME_KEY = "deviceTheme";
const OUTPUT_KEY = "outputDeviceId";
const INPUT_KEY = "inputDeviceId";
const RINGTONE_KEY = "ringtoneDeviceId";

function getInitialDeviceTheme(): DeviceTheme {
  if (typeof window === "undefined") return "iphone";
  const saved = localStorage.getItem(DEVICE_THEME_KEY) as DeviceTheme | null;
  if (saved === "iphone" || saved === "galaxy" || saved === "pixel") return saved;
  return "iphone";
}

function loadId(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

interface SettingsStore {
  themeMode: "light" | "dark";
  deviceTheme: DeviceTheme;
  outputDeviceId: string | null;
  inputDeviceId: string | null;
  ringtoneDeviceId: string | null;
  setThemeMode: (mode: "light" | "dark") => void;
  setDeviceTheme: (theme: DeviceTheme) => void;
  setOutputDevice: (id: string) => void;
  clearOutputDevice: () => void;
  setInputDevice: (id: string) => void;
  clearInputDevice: () => void;
  setRingtoneDevice: (id: string) => void;
  clearRingtoneDevice: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  themeMode: "dark",
  deviceTheme: getInitialDeviceTheme(),
  outputDeviceId: loadId(OUTPUT_KEY),
  inputDeviceId: loadId(INPUT_KEY),
  ringtoneDeviceId: loadId(RINGTONE_KEY),

  setThemeMode: (mode) => set({ themeMode: mode }),
  setDeviceTheme: (theme) => {
    localStorage.setItem(DEVICE_THEME_KEY, theme);
    set({ deviceTheme: theme });
  },
  setOutputDevice: (id) => {
    localStorage.setItem(OUTPUT_KEY, id);
    set({ outputDeviceId: id });
  },
  clearOutputDevice: () => {
    localStorage.removeItem(OUTPUT_KEY);
    set({ outputDeviceId: null });
  },
  setInputDevice: (id) => {
    localStorage.setItem(INPUT_KEY, id);
    set({ inputDeviceId: id });
  },
  clearInputDevice: () => {
    localStorage.removeItem(INPUT_KEY);
    set({ inputDeviceId: null });
  },
  setRingtoneDevice: (id) => {
    localStorage.setItem(RINGTONE_KEY, id);
    set({ ringtoneDeviceId: id });
  },
  clearRingtoneDevice: () => {
    localStorage.removeItem(RINGTONE_KEY);
    set({ ringtoneDeviceId: null });
  },
}));
