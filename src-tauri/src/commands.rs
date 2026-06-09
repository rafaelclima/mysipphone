use audio_engine::AudioCommand;
use shared::{AccountConfig, AudioDevice, Contact};
use sip_engine::SipCommand;
use tauri::State;
use crate::{AppState, state::IncomingCallInfo};
use std::sync::Arc;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn register_account(
    state: State<'_, Arc<Mutex<AppState>>>,
    config: AccountConfig,
) -> Result<(), String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        db.save_account(&config).map_err(|e| e.to_string())?;
    }
    app.send_command(SipCommand::Register(config));
    Ok(())
}

#[tauri::command]
pub async fn make_call(
    state: State<'_, Arc<Mutex<AppState>>>,
    uri: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::MakeCall(uri));
    Ok(())
}

#[tauri::command]
pub async fn answer(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Answer(call_id));
    Ok(())
}

#[tauri::command]
pub async fn reject(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Reject(call_id));
    Ok(())
}

#[tauri::command]
pub async fn hangup(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Hangup(call_id));
    Ok(())
}

#[tauri::command]
pub async fn hold(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Hold(call_id));
    Ok(())
}

#[tauri::command]
pub async fn unhold(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Unhold(call_id));
    Ok(())
}

#[tauri::command]
pub async fn mute(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
    muted: bool,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Mute(call_id, muted));
    Ok(())
}

#[tauri::command]
pub async fn transfer(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
    target: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Transfer(call_id, target));
    Ok(())
}

#[tauri::command]
pub async fn send_dtmf(
    state: State<'_, Arc<Mutex<AppState>>>,
    call_id: String,
    digits: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::SendDtmf(call_id, digits));
    Ok(())
}

#[tauri::command]
pub async fn get_accounts(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<AccountConfig>, String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        db.get_all_accounts().map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn add_contact(
    state: State<'_, Arc<Mutex<AppState>>>,
    contact: Contact,
) -> Result<(), String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        db.save_contact(&contact).map_err(|e| e.to_string())
    } else {
        Err("Database not available".to_string())
    }
}

#[tauri::command]
pub async fn delete_contact(
    state: State<'_, Arc<Mutex<AppState>>>,
    contact_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        db.delete_contact(&contact_id).map_err(|e| e.to_string())
    } else {
        Err("Database not available".to_string())
    }
}

#[tauri::command]
pub async fn get_contacts(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<Contact>, String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        db.get_all_contacts().map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn get_call_history(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<shared::CallLogEntry>, String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        db.get_call_history(100).map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn get_active_account(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Option<AccountConfig>, String> {
    let app = state.lock().await;
    if let Some(ref db) = app.database {
        let accounts = db.get_all_accounts().map_err(|e| e.to_string())?;
        Ok(accounts.into_iter().next())
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn get_incoming_call_info(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Option<IncomingCallInfo>, String> {
    let app = state.lock().await;
    Ok(app.incoming_call_info.clone())
}

#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let mut manager = audio_engine::AudioDeviceManager::new();
    manager.refresh().map_err(|e| e.to_string())?;
    Ok(manager.list_devices())
}

/// Returns the pjsip sound device list for the Speaker/Microphone device
/// selectors. pjsip's device indices are what `SipCommand::SetAudioDevice`
/// expects — not ALSA device names. Each device is reported as `FullDuplex`
/// and exposes `input_count`/`output_count` so the frontend can filter
/// Speaker (output>0) vs Microphone (input>0) lists and route capture/playback
/// independently via `pjsua_set_snd_dev(capture, playback)`.
#[tauri::command]
pub async fn get_pjsip_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let devices = sip_engine::account::get_pjsip_devices();
    Ok(devices
        .into_iter()
        .map(|d| AudioDevice {
            id: d.idx.to_string(),
            name: d.name,
            device_type: shared::AudioDeviceType::FullDuplex,
            is_default: d.idx == 0,
            input_count: d.input_count,
            output_count: d.output_count,
            default_samples_per_sec: d.default_samples_per_sec,
        })
        .collect())
}

#[tauri::command]
pub async fn set_audio_output_device(
    state: State<'_, Arc<Mutex<AppState>>>,
    device_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::SetOutputDevice(device_id));
    Ok(())
}

#[tauri::command]
pub async fn set_audio_input_device(
    state: State<'_, Arc<Mutex<AppState>>>,
    device_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::SetInputDevice(device_id));
    Ok(())
}

#[tauri::command]
pub async fn set_audio_ringtone_device(
    state: State<'_, Arc<Mutex<AppState>>>,
    device_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::SetRingtoneDevice(device_id));
    Ok(())
}

#[tauri::command]
pub async fn play_ringtone(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::PlayRingtone);
    Ok(())
}

#[tauri::command]
pub async fn stop_ringtone(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::StopRingtone);
    Ok(())
}

#[tauri::command]
pub async fn shutdown(
    state: State<'_, Arc<Mutex<AppState>>>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::Shutdown);
    app.send_audio_command(AudioCommand::Shutdown);
    drop(app);

    // Wait up to 5s for pjsip to finish shutdown (unregister, close transports)
    for _ in 0..50 {
        if sip_engine::is_shutdown_complete() {
            tracing::info!("Pjsip engine shutdown complete");
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    app_handle.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn set_audio_mute(
    state: State<'_, Arc<Mutex<AppState>>>,
    muted: bool,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::SetMute(muted));
    Ok(())
}

#[tauri::command]
pub fn set_window_corner_radius(radius: f64) -> Result<(), String> {
    crate::window_utils::set_corner_radius(radius)
}

#[tauri::command]
pub async fn set_device_theme(
    state: State<'_, Arc<Mutex<AppState>>>,
    theme: String,
) -> Result<(), String> {
    let mut app = state.lock().await;
    app.device_theme = theme;
    Ok(())
}

#[tauri::command]
pub async fn set_audio_device(
    state: State<'_, Arc<Mutex<AppState>>>,
    capture_id: i32,
    playback_id: i32,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_command(SipCommand::SetAudioDevice(capture_id, playback_id));
    Ok(())
}

fn validate_cert_path(path: &str) -> Result<String, String> {
    if path.is_empty() {
        return Err("Certificate path is empty".into());
    }
    let p = std::path::Path::new(path);
    let canonical = p.canonicalize().map_err(|_| format!("Invalid path: {}", path))?;
    let allowed = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("mysipphone")
        .join("certs");
    if !canonical.starts_with(&allowed) {
        return Err(format!("Path outside allowed directory: {}", path));
    }
    Ok(canonical.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_tls_transport(
    state: State<'_, Arc<Mutex<AppState>>>,
    port: u16,
    cert_file: String,
    privkey_file: String,
    ca_file: String,
) -> Result<(), String> {
    let cert = validate_cert_path(&cert_file)?;
    let key = validate_cert_path(&privkey_file)?;
    let ca = validate_cert_path(&ca_file)?;
    let app = state.lock().await;
    app.send_command(SipCommand::CreateTlsTransport {
        port,
        cert_file: cert,
        privkey_file: key,
        ca_file: ca,
    });
    Ok(())
}
