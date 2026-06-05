import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface AudioDevice {
  id: string;
  name: string;
  deviceType: "Speaker" | "Microphone" | "Ringtone" | "FullDuplex";
  isDefault: boolean;
  input_count: number;
  output_count: number;
  default_samples_per_sec: number;
}

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await invoke<AudioDevice[]>("get_audio_devices");
        setDevices(result);
      } catch (err) {
        console.error("Failed to load audio devices:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { devices, loading };
}
