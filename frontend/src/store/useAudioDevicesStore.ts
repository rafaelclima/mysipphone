import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface AudioDevice {
  id: string;
  name: string;
  device_type: "Speaker" | "Microphone" | "Ringtone";
  is_default: boolean;
}

interface AudioDevicesStore {
  devices: AudioDevice[];
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
}

export const useAudioDevicesStore = create<AudioDevicesStore>((set) => ({
  devices: [],
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const devices = await invoke<AudioDevice[]>("get_audio_devices");
      set({ devices, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
