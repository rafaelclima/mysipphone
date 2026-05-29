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
    muted: bool,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::SetMute(muted));
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
pub async fn play_test_tone(
    state: State<'_, Arc<Mutex<AppState>>>,
    device_id: String,
) -> Result<(), String> {
    let app = state.lock().await;
    app.send_audio_command(AudioCommand::PlayTestTone(device_id));
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
