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
    PlayTestTone(String),
    SetHotplugChannel(mpsc::Sender<()>),
    Shutdown,
}

pub struct AudioEngine {
    backend: AlsaBackend,
    device_manager: AudioDeviceManager,
    ringtone: RingtonePlayer,
    hotplug_tx: Option<mpsc::Sender<()>>,
    device_snapshot: Vec<shared::AudioDevice>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            backend: AlsaBackend::new(),
            device_manager: AudioDeviceManager::new(),
            ringtone: RingtonePlayer::new(),
            hotplug_tx: None,
            device_snapshot: Vec::new(),
        }
    }

    pub fn initialize(&mut self) -> Result<(), AudioError> {
        self.backend.initialize()?;
        self.device_manager.refresh()?;
        self.device_snapshot = self.device_manager.list_devices();
        tracing::info!(
            "Audio engine initialized with {} devices",
            self.device_snapshot.len()
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

            let mut poll_interval = tokio::time::interval(std::time::Duration::from_secs(5));
            poll_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                tokio::select! {
                    cmd = rx.recv() => {
                        match cmd {
                            Some(cmd) => {
                                if let Err(e) = Self::handle_command(&mut self, cmd).await {
                                    tracing::error!("Audio command error: {}", e);
                                }
                            }
                            None => break,
                        }
                    }
                    _ = poll_interval.tick() => {
                        self.check_hotplug();
                    }
                }
            }
        })
    }

    fn check_hotplug(&mut self) {
        let old_snapshot = std::mem::take(&mut self.device_snapshot);
        let ok = Self::suppress_alsa(|| self.device_manager.refresh()).is_ok();
        if !ok {
            self.device_snapshot = old_snapshot;
            return;
        }
        self.device_snapshot = self.device_manager.list_devices();
        if self.device_snapshot != old_snapshot {
            tracing::info!("Audio devices changed: {} -> {}", old_snapshot.len(), self.device_snapshot.len());
            if let Some(ref tx) = self.hotplug_tx {
                let _ = tx.try_send(());
            }
        }
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
            AudioCommand::PlayTestTone(device) => {
                let _ = RingtonePlayer::play_test_tone(&device);
            }
            AudioCommand::SetHotplugChannel(tx) => {
                engine.hotplug_tx = Some(tx);
            }
            AudioCommand::Shutdown => {
                engine.ringtone.stop();
                tracing::info!("Audio engine shutdown complete");
            }
        }
        Ok(())
    }

    fn suppress_alsa<F, R>(f: F) -> R
    where
        F: FnOnce() -> R,
    {
        #[cfg(target_os = "linux")]
        unsafe {
            let saved = libc::dup(2);
            if saved >= 0 {
                let null_fd = libc::open(
                    c"/dev/null".as_ptr(),
                    libc::O_WRONLY,
                );
                if null_fd >= 0 {
                    libc::dup2(null_fd, 2);
                    libc::close(null_fd);
                    let result = f();
                    libc::dup2(saved, 2);
                    libc::close(saved);
                    return result;
                }
                libc::close(saved);
            }
        }
        f()
    }
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self::new()
    }
}
