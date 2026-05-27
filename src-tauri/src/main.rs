#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use audio_engine::AudioEngine;
use sip_engine::SipEngine;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tokio::sync::mpsc;

mod commands;
mod state;

pub use state::AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mysipphone=debug,sip_engine=info,audio_engine=info".into()),
        )
        .init();

    let (sip_cmd_tx, sip_cmd_rx) = std::sync::mpsc::channel::<sip_engine::SipCommand>();
    let (call_event_tx, mut call_event_rx) = mpsc::channel::<sip_engine::CallEvent>(256);
    let (audio_cmd_tx, audio_cmd_rx) = mpsc::channel::<audio_engine::AudioCommand>(256);

    let _sip_engine = SipEngine::new(sip_cmd_rx, call_event_tx.clone());
    let _audio_engine = AudioEngine::new().run(audio_cmd_rx);

    let app_state = Arc::new(Mutex::new(AppState::new(
        sip_cmd_tx,
        audio_cmd_tx,
        call_event_tx,
    )));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .setup(move |app| {
            let handle = app.handle().clone();

            #[cfg(debug_assertions)]
            {
                if let Some(window) = handle.get_webview_window("main") {
                    #[allow(clippy::let_unit_value)]
                    let _ = window.open_devtools();
                }
            }

            tokio::spawn(async move {
                use tauri::Emitter;
                while let Some(event) = call_event_rx.recv().await {
                    let (event_name, payload) = match event {
                        sip_engine::CallEvent::EngineStarted => (
                            "sip:engine-started",
                            serde_json::json!({ "type": "EngineStarted" }),
                        ),
                        sip_engine::CallEvent::AccountStateChanged {
                            account_id,
                            state,
                        } => (
                            "sip:account-state",
                            serde_json::json!({
                                "type": "AccountStateChanged",
                                "account_id": account_id,
                                "state": state,
                            }),
                        ),
                        sip_engine::CallEvent::CallStateChanged {
                            account_id,
                            call_id,
                            state,
                        } => (
                            "sip:call-state",
                            serde_json::json!({
                                "type": "CallStateChanged",
                                "account_id": account_id,
                                "call_id": call_id,
                                "state": state,
                            }),
                        ),
                        sip_engine::CallEvent::IncomingCall {
                            account_id,
                            call_id,
                        } => (
                            "sip:incoming-call",
                            serde_json::json!({
                                "type": "IncomingCall",
                                "account_id": account_id,
                                "call_id": call_id,
                            }),
                        ),
                        sip_engine::CallEvent::DtmfReceived { call_id, digit } => (
                            "sip:dtmf",
                            serde_json::json!({
                                "type": "DtmfReceived",
                                "call_id": call_id,
                                "digit": digit,
                            }),
                        ),
                        sip_engine::CallEvent::Error {
                            call_id,
                            message,
                        } => (
                            "sip:error",
                            serde_json::json!({
                                "type": "Error",
                                "call_id": call_id,
                                "message": message,
                            }),
                        ),
                    };

                    tracing::info!(event_name, payload = %payload, "Emitting Tauri event");
                    let _ = handle.emit(event_name, payload);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::register_account,
            commands::make_call,
            commands::hangup,
            commands::hold,
            commands::unhold,
            commands::mute,
            commands::transfer,
            commands::send_dtmf,
            commands::get_accounts,
            commands::get_contacts,
            commands::get_call_history,
            commands::get_audio_devices,
            commands::set_audio_output_device,
            commands::set_audio_input_device,
            commands::set_audio_ringtone_device,
            commands::play_ringtone,
            commands::stop_ringtone,
            commands::set_audio_mute,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
