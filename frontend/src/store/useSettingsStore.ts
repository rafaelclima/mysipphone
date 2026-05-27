import { create } from "zustand";

interface SettingsStore {
  themeMode: "light" | "dark";
  outputDeviceId: string | null;
  inputDeviceId: string | null;
  ringtoneDeviceId: string | null;
  setThemeMode: (mode: "light" | "dark") => void;
  setOutputDevice: (id: string) => void;
  setInputDevice: (id: string) => void;
  setRingtoneDevice: (id: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  themeMode: "dark",
  outputDeviceId: null,
  inputDeviceId: null,
  ringtoneDeviceId: null,

  setThemeMode: (mode) => set({ themeMode: mode }),
  setOutputDevice: (id) => set({ outputDeviceId: id }),
  setInputDevice: (id) => set({ inputDeviceId: id }),
  setRingtoneDevice: (id) => set({ ringtoneDeviceId: id }),
}));
