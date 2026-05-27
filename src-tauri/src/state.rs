use audio_engine::AudioCommandSender;
use sip_engine::{CallEventSender, SipCommandSender};

pub struct AppState {
    pub sip_cmd_tx: SipCommandSender,
    pub audio_cmd_tx: AudioCommandSender,
    pub call_event_tx: CallEventSender,
    pub database: Option<persistence::Database>,
}

impl AppState {
    pub fn new(
        sip_cmd_tx: SipCommandSender,
        audio_cmd_tx: AudioCommandSender,
        call_event_tx: CallEventSender,
    ) -> Self {
        let database = persistence::Database::open_in_memory().ok();
        Self {
            sip_cmd_tx,
            audio_cmd_tx,
            call_event_tx,
            database,
        }
    }

    pub fn send_command(&self, cmd: sip_engine::SipCommand) {
        let _ = self.sip_cmd_tx.send(cmd);
    }

    pub fn send_audio_command(&self, cmd: audio_engine::AudioCommand) {
        let tx = self.audio_cmd_tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(cmd).await;
        });
    }
}
