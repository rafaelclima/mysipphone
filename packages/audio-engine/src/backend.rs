use crate::error::AudioError;

pub trait AudioBackend: Send {
    fn initialize(&mut self) -> Result<(), AudioError>;
    fn enumerate_devices(&self) -> Result<Vec<shared::AudioDevice>, AudioError>;
    fn set_mute(&mut self, muted: bool);
    fn muted(&self) -> bool;
    fn default_output_device(&self) -> Option<String>;
    fn default_input_device(&self) -> Option<String>;
}
