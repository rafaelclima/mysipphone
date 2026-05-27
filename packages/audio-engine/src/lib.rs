pub mod alsa_backend;
pub mod backend;
pub mod device;
pub mod error;
pub mod ringtone;

pub use alsa_backend::AlsaBackend;
pub use backend::AudioBackend;
pub use device::AudioDeviceManager;
pub use error::AudioError;
pub use ringtone::RingtonePlayer;

use tokio::sync::mpsc;

pub type AudioCommandSender = mpsc::Sender<AudioCommand>;
pub type AudioCommandReceiver = mpsc::Receiver<AudioCommand>;

#[derive(Debug)]
pub enum AudioCommand {
    SetOutputDevice(String),
    SetInputDevice(String),
    SetRingtoneDevice(String),
    ListDevices,
    PlayRingtone,
    StopRingtone,
    StartCallStream,
    StopCallStream,
    SetMute(bool),
    Shutdown,
}

pub struct AudioEngine {
    backend: AlsaBackend,
    device_manager: AudioDeviceManager,
    ringtone: RingtonePlayer,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            backend: AlsaBackend::new(),
            device_manager: AudioDeviceManager::new(),
            ringtone: RingtonePlayer::new(),
        }
    }

    pub fn initialize(&mut self) -> Result<(), AudioError> {
        self.backend.initialize()?;
        self.device_manager.refresh()?;
        tracing::info!(
            "Audio engine initialized with {} devices",
            self.device_manager.list_devices().len()
        );
        Ok(())
    }

    pub fn device_manager(&self) -> &AudioDeviceManager {
        &self.device_manager
    }

    pub fn device_manager_mut(&mut self) -> &mut AudioDeviceManager {
        &mut self.device_manager
    }

    pub fn backend(&self) -> &AlsaBackend {
        &self.backend
    }

    pub fn backend_mut(&mut self) -> &mut AlsaBackend {
        &mut self.backend
    }

    pub fn ringtone(&self) -> &RingtonePlayer {
        &self.ringtone
    }

    pub fn run(mut self, mut rx: AudioCommandReceiver) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            if let Err(e) = self.initialize() {
                tracing::error!("Failed to initialize audio engine: {}", e);
                return;
            }

            while let Some(cmd) = rx.recv().await {
                if let Err(e) = Self::handle_command(&mut self, cmd).await {
                    tracing::error!("Audio command error: {}", e);
                }
            }
        })
    }

    async fn handle_command(engine: &mut AudioEngine, cmd: AudioCommand) -> Result<(), AudioError> {
        match cmd {
            AudioCommand::SetOutputDevice(id) => {
                engine.device_manager.set_output(&id)?;
            }
            AudioCommand::SetInputDevice(id) => {
                engine.device_manager.set_input(&id)?;
            }
            AudioCommand::SetRingtoneDevice(id) => {
                engine.device_manager.set_ringtone(&id)?;
            }
            AudioCommand::ListDevices => {
                engine.device_manager.refresh()?;
                tracing::info!("Devices refreshed: {:?}", engine.device_manager.list_devices());
            }
            AudioCommand::PlayRingtone => {
                engine.ringtone.play()?;
            }
            AudioCommand::StopRingtone => {
                engine.ringtone.stop();
            }
            AudioCommand::StartCallStream => {
                tracing::info!("Call stream started");
            }
            AudioCommand::StopCallStream => {
                tracing::info!("Call stream stopped");
            }
            AudioCommand::SetMute(muted) => {
                engine.backend.set_mute(muted);
            }
            AudioCommand::Shutdown => {
                engine.ringtone.stop();
                tracing::info!("Audio engine shutdown complete");
            }
        }
        Ok(())
    }
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self::new()
    }
}
