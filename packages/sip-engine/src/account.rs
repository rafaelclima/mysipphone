#![allow(clippy::missing_safety_doc)]

use crate::events::CallEvent;
use pjsip_sys::*;
use std::collections::{HashMap, HashSet};
use std::ffi::{c_int, CStr, CString};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::mpsc;

static EVENT_TX: OnceLock<Mutex<mpsc::Sender<CallEvent>>> = OnceLock::new();
static ACC_ID_MAP: OnceLock<Mutex<HashMap<i32, String>>> = OnceLock::new();
static ACTIVE_CALLS: OnceLock<Mutex<HashSet<i32>>> = OnceLock::new();
static HUNG_UP_CALLS: OnceLock<Mutex<HashSet<i32>>> = OnceLock::new();
static SOUND_DEV_ID: OnceLock<Mutex<Option<i32>>> = OnceLock::new();

// ── C-callable callbacks (linked by name from helpers.c bridges) ──

#[no_mangle]
static RETRY_COUNT: OnceLock<Mutex<HashMap<i32, u32>>> = OnceLock::new();
static RETRY_TX: OnceLock<Mutex<std::sync::mpsc::Sender<crate::SipCommand>>> = OnceLock::new();

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
    {
        let calls = ACTIVE_CALLS.get_or_init(|| Mutex::new(HashSet::new()));
        if let Ok(mut set) = calls.lock() {
            match state {
                5 => {
                    let was_first = set.is_empty();
                    let _ = set.insert(call_id);
                    if was_first {
                        PjsuaEngine::enable_sound();
                    }
                }
                6 => {
                    let _ = set.remove(&call_id);
                    if set.is_empty() {
                        PjsuaEngine::disable_sound();
                    }
                }
                _ => {}
            }
        }
    }
    let call_state = match state {
        0 => shared::CallState::Idle,
        1 => shared::CallState::Dialing,
        2 => shared::CallState::Ringing,
        3 => shared::CallState::Ringing,
        4 => shared::CallState::Connecting,
        5 => shared::CallState::Connected,
        6 => shared::CallState::Ended,
        _ => return,
    };
    if let Some(tx) = EVENT_TX.get() {
        if let Ok(guard) = tx.lock() {
            let _ = guard.try_send(CallEvent::CallStateChanged {
                account_id: 0,
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

impl PjsuaEngine {
    pub fn start(
        event_tx: mpsc::Sender<CallEvent>,
        cmd_rx: std::sync::mpsc::Receiver<crate::SipCommand>,
    ) -> Arc<Self> {
        let shutdown_flag = Arc::new(AtomicBool::new(false));
        let flag = shutdown_flag.clone();
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
                Self::run_pjsip(thread_tx, cmd_rx2, flag);
            })
            .expect("Failed to spawn pjsip thread");

        Arc::new(Self { shutdown_flag })
    }

    fn run_pjsip(
        event_tx: mpsc::Sender<CallEvent>,
        cmd_rx: std::sync::mpsc::Receiver<crate::SipCommand>,
        shutdown: Arc<AtomicBool>,
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
        let _ = event_tx.blocking_send(CallEvent::EngineStarted);

        while !shutdown.load(Ordering::SeqCst) {
            match cmd_rx.recv_timeout(std::time::Duration::from_millis(500)) {
                Ok(crate::SipCommand::Register(config)) => {
                    Self::register_impl(&event_tx, config);
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
                    let status = unsafe { pjsua_acc_set_registration(acc_id, PJ_TRUE) };
                    if status == PJ_SUCCESS {
                        tracing::info!("RetryRegister success for acc_id={}", acc_id);
                    } else {
                        tracing::warn!("RetryRegister failed for acc_id={}: {}", acc_id, status);
                    }
                }
                Ok(crate::SipCommand::Mute(ref _call_id, ref _muted)) => {
                    tracing::warn!("Mute not yet implemented in pjsip engine");
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

        let mut try_order: Vec<(i32, String)> = Vec::new();
        let mut fallback: Vec<(i32, String)> = Vec::new();

        for i in 0..count {
            let dev = unsafe { &*ptr.add(i as usize) };
            let name = unsafe { CStr::from_ptr(dev.name.as_ptr()) }
                .to_string_lossy();
            let lc = name.to_lowercase();
            eprintln!(
                "  device {}: {} (in={}, out={}, rate={})",
                i,
                name,
                dev.input_count,
                dev.output_count,
                dev.default_samples_per_sec,
            );
            if dev.output_count == 0 && dev.input_count == 0 {
                continue;
            }
            let entry = (i as i32, name.to_string());
            if lc.contains("pch") || lc.contains("hda") || lc.contains("hw:") || lc.contains("plughw:") {
                try_order.insert(0, entry);
            } else if lc.contains("pipewire") || lc.contains("jack") {
                fallback.push(entry);
            } else {
                try_order.push(entry);
            }
        }

        for (idx, name) in try_order.iter().chain(fallback.iter()) {
            let status = unsafe { pjsua_set_snd_dev(*idx, *idx) };
            if status == PJ_SUCCESS {
                tracing::info!("Sound device {}: {} opened successfully", idx, name);
                let store = SOUND_DEV_ID.get_or_init(|| Mutex::new(None));
                if let Ok(mut guard) = store.lock() {
                    *guard = Some(*idx);
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
        let dev_id = SOUND_DEV_ID.get().and_then(|m| {
            m.lock().ok().and_then(|g| {
                let inner = &*g;
                *inner
            })
        });
        if let Some(id) = dev_id {
            let status = unsafe { pjsua_set_snd_dev(id, id) };
            if status == PJ_SUCCESS {
                tracing::info!("Sound device enabled: dev_id={}", id);
            } else {
                tracing::warn!("Failed to enable sound device {}: {}", id, status);
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
                let _ = event_tx.blocking_send(CallEvent::CallStateChanged {
                    account_id: 0,
                    call_id: call_id as i64,
                    state: shared::CallState::Dialing,
                });
                tracing::info!("Call initiated: call_id={}", call_id);
            }
            Err(e) => {
                tracing::error!("Failed to make call: {}", e);
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

    fn answer_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Answering call: {}", cid);
            if let Err(e) = crate::CallManager::answer_raw(cid) {
                tracing::error!("Failed to answer call: {}", e);
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

    fn transfer_impl(_event_tx: &mpsc::Sender<CallEvent>, call_id: &str, target: &str) {
        if let Ok(cid) = call_id.parse::<i32>() {
            tracing::info!("Transferring call {} to {}", cid, target);
            if let Err(e) = crate::CallManager::transfer_raw(cid, target) {
                tracing::error!("Failed to transfer: {}", e);
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

    fn register_impl(event_tx: &mpsc::Sender<CallEvent>, config: shared::AccountConfig) {
        tracing::info!("Registering SIP account: {}", config.sip_uri);

        let id = CString::new(config.sip_uri.as_str()).unwrap();
        let reg_uri = CString::new(config.registrar.as_str()).unwrap();
        let realm = CString::new(config.realm.as_str()).unwrap();
        let username = CString::new(config.username.as_str()).unwrap();
        let password = CString::new(config.password.as_str()).unwrap();

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
            tracing::error!("mysip_account_add failed: status={}", status);
            let _ = event_tx.blocking_send(CallEvent::AccountStateChanged {
                account_id: config.id.clone(),
                state: shared::AccountState::RegistrationFailed,
            });
            return;
        }

        if acc_id >= 0 {
            if let Some(map) = ACC_ID_MAP.get() {
                if let Ok(mut guard) = map.lock() {
                    guard.insert(acc_id, config.id.clone());
                }
            }
        }

        let _ = event_tx.blocking_send(CallEvent::AccountStateChanged {
            account_id: config.id.clone(),
            state: shared::AccountState::Registering,
        });

        tracing::info!("Account registered with acc_id={}", acc_id);
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
        let _ = event_tx.blocking_send(CallEvent::AccountStateChanged {
            account_id,
            state: shared::AccountState::Unregistered,
        });
    }

    pub fn shutdown(&self) {
        self.shutdown_flag.store(true, Ordering::SeqCst);
    }
}
