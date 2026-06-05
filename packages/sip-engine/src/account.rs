#![allow(clippy::missing_safety_doc)]

use crate::error::SipError;
use crate::events::CallEvent;
use pjsip_sys::*;
use std::collections::{HashMap, HashSet};
use std::ffi::{c_int, CStr, CString};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::mpsc;

// ── pjsip invite session states (PJSIP_INV_STATE_*) ──
const INV_STATE_NULL: c_int = 0;
const INV_STATE_CALLING: c_int = 1;
const INV_STATE_INCOMING: c_int = 2;
const INV_STATE_EARLY: c_int = 3;
const INV_STATE_CONNECTING: c_int = 4;
const INV_STATE_CONFIRMED: c_int = 5;
const INV_STATE_DISCONNECTED: c_int = 6;

static EVENT_TX: OnceLock<Mutex<mpsc::Sender<CallEvent>>> = OnceLock::new();
static ACC_ID_MAP: OnceLock<Mutex<HashMap<i32, String>>> = OnceLock::new();
static CALL_ACC_MAP: OnceLock<Mutex<HashMap<i32, i32>>> = OnceLock::new();
static ACTIVE_CALLS: OnceLock<Mutex<HashSet<i32>>> = OnceLock::new();
static HUNG_UP_CALLS: OnceLock<Mutex<HashSet<i32>>> = OnceLock::new();
static SOUND_DEV_ID: OnceLock<Mutex<Option<(i32, i32)>>> = OnceLock::new();
static OUTGOING_CALLS: OnceLock<Mutex<HashSet<i32>>> = OnceLock::new();
static PJSIP_DEVICES: OnceLock<Mutex<Vec<PjsipDeviceInfo>>> = OnceLock::new();

/// Information about a single pjsip sound device, captured at engine startup.
/// `input_count`/`output_count` reflect the device's pjsip capability (0 means
/// the device cannot be used for that direction). Used by the frontend to
/// filter Speaker (output>0) vs Microphone (input>0) selectors and to drive
/// independent capture/playback routing via `pjsua_set_snd_dev(capture, playback)`.
#[derive(Debug, Clone)]
pub struct PjsipDeviceInfo {
    pub idx: i32,
    pub name: String,
    pub input_count: u32,
    pub output_count: u32,
    pub default_samples_per_sec: u32,
}

static SHUTDOWN_DONE: OnceLock<Arc<AtomicBool>> = OnceLock::new();

// ── C-callable callbacks (linked by name from helpers.c bridges) ──

static RETRY_COUNT: OnceLock<Mutex<HashMap<i32, u32>>> = OnceLock::new();
static RETRY_TX: OnceLock<Mutex<std::sync::mpsc::Sender<crate::SipCommand>>> = OnceLock::new();
static LAST_RETRY_TIME: OnceLock<Mutex<HashMap<i32, std::time::Instant>>> = OnceLock::new();

pub fn set_retry_command_tx(tx: std::sync::mpsc::Sender<crate::SipCommand>) {
    let _ = RETRY_TX.set(Mutex::new(tx));
}

