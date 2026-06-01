import { create } from "zustand";
import type { DeviceTheme } from "../theme/deviceThemes";

const DEVICE_THEME_KEY = "deviceTheme";

function getInitialDeviceTheme(): DeviceTheme {
  if (typeof window === "undefined") return "iphone";
  const saved = localStorage.getItem(DEVICE_THEME_KEY) as DeviceTheme | null;
  if (saved === "iphone" || saved === "galaxy" || saved === "pixel") return saved;
  return "iphone";
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
  setInputDevice: (id: string) => void;
  setRingtoneDevice: (id: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  themeMode: "dark",
  deviceTheme: getInitialDeviceTheme(),
  outputDeviceId: null,
  inputDeviceId: null,
  ringtoneDeviceId: null,

  setThemeMode: (mode) => set({ themeMode: mode }),
  setDeviceTheme: (theme) => {
    localStorage.setItem(DEVICE_THEME_KEY, theme);
    set({ deviceTheme: theme });
  },
  setOutputDevice: (id) => set({ outputDeviceId: id }),
  setInputDevice: (id) => set({ inputDeviceId: id }),
  setRingtoneDevice: (id) => set({ ringtoneDeviceId: id }),
}));
