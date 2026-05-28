use thiserror::Error;

#[derive(Error, Debug)]
pub enum AudioError {
    #[error("ALSA error: {0}")]
    AlsaError(String),

    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Stream error: {0}")]
    StreamError(String),

    #[error("Engine not initialized")]
    NotInitialized,

    #[error("Ringtone error: {0}")]
    RingtoneError(String),

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
}

impl From<alsa::Error> for AudioError {
    fn from(err: alsa::Error) -> Self {
        AudioError::AlsaError(err.to_string())
    }
}
