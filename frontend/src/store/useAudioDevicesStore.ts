import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface AudioDevice {
  id: string;
  name: string;
  device_type: "Speaker" | "Microphone" | "Ringtone" | "FullDuplex";
  is_default: boolean;
  input_count: number;
  output_count: number;
  default_samples_per_sec: number;
}

interface AudioDevicesStore {
  devices: AudioDevice[];
  pjsipDevices: AudioDevice[];
  currentCaptureIdx: number | null;
  currentPlaybackIdx: number | null;
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
}

export const useAudioDevicesStore = create<AudioDevicesStore>((set) => ({
  devices: [],
  pjsipDevices: [],
  currentCaptureIdx: null,
  currentPlaybackIdx: null,
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const [alsaDevices, pjsipDevices, currentDevs] = await Promise.all([
        invoke<AudioDevice[]>("get_audio_devices"),
        invoke<AudioDevice[]>("get_pjsip_audio_devices"),
        invoke<[number, number] | null>("get_current_pjsip_audio_devices"),
      ]);
      set({
        devices: alsaDevices,
        pjsipDevices,
        currentCaptureIdx: currentDevs ? currentDevs[0] : null,
        currentPlaybackIdx: currentDevs ? currentDevs[1] : null,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
