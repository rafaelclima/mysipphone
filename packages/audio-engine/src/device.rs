use alsa::device_name::HintIter;

use crate::error::AudioError;

pub struct AudioDeviceManager {
    devices: Vec<shared::AudioDevice>,
    output_device: String,
    input_device: String,
    ringtone_device: String,
}

impl AudioDeviceManager {
    pub fn new() -> Self {
        Self {
            devices: Vec::new(),
            output_device: "default".to_string(),
            input_device: "default".to_string(),
            ringtone_device: "default".to_string(),
        }
    }

    pub fn refresh(&mut self) -> Result<(), AudioError> {
        let mut devices = Vec::new();
        let mut has_default_playback = false;
        let mut has_default_capture = false;

        for card in alsa::card::Iter::new() {
            let card = card?;

            let card_name = card.get_name()
                .unwrap_or_default()
                .to_string();
            let card_longname = card.get_longname()
                .unwrap_or_default()
                .to_string();
            let display_name = if card_longname.is_empty() {
                card_name
            } else {
                format!("{} ({})", card_name, card_longname)
            };

            let hints = HintIter::new_str(Some(&card), "pcm")?;

            for hint in hints {
                let name = hint.name.unwrap_or_default();
                let desc = hint.desc.unwrap_or_default();

                match hint.direction {
                    Some(alsa::Direction::Playback) => {
                        devices.push(shared::AudioDevice {
                            id: name.clone(),
                            name: if desc.is_empty() {
                                format!("{} - {}", display_name, name)
                            } else {
                                desc
                            },
                            device_type: shared::AudioDeviceType::Speaker,
                            is_default: !has_default_playback,
                        });
                        has_default_playback = true;
                    }
                    Some(alsa::Direction::Capture) => {
                        devices.push(shared::AudioDevice {
                            id: name.clone(),
                            name: if desc.is_empty() {
                                format!("{} - {}", display_name, name)
                            } else {
                                desc
                            },
                            device_type: shared::AudioDeviceType::Microphone,
                            is_default: !has_default_capture,
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
        });

        devices.push(shared::AudioDevice {
            id: "default".to_string(),
            name: "Default ALSA device".to_string(),
            device_type: shared::AudioDeviceType::Microphone,
            is_default: !has_default_capture,
        });

        devices.push(shared::AudioDevice {
            id: "default".to_string(),
            name: "Default speaker (ringtone)".to_string(),
            device_type: shared::AudioDeviceType::Ringtone,
            is_default: true,
        });

        self.devices = devices;
        Ok(())
    }

    pub fn list_devices(&self) -> Vec<shared::AudioDevice> {
        self.devices.clone()
    }

    pub fn speakers(&self) -> Vec<shared::AudioDevice> {
        self.devices
            .iter()
            .filter(|d| d.device_type == shared::AudioDeviceType::Speaker)
            .cloned()
            .collect()
    }

    pub fn microphones(&self) -> Vec<shared::AudioDevice> {
        self.devices
            .iter()
            .filter(|d| d.device_type == shared::AudioDeviceType::Microphone)
            .cloned()
            .collect()
    }

    pub fn ringtone_devices(&self) -> Vec<shared::AudioDevice> {
        self.devices
            .iter()
            .filter(|d| d.device_type == shared::AudioDeviceType::Ringtone)
            .cloned()
            .collect()
    }

    pub fn set_output(&mut self, device_id: &str) -> Result<(), AudioError> {
        if !self.devices.iter().any(|d| d.id == device_id && d.device_type == shared::AudioDeviceType::Speaker) {
            return Err(AudioError::DeviceNotFound(device_id.to_string()));
        }
        self.output_device = device_id.to_string();
        tracing::info!("Output device set to: {}", device_id);
        Ok(())
    }

    pub fn set_input(&mut self, device_id: &str) -> Result<(), AudioError> {
        if !self.devices.iter().any(|d| d.id == device_id && d.device_type == shared::AudioDeviceType::Microphone) {
            return Err(AudioError::DeviceNotFound(device_id.to_string()));
        }
        self.input_device = device_id.to_string();
        tracing::info!("Input device set to: {}", device_id);
        Ok(())
    }

    pub fn set_ringtone(&mut self, device_id: &str) -> Result<(), AudioError> {
        if !self.devices.iter().any(|d| d.id == device_id && d.device_type == shared::AudioDeviceType::Ringtone) {
            return Err(AudioError::DeviceNotFound(device_id.to_string()));
        }
        self.ringtone_device = device_id.to_string();
        tracing::info!("Ringtone device set to: {}", device_id);
        Ok(())
    }

    pub fn output_device(&self) -> &str {
        &self.output_device
    }

    pub fn input_device(&self) -> &str {
        &self.input_device
    }

    pub fn ringtone_device(&self) -> &str {
        &self.ringtone_device
    }
}

impl Default for AudioDeviceManager {
    fn default() -> Self {
        Self::new()
    }
}