#[no_mangle]
pub unsafe extern "C" fn rust_on_reg_state2(
    acc_id: pjsua_acc_id,
    info: *mut pjsua_reg_info,
) {
    let account_id = ACC_ID_MAP
        .get()
        .and_then(|m| m.lock().ok())
        .and_then(|guard| guard.get(&acc_id).cloned())
        .unwrap_or_else(|| format!("{}", acc_id));
    let code = mysip_reg_info_get_code(info);
    tracing::info!("Registration state: acc_id={}, code={}", acc_id, code);
    if (200..300).contains(&code) {
        let _ = RETRY_COUNT.get_or_init(|| Mutex::new(HashMap::new())).lock().map(|mut m| m.remove(&acc_id));
        if let Some(tx) = EVENT_TX.get() {
            if let Ok(guard) = tx.lock() {
                let _ = guard.try_send(CallEvent::AccountStateChanged {
                    account_id,
                    state: shared::AccountState::Registered,
                });
            }
        }
    } else if code > 0 {
        if let Some(tx) = EVENT_TX.get() {
            if let Ok(guard) = tx.lock() {
                let _ = guard.try_send(CallEvent::AccountStateChanged {
                    account_id: account_id.clone(),
                    state: shared::AccountState::RegistrationFailed,
                });
            }
        }
        let attempts = RETRY_COUNT.get_or_init(|| Mutex::new(HashMap::new())).lock().map(|mut m| {
            let n = m.entry(acc_id).or_insert(0);
            *n += 1;
            *n
        }).unwrap_or(1);
        let delay_ms = std::cmp::min(1000 * (1 << std::cmp::min(attempts, 6)), 60000);
        tracing::info!("Registration failed (code={}), retry #{} in {}ms", code, attempts, delay_ms);
        if let Some(tx) = RETRY_TX.get().and_then(|m| m.lock().ok()) {
            let cmd_tx = tx.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                let _ = cmd_tx.send(crate::SipCommand::RetryRegister(acc_id));
            });
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rust_on_incoming_call(
    acc_id: c_int,
    call_id: c_int,
) {
    tracing::info!("rust_on_incoming_call: acc_id={}, call_id={}", acc_id, call_id);

    if let Some(map) = CALL_ACC_MAP.get() {
        if let Ok(mut guard) = map.lock() {
            guard.insert(call_id, acc_id);
        }
    }

    let mut buf = [0i8; 512];
    let remote_uri = if mysip_call_get_remote_uri(call_id, buf.as_mut_ptr(), 512) == 0 {
        CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned()
    } else {
        String::new()
    };
    if let Some(tx) = EVENT_TX.get() {
        if let Ok(guard) = tx.lock() {
            let result = guard.try_send(CallEvent::IncomingCall {
                account_id: acc_id,
                call_id: call_id as i64,
                remote_uri,
            });
            if let Err(e) = result {
                tracing::error!("try_send failed for incoming call {}: {:?}", call_id, e);
            }
        } else {
            tracing::error!("EVENT_TX lock failed for incoming call {}", call_id);
        }
    } else {
        tracing::error!("EVENT_TX not initialized for incoming call {}", call_id);
    }
}

#[no_mangle]
pub unsafe extern "C" fn rust_on_call_state(
    call_id: c_int,
    state: c_int,
) {
    tracing::info!("rust_on_call_state: call_id={}, state={}", call_id, state);
    let mut was_outgoing = false;
    {
        let calls = ACTIVE_CALLS.get_or_init(|| Mutex::new(HashSet::new()));
        if let Ok(mut set) = calls.lock() {
            match state {
                INV_STATE_CONFIRMED => {
                    let was_first = set.is_empty();
                    let _ = set.insert(call_id);
                    if was_first {
                        PjsuaEngine::enable_sound();
                    }
                }
                INV_STATE_DISCONNECTED => {
                    let _ = set.remove(&call_id);
                    if set.is_empty() {
                        PjsuaEngine::disable_sound();
                    }
                }
                _ => {}
            }
        }
    }
    {
        let outgoing = OUTGOING_CALLS.get_or_init(|| Mutex::new(HashSet::new()));
        if let Ok(mut set) = outgoing.lock() {
            match state {
                INV_STATE_CALLING => {
                    let _ = set.insert(call_id);
                }
                INV_STATE_EARLY => {
                    was_outgoing = set.contains(&call_id);
                }
                _ => {}
            }
            if state == INV_STATE_CONFIRMED || state == INV_STATE_DISCONNECTED {
                was_outgoing = set.remove(&call_id);
            }
        }
    }
    let call_state = match state {
        INV_STATE_NULL => shared::CallState::Idle,
        INV_STATE_CALLING => shared::CallState::Dialing,
        INV_STATE_INCOMING => shared::CallState::Ringing,
        INV_STATE_EARLY => shared::CallState::Ringing,
        INV_STATE_CONNECTING => shared::CallState::Connecting,
        INV_STATE_CONFIRMED => shared::CallState::Connected,
        INV_STATE_DISCONNECTED => shared::CallState::Ended,
        _ => return,
    };
    if state == INV_STATE_EARLY && was_outgoing {
        if let Some(tx) = EVENT_TX.get() {
            if let Ok(guard) = tx.lock() {
                let _ = guard.try_send(CallEvent::PlayRingback);
            }
        }
    }
    if (state == INV_STATE_CONNECTING || state == INV_STATE_CONFIRMED || state == INV_STATE_DISCONNECTED) && was_outgoing {
        if let Some(tx) = EVENT_TX.get() {
            if let Ok(guard) = tx.lock() {
                let _ = guard.try_send(CallEvent::StopRingback);
            }
        }
    }

    let account_id = CALL_ACC_MAP
        .get()
        .and_then(|m| m.lock().ok())
        .and_then(|guard| guard.get(&call_id).copied())
        .unwrap_or(0);

    if let Some(tx) = EVENT_TX.get() {
        if let Ok(guard) = tx.lock() {
            let _ = guard.try_send(CallEvent::CallStateChanged {
                account_id,
                call_id: call_id as i64,
                state: call_state.clone(),
            });
        }
    }
    if call_state == shared::CallState::Ended {
        let remote_uri = {
            let mut buf = [0i8; 512];
            if mysip_call_get_remote_uri(call_id, buf.as_mut_ptr(), 512) == 0 {
                CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned()
            } else {
                String::new()
            }
        };
        let mut duration_secs: u32 = 0;
        mysip_call_get_duration(call_id, &mut duration_secs as *mut u32);
        let is_incoming = mysip_call_is_incoming(call_id);
        let direction = if is_incoming == 1 {
            shared::CallDirection::Incoming
        } else {
            shared::CallDirection::Outgoing
        };
        let last_status = mysip_call_get_last_status(call_id);
        let was_local = HUNG_UP_CALLS.get().and_then(|m| m.lock().ok()).map(|mut set| set.remove(&call_id)).unwrap_or(false);
        let end_reason = if was_local {
            shared::CallEndReason::LocalHangup
        } else {
            match last_status {
                486 | 600 => shared::CallEndReason::Busy,
                408 | 487 => shared::CallEndReason::NoAnswer,
                603 => shared::CallEndReason::Rejected,
                480 => shared::CallEndReason::NoAnswer,
                _ => shared::CallEndReason::RemoteHangup,
            }
        };
        let start_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        if let Some(tx) = EVENT_TX.get() {
            if let Ok(guard) = tx.lock() {
                let id = format!("call_{}_{}", call_id, chrono::Local::now().format("%Y%m%d%H%M%S%3f"));
                let _ = guard.try_send(CallEvent::CallEnded(shared::CallLogEntry {
                    id,
                    remote_uri: remote_uri.clone(),
                    remote_name: String::new(),
                    direction,
                    start_time,
                    duration_secs: duration_secs as u64,
                    end_reason,
                }));
            }
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rust_on_call_media_state(
    call_id: c_int,
) {
    tracing::info!("Call media state changed: call_id={}", call_id);
    let status = mysip_call_connect_media(call_id);
    if status == 0 {
        tracing::info!("Call media connected: call_id={}", call_id);
    } else {
        tracing::warn!("Call media connect failed: call_id={}, status={}", call_id, status);
    }
}

pub struct PjsuaEngine {
    shutdown_flag: Arc<AtomicBool>,
}

pub fn is_shutdown_complete() -> bool {
    SHUTDOWN_DONE
        .get()
        .map(|d| d.load(Ordering::SeqCst))
        .unwrap_or(false)
}

/// Returns the list of pjsip sound devices enumerated at engine startup.
/// Each entry exposes the pjsip device index (expected by `pjsua_set_snd_dev`
/// and by `SipCommand::SetAudioDevice`) plus the device's input/output capability
/// and default sample rate. Callers can use the capability fields to filter
/// Speaker (output_count > 0) vs Microphone (input_count > 0) lists.
pub fn get_pjsip_devices() -> Vec<PjsipDeviceInfo> {
    PJSIP_DEVICES
        .get()
        .and_then(|m| m.lock().ok())
        .map(|guard| guard.clone())
        .unwrap_or_default()
}

/// Returns the indices of the sound devices currently in use by pjsip
/// (`capture_dev`, `playback_dev`). Used by the frontend to pre-populate the
/// Speaker/Microphone selectors with the device that is actually active
/// (otherwise the user would see a list of devices with none selected, even
/// though audio is already routed through a specific pjsip index).
///
/// Returns `None` if pjsip hasn't been initialized yet or no sound device is
/// currently open.
pub fn get_pjsip_current_snd_dev() -> Option<(i32, i32)> {
    let mut capture: c_int = -1;
    let mut playback: c_int = -1;
    let status = unsafe { pjsua_get_snd_dev(&raw mut capture, &raw mut playback) };
    if status != PJ_SUCCESS || capture < 0 || playback < 0 {
        return None;
    }
    Some((capture, playback))
}

impl PjsuaEngine {
    pub fn start(
        event_tx: mpsc::Sender<CallEvent>,
        cmd_rx: std::sync::mpsc::Receiver<crate::SipCommand>,
    ) -> Arc<Self> {
        let shutdown_flag = Arc::new(AtomicBool::new(false));
        let flag = shutdown_flag.clone();
        let shutdown_done = Arc::new(AtomicBool::new(false));
        let done = shutdown_done.clone();
        let _ = SHUTDOWN_DONE.set(shutdown_done);
        let thread_tx = event_tx.clone();

        EVENT_TX
            .set(Mutex::new(event_tx))
            .expect("PjsuaEngine already started");
        let _ = ACC_ID_MAP.set(Mutex::new(HashMap::new()));

        let (cmd_tx, cmd_rx2) = std::sync::mpsc::channel::<crate::SipCommand>();
        set_retry_command_tx(cmd_tx.clone());

        std::thread::Builder::new()
            .name("sip-cmd-forward".into())
            .spawn(move || {
                while let Ok(cmd) = cmd_rx.recv() {
                    if cmd_tx.send(cmd).is_err() {
                        break;
                    }
                }
            })
            .expect("Failed to spawn cmd forward thread");

        std::thread::Builder::new()
            .name("pjsip-engine".into())
            .spawn(move || {
                Self::run_pjsip(thread_tx, cmd_rx2, flag, done);
            })
            .expect("Failed to spawn pjsip thread");

        Arc::new(Self { shutdown_flag })
    }

    fn run_pjsip(
        event_tx: mpsc::Sender<CallEvent>,
        cmd_rx: std::sync::mpsc::Receiver<crate::SipCommand>,
        shutdown: Arc<AtomicBool>,
        shutdown_done: Arc<AtomicBool>,
    ) {
        tracing::info!("Starting pjsip engine");

        let status = unsafe { pjsua_create() };
        if status != PJ_SUCCESS {
            tracing::error!("pjsua_create failed: {}", status);
            return;
        }

        let thread_name = CString::new("pjsip-engine").unwrap();
        let mut thread_desc: pj_thread_desc = [0i64; PJ_THREAD_DESC_SIZE];
        let mut thread_handle: *mut std::ffi::c_void = std::ptr::null_mut();
        let reg_status = unsafe {
            pj_thread_register(thread_name.as_ptr(), &mut thread_desc, &mut thread_handle)
        };
        if reg_status == PJ_SUCCESS {
            tracing::debug!("pjsip engine thread registered with pjlib");
        } else {
            tracing::warn!("pjsip engine thread registration failed: {}", reg_status);
        }

        let mut ua_cfg: pjsua_config = unsafe { std::mem::zeroed() };
        let mut log_cfg: pjsua_logging_config = unsafe { std::mem::zeroed() };
        let mut media_cfg: pjsua_media_config = unsafe { std::mem::zeroed() };
        unsafe {
            pjsua_config_default(&mut ua_cfg);
            pjsua_logging_config_default(&mut log_cfg);
            pjsua_media_config_default(&mut media_cfg);
            mysip_init_callbacks(&raw mut ua_cfg);
            mysip_apply_settings(&raw mut ua_cfg, &raw mut log_cfg, &raw mut media_cfg);
        }

        let status = unsafe {
            pjsua_init(
                &raw const ua_cfg,
                &raw const log_cfg,
                &raw const media_cfg,
            )
        };
        if status != PJ_SUCCESS {
            tracing::error!("pjsua_init failed: {}", status);
            unsafe { pjsua_destroy(); }
            return;
        }

        let status = unsafe { pjsua_start() };
        if status != PJ_SUCCESS {
            tracing::error!("pjsua_start failed: {}", status);
            unsafe { pjsua_destroy(); }
            return;
        }

        #[allow(unused_unsafe)]
        let transport_status = unsafe {
            let mut tp_cfg: pjsua_transport_config = std::mem::zeroed();
            pjsua_transport_config_default(&mut tp_cfg);
            tp_cfg.port = 5060;
            let mut tp_id: pjsua_transport_id = -1;
            pjsua_transport_create(PJSIP_TRANSPORT_UDP, &raw const tp_cfg, &mut tp_id)
        };

        if transport_status == PJ_SUCCESS {
            tracing::info!("UDP transport created on port 5060");
        } else {
            tracing::warn!("Port 5060 in use ({}), retrying with auto-assigned port", transport_status);
            let transport_status2 = unsafe {
                let mut tp_cfg: pjsua_transport_config = std::mem::zeroed();
                pjsua_transport_config_default(&mut tp_cfg);
                tp_cfg.port = 0;
                let mut tp_id: pjsua_transport_id = -1;
                pjsua_transport_create(PJSIP_TRANSPORT_UDP, &raw const tp_cfg, &mut tp_id)
            };
            if transport_status2 != PJ_SUCCESS {
                tracing::error!("Failed to create UDP transport on any port: {}", transport_status2);
            }
        }

        Self::configure_sound_device();
        let _ = event_tx.try_send(CallEvent::EngineStarted);

        while !shutdown.load(Ordering::SeqCst) {
            match cmd_rx.recv_timeout(std::time::Duration::from_millis(500)) {
                Ok(crate::SipCommand::Register(config)) => {
                    if let Err(e) = Self::register_impl(&event_tx, config) {
                        tracing::error!("Registration failed: {e}");
                    }
                }
                Ok(crate::SipCommand::Unregister(account_id)) => {
                    Self::unregister_impl(&event_tx, account_id);
                }
                Ok(crate::SipCommand::MakeCall(uri)) => {
                    Self::make_call_impl(&event_tx, &uri);
                }
                Ok(crate::SipCommand::Hangup(call_id)) => {
                    Self::hangup_impl(&event_tx, &call_id);
                }
                Ok(crate::SipCommand::Hold(call_id)) => {
                    Self::hold_impl(&event_tx, &call_id);
                }
                Ok(crate::SipCommand::Unhold(call_id)) => {
                    Self::unhold_impl(&event_tx, &call_id);
                }
                Ok(crate::SipCommand::Transfer(call_id, target)) => {
                    Self::transfer_impl(&event_tx, &call_id, &target);
                }
                Ok(crate::SipCommand::Mute(call_id, muted)) => {
                    if let Ok(cid) = call_id.parse::<c_int>() {
                        let rc = unsafe { mysip_set_mic_mute(cid, muted as c_int) };
                        if rc != 0 {
                            tracing::warn!("mysip_set_mic_mute failed: {}", rc);
                        }
                    }
                }
                Ok(crate::SipCommand::SendDtmf(call_id, digits)) => {
                    Self::send_dtmf_impl(&event_tx, &call_id, &digits);
                }
                Ok(crate::SipCommand::Answer(call_id)) => {
                    Self::answer_impl(&event_tx, &call_id);
                }
                Ok(crate::SipCommand::Reject(call_id)) => {
                    Self::reject_impl(&event_tx, &call_id);
                }
                Ok(crate::SipCommand::RetryRegister(acc_id)) => {
                    // Rate limit: minimum 500ms between retries per account
                    let now = std::time::Instant::now();
                    let last_time = LAST_RETRY_TIME
                        .get_or_init(|| Mutex::new(HashMap::new()))
                        .lock()
                        .ok()
                        .and_then(|mut m| {
                            let last = m.get(&acc_id).copied();
                            m.insert(acc_id, now);
                            last
                        });
                    if let Some(last) = last_time {
                        if now.duration_since(last) < std::time::Duration::from_millis(500) {
                            tracing::debug!("Rate limiting RetryRegister for acc_id={}", acc_id);
                            continue;
                        }
                    }
                    let status = unsafe { pjsua_acc_set_registration(acc_id, PJ_TRUE) };
                    if status == PJ_SUCCESS {
                        tracing::info!("RetryRegister success for acc_id={}", acc_id);
                    } else {
                        tracing::warn!("RetryRegister failed for acc_id={}: {}", acc_id, status);
                    }
                }
                Ok(crate::SipCommand::SetAudioDevice(capture_dev, playback_dev)) => {
                    tracing::info!("Switching audio device: capture={}, playback={}", capture_dev, playback_dev);
                    let status = unsafe { pjsua_set_snd_dev(capture_dev, playback_dev) };
                    if status == PJ_SUCCESS {
                        tracing::info!("Audio device switched successfully");
                        let store = SOUND_DEV_ID.get_or_init(|| Mutex::new(None));
                        if let Ok(mut guard) = store.lock() {
                            *guard = Some((capture_dev, playback_dev));
                        }
                    } else {
                        tracing::warn!("Failed to switch audio device: {}", status);
                    }
                }
                Ok(crate::SipCommand::CreateTlsTransport { port, cert_file, privkey_file, ca_file }) => {
                    tracing::info!("Creating TLS transport on port {}", port);
                    let cert = CString::new(cert_file).unwrap_or_default();
                    let key = CString::new(privkey_file).unwrap_or_default();
                    let ca = CString::new(ca_file).unwrap_or_default();
                    let mut tp_id: c_int = -1;
                    let status = unsafe {
                        mysip_create_tls_transport(
                            port as c_int,
                            cert.as_ptr(),
                            key.as_ptr(),
                            ca.as_ptr(),
                            &raw mut tp_id,
                        )
                    };
                    if status == PJ_SUCCESS {
                        tracing::info!("TLS transport created: id={}", tp_id);
                    } else {
                        tracing::warn!("Failed to create TLS transport: {}", status);
                    }
                }
                Ok(crate::SipCommand::Shutdown) => {
                    shutdown.store(true, Ordering::SeqCst);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    tracing::warn!("Command channel disconnected");
                    break;
                }
            }
        }

        tracing::info!("Shutting down pjsip engine");
        unsafe { pjsua_destroy(); }
        shutdown_done.store(true, Ordering::SeqCst);
    }

    fn configure_sound_device() {
        let max_devs: u32 = 32;
        let mut count = max_devs;
        let layout = std::alloc::Layout::array::<pjmedia_snd_dev_info>(max_devs as usize)
            .expect("valid layout");
        let ptr = unsafe { std::alloc::alloc_zeroed(layout) } as *mut pjmedia_snd_dev_info;
        if ptr.is_null() {
            tracing::error!("Allocation failed, using null device");
            unsafe { pjsua_set_null_snd_dev() };
            return;
        }

        let enum_status = unsafe { pjsua_enum_snd_devs(ptr, &mut count) };
        if enum_status != PJ_SUCCESS || count == 0 {
            unsafe { std::alloc::dealloc(ptr as *mut u8, layout); }
            unsafe { pjsua_set_null_snd_dev() };
            tracing::error!("No sound devices found, using null device");
            return;
        }

        let mut good_devs: Vec<(i32, String)> = Vec::new();
        let mut any_devs: Vec<(i32, String)> = Vec::new();
        let mut all_devs: Vec<PjsipDeviceInfo> = Vec::new();

        for i in 0..count {
            let dev = unsafe { &*ptr.add(i as usize) };
            let name = unsafe { CStr::from_ptr(dev.name.as_ptr()) }
                .to_string_lossy();
            tracing::info!(
                "  device {}: {} (in={}, out={}, rate={})",
                i,
                name,
                dev.input_count,
                dev.output_count,
                dev.default_samples_per_sec,
            );
            let info = PjsipDeviceInfo {
                idx: i as i32,
                name: name.to_string(),
                input_count: dev.input_count,
                output_count: dev.output_count,
                default_samples_per_sec: dev.default_samples_per_sec,
            };
            all_devs.push(info);
            let entry = (i as i32, name.to_string());
            if dev.output_count > 0 || dev.input_count > 0 {
                good_devs.push(entry);
            } else {
                any_devs.push(entry);
            }
        }

        // Store the full pjsip device list for runtime device switching.
        // The list is in the original pjsip enumeration order (by device index).
        let store = PJSIP_DEVICES.get_or_init(|| Mutex::new(Vec::new()));
        if let Ok(mut guard) = store.lock() {
            *guard = all_devs;
        }

        any_devs.reverse();
        good_devs.append(&mut any_devs);

        for (idx, name) in &good_devs {
            let status = unsafe { pjsua_set_snd_dev(*idx, *idx) };
            if status == PJ_SUCCESS {
                tracing::info!("Sound device {}: {} opened successfully", idx, name);
                let store = SOUND_DEV_ID.get_or_init(|| Mutex::new(None));
                if let Ok(mut guard) = store.lock() {
                    *guard = Some((*idx, *idx));
                }
                unsafe { std::alloc::dealloc(ptr as *mut u8, layout); }
                return;
            }
            tracing::warn!("  device {}: {} failed ({})", idx, name, status);
        }

        unsafe { std::alloc::dealloc(ptr as *mut u8, layout); }
        unsafe { pjsua_set_null_snd_dev() };
        tracing::info!("No working sound device found, using null device");
    }

    fn enable_sound() {
        let dev_pair = SOUND_DEV_ID
            .get()
            .and_then(|m| m.lock().ok())
            .and_then(|g| *g);
        if let Some((capture, playback)) = dev_pair {
            let status = unsafe { pjsua_set_snd_dev(capture, playback) };
            if status == PJ_SUCCESS {
                tracing::info!("Sound device enabled: capture={}, playback={}", capture, playback);
            } else {
                tracing::warn!(
                    "Failed to enable sound device (capture={}, playback={}): {}",
                    capture, playback, status
                );
            }
        } else {
            tracing::debug!("No sound device stored, keeping null device");
        }
    }

    fn disable_sound() {
        unsafe { pjsua_set_null_snd_dev() };
        tracing::info!("Sound device disabled (null device)");
    }

    fn make_call_impl(event_tx: &mpsc::Sender<CallEvent>, uri: &str) {
        tracing::info!("Making call to: {}", uri);
        match crate::CallManager::make_call_raw(0, uri) {
            Ok(call_id) => {
                if let Some(map) = CALL_ACC_MAP.get() {
                    if let Ok(mut guard) = map.lock() {
                        guard.insert(call_id, 0);
                    }
                }
                let _ = event_tx.try_send(CallEvent::CallStateChanged {
                    account_id: 0,
                    call_id: call_id as i64,
                    state: shared::CallState::Dialing,
                });
                tracing::info!("Call initiated: call_id={}", call_id);
            }
            Err(e) => {
                tracing::error!("Failed to make call: {}", e);
                let _ = event_tx.try_send(CallEvent::Error {
                    call_id: None,
                    message: format!("Failed to make call: {}", e),
                });
            }
        }
    }

    fn hangup_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            if let Ok(mut set) = HUNG_UP_CALLS.get_or_init(|| Mutex::new(HashSet::new())).lock() {
                set.insert(cid);
            }
            tracing::info!("Hanging up call: {}", cid);
            if let Err(e) = crate::CallManager::hangup_raw(cid) {
                tracing::error!("Failed to hangup: {}", e);
            }
        }
    }

    fn hold_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Holding call: {}", cid);
            if let Err(e) = crate::CallManager::set_hold_raw(cid) {
                tracing::error!("Failed to hold: {}", e);
            }
        }
    }

    fn unhold_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Unholding call: {}", cid);
            if let Err(e) = crate::CallManager::unhold_raw(cid) {
                tracing::error!("Failed to unhold: {}", e);
            }
        }
    }

    fn answer_impl(event_tx: &mpsc::Sender<CallEvent>, call_id: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Answering call: {}", cid);
            if let Err(e) = crate::CallManager::answer_raw(cid) {
                tracing::error!("Failed to answer call: {}", e);
                let _ = event_tx.try_send(CallEvent::Error {
                    call_id: Some(call_id.to_string()),
                    message: format!("Failed to answer call: {}", e),
                });
            }
        }
    }

    fn reject_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Rejecting call: {}", cid);
            if let Err(e) = crate::CallManager::reject_raw(cid) {
                tracing::error!("Failed to reject call (486): {}, trying hangup", e);
                let _ = crate::CallManager::hangup_raw(cid);
            }
        }
    }

    fn transfer_impl(event_tx: &mpsc::Sender<CallEvent>, call_id: &str, target: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Transferring call {} to {}", cid, target);
            if let Err(e) = crate::CallManager::transfer_raw(cid, target) {
                tracing::error!("Failed to transfer: {}", e);
                let _ = event_tx.try_send(CallEvent::Error {
                    call_id: Some(call_id.to_string()),
                    message: format!("Failed to transfer: {}", e),
                });
            }
        }
    }

    fn send_dtmf_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str, digits: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Sending DTMF {} on call {}", digits, cid);
            if let Err(e) = crate::CallManager::dial_dtmf_raw(cid, digits) {
                tracing::error!("Failed to send DTMF: {}", e);
            }
        }
    }

    fn register_impl(event_tx: &mpsc::Sender<CallEvent>, config: shared::AccountConfig) -> Result<(), SipError> {
        tracing::info!("Registering SIP account: {}", config.sip_uri);

        let id = CString::new(config.sip_uri.as_str())
            .map_err(|e| SipError::ConfigNullByte { field: "sip_uri", source: e })?;
        let reg_uri = CString::new(config.registrar.as_str())
            .map_err(|e| SipError::ConfigNullByte { field: "registrar", source: e })?;
        let realm = CString::new(config.realm.as_str())
            .map_err(|e| SipError::ConfigNullByte { field: "realm", source: e })?;
        let username = CString::new(config.username.as_str())
            .map_err(|e| SipError::ConfigNullByte { field: "username", source: e })?;
        let password = CString::new(config.password.as_str())
            .map_err(|e| SipError::ConfigNullByte { field: "password", source: e })?;

        let mut acc_id: std::ffi::c_int = -1;
        let status = unsafe {
            mysip_account_add(
                id.as_ptr(),
                reg_uri.as_ptr(),
                realm.as_ptr(),
                username.as_ptr(),
                password.as_ptr(),
                &raw mut acc_id,
            )
        };

        if status != 0 {
            let _ = event_tx.try_send(CallEvent::AccountStateChanged {
                account_id: config.id.clone(),
                state: shared::AccountState::RegistrationFailed,
            });
            return Err(SipError::RegistrationFailed(format!("mysip_account_add status={}", status)));
        }

        if acc_id >= 0 {
            if let Some(map) = ACC_ID_MAP.get() {
                if let Ok(mut guard) = map.lock() {
                    guard.insert(acc_id, config.id.clone());
                }
            }
        }

        let _ = event_tx.try_send(CallEvent::AccountStateChanged {
            account_id: config.id.clone(),
            state: shared::AccountState::Registering,
        });

        tracing::info!("Account registered with acc_id={}", acc_id);
        Ok(())
    }

    fn unregister_impl(event_tx: &mpsc::Sender<CallEvent>, account_id: String) {
        tracing::info!("Unregistering account: {}", account_id);
        let id: pjsua_acc_id = account_id.parse().unwrap_or(-1);
        if id >= 0 {
            unsafe {
                pjsua_acc_set_registration(id, PJ_FALSE);
                pjsua_acc_del(id);
            }
        }
        let _ = event_tx.try_send(CallEvent::AccountStateChanged {
            account_id,
            state: shared::AccountState::Unregistered,
        });
    }

    pub fn shutdown(&self) {
        self.shutdown_flag.store(true, Ordering::SeqCst);
    }
}
