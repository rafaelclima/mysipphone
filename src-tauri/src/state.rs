use audio_engine::AudioCommandSender;
use serde::Serialize;
use sip_engine::{CallEventSender, SipCommandSender};

#[derive(Debug, Clone, Serialize)]
pub struct IncomingCallInfo {
    pub call_id: i64,
    pub remote_uri: String,
}

pub struct AppState {
    pub sip_cmd_tx: SipCommandSender,
    pub audio_cmd_tx: AudioCommandSender,
    pub call_event_tx: CallEventSender,
    pub database: Option<std::sync::Arc<persistence::Database>>,
    pub incoming_call_info: Option<IncomingCallInfo>,
    pub current_popup_label: Option<String>,
    pub device_theme: String,
}

impl AppState {
    pub fn new(
        sip_cmd_tx: std::sync::mpsc::Sender<sip_engine::SipCommand>,
        audio_cmd_tx: tokio::sync::mpsc::Sender<audio_engine::AudioCommand>,
        call_event_tx: tokio::sync::mpsc::Sender<sip_engine::CallEvent>,
    ) -> Self {
        let db_dir = dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
            .join("mysipphone");
        std::fs::create_dir_all(&db_dir).ok();
        let db_path = db_dir.join("mysipphone.db");
        let db_path_str = db_path.to_string_lossy().to_string();
        let database = match persistence::Database::open(&db_path_str) {
            Ok(db) => {
                tracing::info!("Database opened at {}", db_path_str);
                Some(std::sync::Arc::new(db))
            }
            Err(e) => {
                tracing::error!("Failed to open database at {}: {}", db_path_str, e);
                None
            }
        };
        Self {
            sip_cmd_tx,
            audio_cmd_tx,
            call_event_tx,
            database,
            incoming_call_info: None,
            current_popup_label: None,
            device_theme: "iphone".to_string(),
        }
    }

    pub fn set_incoming_call_info(&mut self, call_id: i64, remote_uri: String) {
        self.incoming_call_info = Some(IncomingCallInfo { call_id, remote_uri });
    }

    pub fn clear_incoming_call_info(&mut self) {
        self.incoming_call_info = None;
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
