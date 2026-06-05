use std::sync::atomic::{AtomicBool, Ordering};

use alsa::device_name::HintIter;
use alsa::Direction;

use crate::backend::AudioBackend;
use crate::error::AudioError;

pub struct AlsaBackend {
    muted: AtomicBool,
}

impl AlsaBackend {
    pub fn new() -> Self {
        Self {
            muted: AtomicBool::new(false),
        }
    }
}

impl Default for AlsaBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioBackend for AlsaBackend {
    fn initialize(&mut self) -> Result<(), AudioError> {
        tracing::info!("ALSA backend initialized");
        Ok(())
    }

    fn enumerate_devices(&self) -> Result<Vec<shared::AudioDevice>, AudioError> {
        let mut devices = Vec::new();
        let mut has_default_playback = false;
        let mut has_default_capture = false;

        for card in alsa::card::Iter::new() {
            let card = card?;

            let card_name = card.get_name().unwrap_or_default().to_string();
            let card_longname = card.get_longname().unwrap_or_default().to_string();
            let display_name = if card_longname.is_empty() {
                card_name.clone()
            } else {
                format!("{} ({})", card_name, card_longname)
            };

            let hints = HintIter::new_str(Some(&card), "pcm")?;

            for hint in hints {
                let name = hint.name.unwrap_or_default();
                let desc = hint.desc.unwrap_or_default();

                match hint.direction {
                    Some(Direction::Playback) => {
                        devices.push(shared::AudioDevice {
                            id: name.clone(),
                            name: if desc.is_empty() {
                                format!("{} - {}", display_name, name)
                            } else {
                                desc
                            },
                            device_type: shared::AudioDeviceType::Speaker,
                            is_default: !has_default_playback,
                            input_count: 0,
                            output_count: 1,
                            default_samples_per_sec: 0,
                        });
                        has_default_playback = true;
                    }
                    Some(Direction::Capture) => {
                        devices.push(shared::AudioDevice {
                            id: name.clone(),
                            name: if desc.is_empty() {
                                format!("{} - {}", display_name, name)
                            } else {
                                desc
                            },
                            device_type: shared::AudioDeviceType::Microphone,
                            is_default: !has_default_capture,
                            input_count: 1,
                            output_count: 0,
                            default_samples_per_sec: 0,
                        });
                        has_default_capture = true;
                    }
                    None => {}
                }
            }
        }

        devices.push(shared::AudioDevice {
            id: "default".to_string(),
            name: "Default ALSA device".to_string(),
            device_type: shared::AudioDeviceType::Speaker,
            is_default: !has_default_playback,
            input_count: 0,
            output_count: 1,
            default_samples_per_sec: 0,
        });

        devices.push(shared::AudioDevice {
            id: "default".to_string(),
            name: "Default ALSA device".to_string(),
            device_type: shared::AudioDeviceType::Microphone,
            is_default: !has_default_capture,
            input_count: 1,
            output_count: 0,
            default_samples_per_sec: 0,
        });

        devices.push(shared::AudioDevice {
            id: "default".to_string(),
            name: "Default speaker (ringtone)".to_string(),
            device_type: shared::AudioDeviceType::Ringtone,
            is_default: true,
            input_count: 0,
            output_count: 1,
            default_samples_per_sec: 0,
        });

        Ok(devices)
    }

    fn set_mute(&mut self, muted: bool) {
        self.muted.store(muted, Ordering::SeqCst);
        tracing::info!("Mute set to {}", muted);
    }

    fn muted(&self) -> bool {
        self.muted.load(Ordering::SeqCst)
    }

    fn default_output_device(&self) -> Option<String> {
        Some("default".to_string())
    }

    fn default_input_device(&self) -> Option<String> {
        Some("default".to_string())
    }
}
