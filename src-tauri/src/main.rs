#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use audio_engine::AudioEngine;
use sip_engine::SipEngine;
use std::sync::Arc;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::Mutex;
use tokio::sync::mpsc;

mod commands;
mod state;
mod window_utils;

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
    let audio_tx_for_events = audio_cmd_tx.clone();
    let (hotplug_tx, mut hotplug_rx) = mpsc::channel::<()>(16);

    let _sip_engine = SipEngine::new(sip_cmd_rx, call_event_tx.clone());
    let _audio_engine = AudioEngine::new().run(audio_cmd_rx);
    let _ = audio_cmd_tx
        .send(audio_engine::AudioCommand::SetHotplugChannel(hotplug_tx))
        .await;

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

            // Set initial window corner radius (iPhone default = 44px)
            let _ = window_utils::set_corner_radius(44.0);

            tokio::spawn(async move {
                // Extract database Arc once so CallEnded never needs to lock AppState
                let db = {
                    let app = handle.state::<Arc<Mutex<AppState>>>();
                    let app = app.lock().await;
                    app.database.clone()
                };
                let mut heartbeat = tokio::time::interval(tokio::time::Duration::from_secs(5));
                heartbeat.tick().await; // skip first instant
                loop {
                    tokio::select! {
                        event = call_event_rx.recv() => {
                            let Some(event) = event else {
                                tracing::warn!("call_event_rx closed, breaking loop");
                                break;
                            };
                            tracing::info!("EVENT_RX: variant={:?}", std::mem::discriminant(&event));

                            // Handle audio-only events directly (no Tauri emission)
                            let is_audio_event = matches!(&event, sip_engine::CallEvent::PlayRingback | sip_engine::CallEvent::StopRingback);
                            if is_audio_event {
                                match &event {
                                    sip_engine::CallEvent::PlayRingback => {
                                        let _ = audio_tx_for_events.send(audio_engine::AudioCommand::PlayRingback).await;
                                    }
                                    sip_engine::CallEvent::StopRingback => {
                                        let _ = audio_tx_for_events.send(audio_engine::AudioCommand::StopRingback).await;
                                    }
                                    _ => {}
                                }
                                continue;
                            }

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
                                } => {
                                    if state == shared::CallState::Ended {
                                        let app = handle.state::<Arc<Mutex<AppState>>>();
                                        let mut app = app.lock().await;
                                        // Clean up popup label for this call
                                        if app.current_popup_label.as_deref() == Some(&format!("popup-{}", call_id)) {
                                            app.current_popup_label = None;
                                        }
                                        // Clean up incoming call info if it matches
                                        if app.incoming_call_info.as_ref().map(|i| i.call_id) == Some(call_id) {
                                            app.incoming_call_info = None;
                                        }
                                    }
                                    (
                                        "sip:call-state",
                                        serde_json::json!({
                                            "type": "CallStateChanged",
                                            "account_id": account_id,
                                            "call_id": call_id,
                                            "state": state,
                                        }),
                                    )
                                }
                                sip_engine::CallEvent::IncomingCall {
                                    account_id,
                                    call_id,
                                    remote_uri,
                                } => {
                                    // Store call info for popup
                                    let popup_label = format!("popup-{}", call_id);
                                    {
                                        let app = handle.state::<Arc<Mutex<AppState>>>();
                                        let mut app = app.lock().await;

                                        // Close previous popup if any
                                        if let Some(ref old_label) = app.current_popup_label {
                                            if let Some(old_win) = handle.get_webview_window(old_label) {
                                                let _ = old_win.close();
                                            }
                                        }
                                        app.current_popup_label = Some(popup_label.clone());

                                        app.set_incoming_call_info(call_id, remote_uri.clone());
                                    }

                                    // Read device theme from AppState
                                    let theme = {
                                        let app = handle.state::<Arc<Mutex<AppState>>>();
                                        let app = app.lock().await;
                                        app.device_theme.clone()
                                    };

                                    // Create popup with unique label (no label conflict)
                                    let popup_url = format!("/?theme={}", theme);
                                    match WebviewWindowBuilder::new(
                                        &handle,
                                        &popup_label,
                                        WebviewUrl::App(popup_url.into()),
                                    )
                                    .title("")
                                    .inner_size(320.0, 240.0)
                                    .always_on_top(true)
                                    .decorations(false)
                                    .resizable(false)
                                    .skip_taskbar(true)
                                    .build()
                                    {
                                        Ok(popup) => {
                                            if let Some(monitor) = popup.primary_monitor().ok().flatten() {
                                                let size = monitor.size();
                                                let _ = popup.set_position(tauri::PhysicalPosition::new(
                                                    (size.width as f64 - 330.0).max(0.0) as i32,
                                                    10,
                                                ));
                                            }
                                            tracing::info!("Created popup {} for call {}", popup_label, call_id);
                                        }
                                        Err(e) => {
                                            tracing::warn!("Failed to create popup {}: {}", popup_label, e);
                                        }
                                    }

                                    (
                                        "sip:incoming-call",
                                        serde_json::json!({
                                            "type": "IncomingCall",
                                            "account_id": account_id,
                                            "call_id": call_id,
                                            "remote_uri": remote_uri,
                                        }),
                                    )
                                }
                                sip_engine::CallEvent::CallEnded(log_entry) => {
                                    // Save call log in background to avoid blocking event loop
                                    if let Some(ref db) = db {
                                        let db = db.clone();
                                        let entry = log_entry.clone();
                                        tokio::task::spawn_blocking(move || {
                                            if let Err(e) = db.save_call_log(&entry) {
                                                tracing::error!("Failed to save call log: {e}");
                                            } else {
                                                tracing::info!("Call log saved for id={}", entry.id);
                                            }
                                        });
                                    }
                                    ("sip:call-log", serde_json::json!({
                                        "type": "CallEnded",
                                        "entry": log_entry,
                                    }))
                                }
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
                                sip_engine::CallEvent::PlayRingback | sip_engine::CallEvent::StopRingback => {
                                    unreachable!()
                                }
                            };

                            tracing::info!(event_name, payload = %payload, "Emitting Tauri event");
                            let emit_result = handle.emit(event_name, payload);
                            if let Err(e) = emit_result {
                                tracing::error!("emit failed: {}", e);
                            }
                            tracing::info!("emit done");

                            // Check for hotplug changes (non-blocking, no busy loop)
                            loop {
                                match hotplug_rx.try_recv() {
                                    Ok(()) => {
                                        tracing::info!("Audio devices changed, notifying frontend");
                                        let _ = handle.emit("sip:devices-changed", serde_json::json!({
                                            "type": "DeviceListChanged",
                                        }));
                                    }
                                    Err(mpsc::error::TryRecvError::Empty) => break,
                                    Err(mpsc::error::TryRecvError::Disconnected) => break,
                                }
                            }
                        }
                        _ = heartbeat.tick() => {
                            // Check for hotplug changes in heartbeat too
                            loop {
                                match hotplug_rx.try_recv() {
                                    Ok(()) => {
                                        tracing::info!("Audio devices changed, notifying frontend");
                                        let _ = handle.emit("sip:devices-changed", serde_json::json!({
                                            "type": "DeviceListChanged",
                                        }));
                                    }
                                    Err(mpsc::error::TryRecvError::Empty) => break,
                                    Err(mpsc::error::TryRecvError::Disconnected) => break,
                                }
                            }
                            tracing::debug!("event loop heartbeat alive");
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::register_account,
            commands::make_call,
            commands::answer,
            commands::reject,
            commands::hangup,
            commands::hold,
            commands::unhold,
            commands::mute,
            commands::shutdown,
            commands::transfer,
            commands::send_dtmf,
            commands::get_accounts,
            commands::get_active_account,
            commands::get_contacts,
            commands::add_contact,
            commands::delete_contact,
            commands::get_call_history,
            commands::get_audio_devices,
            commands::set_audio_output_device,
            commands::set_audio_input_device,
            commands::set_audio_ringtone_device,
            commands::play_ringtone,
            commands::stop_ringtone,
            commands::play_test_tone,
            commands::set_audio_mute,
            commands::get_incoming_call_info,
            commands::set_window_corner_radius,
            commands::set_device_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
