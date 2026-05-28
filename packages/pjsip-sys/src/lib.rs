#![allow(non_camel_case_types, non_upper_case_globals, dead_code)]

use std::ffi::{c_int, c_uint, c_void, c_char};

pub type pj_status_t = c_int;
pub type pj_bool_t = c_int;
pub type pjsua_acc_id = c_int;

pub const PJ_TRUE: pj_bool_t = 1;
pub const PJ_FALSE: pj_bool_t = 0;
pub const PJ_SUCCESS: pj_status_t = 0;

pub const PJSUA_ACC_ACC_TYPE: c_uint = 1;

// ── pjsua_create ──

extern "C" {
    pub fn pjsua_create() -> pj_status_t;
}

// Config structs — opaque (fields only written by C code via helpers).
// Keep max_calls/thread_cnt accessible at correct offset for Rust convenience.
// _opaque padding must be large enough to hold the real C struct (~800-1000 bytes).

#[repr(C)]
pub struct pjsua_config {
    pub max_calls: c_uint,
    pub thread_cnt: c_uint,
    _opaque: [u8; 2640],
}

#[repr(C)]
pub struct pjsua_logging_config {
    _opaque: [u8; 2048],
}

#[repr(C)]
pub struct pjsua_media_config {
    _opaque: [u8; 2048],
}

extern "C" {
    pub fn pjsua_config_default(cfg: *mut pjsua_config);
    pub fn pjsua_logging_config_default(cfg: *mut pjsua_logging_config);
    pub fn pjsua_media_config_default(cfg: *mut pjsua_media_config);
}

// ── pjsua_cred_info ──

#[repr(C)]
pub struct pjsua_cred_info {
    pub count: c_uint,
    pub realm: [c_char; 128usize],
    pub scheme: [c_char; 32usize],
    pub username: [c_char; 128usize],
    pub data_type: c_int,
    pub data: [c_char; 128usize],
}

// ── pjsua_acc_config ──

#[repr(C)]
pub struct pjsua_acc_config {
    pub priority: c_int,
    pub acc_type: c_uint,
    pub id: [c_char; 256usize],
    pub reg_uri: [c_char; 256usize],
    pub registrar: [c_char; 256usize],
    pub cred_info: pjsua_cred_info,
    pub credential_count: c_uint,
    pub credentials: [pjsua_cred_info; 4usize],
    pub proxy_cnt: c_uint,
    pub proxy: [[c_char; 256usize]; 4usize],
    pub reg_delay_before_refresh: c_uint,
    pub reg_timeout: c_uint,
    pub reg_retry_interval: c_uint,
    pub reg_first_retry_interval: c_uint,
    pub reg_hdr_delay: c_uint,
    pub unreg_timeout: c_uint,
    pub first_account: pj_bool_t,
    pub publish_enabled: pj_bool_t,
    pub publish_opt: pj_bool_t,
    pub mwi_enabled: pj_bool_t,
    pub publish_on_acc_start: pj_bool_t,
    pub transport_id: c_int,
    pub auth_init: pj_bool_t,
    pub rtp_cfg: c_uint,
    pub lock_codec: pj_bool_t,
    pub drop_calls_on_fail: pj_bool_t,
    pub auto_manage: c_int,
}

extern "C" {
    pub fn pjsua_acc_config_default(cfg: *mut pjsua_acc_config);
}

// ── pjsua_reg_info (used by on_reg_state2 callback) ──

#[repr(C)]
pub struct pjsua_reg_info {
    pub code: pj_status_t,
    pub cbparam: *mut c_void,
    pub is_online: pj_bool_t,
}

// ── Transport ──

pub type pjsua_transport_id = c_int;

pub const PJSIP_TRANSPORT_UNSPECIFIED: c_int = 0;
pub const PJSIP_TRANSPORT_UDP: c_int = 1;
pub const PJSIP_TRANSPORT_TCP: c_int = 2;
pub const PJSIP_TRANSPORT_TLS: c_int = 3;

#[repr(C)]
pub struct pjsua_transport_config {
    pub port: c_uint,
    pub port_range: c_uint,
    pub bound_addr: [c_char; 64usize],
    pub pub_addr: [c_char; 64usize],
    pub tls_setting: *mut c_void,
}

extern "C" {
    pub fn pjsua_transport_config_default(cfg: *mut pjsua_transport_config);
}

extern "C" {
    pub fn pjsua_transport_create(
        pj_ptype: c_int,
        cfg: *const pjsua_transport_config,
        p_id: *mut pjsua_transport_id,
    ) -> pj_status_t;
}

// ── pjsua_init, start, destroy ──

extern "C" {
    pub fn pjsua_init(
        ua_cfg: *const pjsua_config,
        log_cfg: *const pjsua_logging_config,
        media_cfg: *const pjsua_media_config,
    ) -> pj_status_t;
}

extern "C" {
    pub fn pjsua_start() -> pj_status_t;
}

extern "C" {
    pub fn pjsua_destroy() -> pj_status_t;
}

extern "C" {
    pub fn pjsua_destroy2(flags: c_uint) -> pj_status_t;
}

// ── Account management ──

extern "C" {
    pub fn pjsua_acc_add(
        acc_cfg: *const pjsua_acc_config,
        is_default: pj_bool_t,
        p_acc_id: *mut pjsua_acc_id,
    ) -> pj_status_t;
}

extern "C" {
    pub fn pjsua_acc_del(acc_id: pjsua_acc_id) -> pj_status_t;
}

extern "C" {
    pub fn pjsua_acc_modify(
        acc_id: pjsua_acc_id,
        acc_cfg: *const pjsua_acc_config,
    ) -> pj_status_t;
}

extern "C" {
    pub fn pjsua_acc_set_registration(
        acc_id: pjsua_acc_id,
        renew: pj_bool_t,
    ) -> pj_status_t;
}

// ── Calls ──

extern "C" {
    pub fn pjsua_call_reinvite2(
        call_id: c_int,
        opt: *const c_void,
        msg_data: *const c_void,
    ) -> pj_status_t;
    pub fn pjsua_call_get_count() -> c_uint;
}

// ── Sound device info ──

pub const PJMEDIA_AUD_DEV_INFO_NAME_LEN: usize = 128;

#[repr(C)]
pub struct pjmedia_snd_dev_info {
    pub name: [c_char; PJMEDIA_AUD_DEV_INFO_NAME_LEN],
    pub input_count: c_uint,
    pub output_count: c_uint,
    pub default_samples_per_sec: c_uint,
}

extern "C" {
    pub fn pjsua_enum_snd_devs(
        info: *mut pjmedia_snd_dev_info,
        count: *mut c_uint,
    ) -> pj_status_t;
    pub fn pjsua_set_snd_dev(
        capture_dev: c_int,
        playback_dev: c_int,
    ) -> pj_status_t;
    pub fn pjsua_get_snd_dev(
        capture_dev: *mut c_int,
        playback_dev: *mut c_int,
    ) -> pj_status_t;
    pub fn pjsua_set_null_snd_dev() -> pj_status_t;
}

// ── Thread registration ──

pub const PJ_THREAD_DESC_SIZE: usize = 64;
pub type pj_thread_desc = [i64; PJ_THREAD_DESC_SIZE];

extern "C" {
    pub fn pj_thread_register(
        thread_name: *const c_char,
        desc: *mut pj_thread_desc,
        thread: *mut *mut c_void,
    ) -> pj_status_t;
}

// ── Utility ──

extern "C" {
    pub fn pj_status_str(status: pj_status_t) -> *const c_char;
}

extern "C" {
    pub fn pjsua_perror(sender: *const c_char, title: *const c_char, status: pj_status_t);
}

// ── C helpers (src/helpers.c) ──

extern "C" {
    pub fn mysip_account_add(
        id: *const c_char,
        reg_uri: *const c_char,
        realm: *const c_char,
        username: *const c_char,
        password: *const c_char,
        out_acc_id: *mut c_int,
    ) -> c_int;

    pub fn mysip_make_call(
        acc_id: c_int,
        uri: *const c_char,
        out_call_id: *mut c_int,
    ) -> c_int;

    pub fn mysip_call_hangup(call_id: c_int) -> c_int;

    pub fn mysip_call_answer(call_id: c_int, code: c_int) -> c_int;

    pub fn mysip_call_set_hold(call_id: c_int) -> c_int;

    pub fn mysip_call_unhold(call_id: c_int) -> c_int;

    pub fn mysip_call_dial_dtmf(call_id: c_int, digits: *const c_char) -> c_int;

    pub fn mysip_call_xfer(call_id: c_int, target: *const c_char) -> c_int;

    pub fn mysip_call_connect_media(call_id: c_int) -> c_int;

    pub fn mysip_call_get_remote_uri(
        call_id: c_int,
        buf: *mut c_char,
        buf_size: c_int,
    ) -> c_int;

    pub fn mysip_call_get_duration(
        call_id: c_int,
        sec: *mut c_uint,
    ) -> c_int;

    pub fn mysip_call_is_incoming(call_id: c_int) -> c_int;

    pub fn mysip_call_get_last_status(call_id: c_int) -> c_int;

    pub fn mysip_reg_info_get_code(info: *mut pjsua_reg_info) -> c_int;

    pub fn mysip_init_callbacks(cfg: *mut pjsua_config) -> c_int;

    pub fn mysip_apply_settings(
        cfg: *mut pjsua_config,
        log_cfg: *mut pjsua_logging_config,
        media_cfg: *mut pjsua_media_config,
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_struct_sizes() {
        assert_eq!(std::mem::size_of::<pjsua_config>(), 2648,
            "pjsua_config size mismatch: update _opaque padding");
        assert_eq!(std::mem::size_of::<pjsua_media_config>(), 2048,
            "pjsua_media_config size mismatch");
        assert_eq!(std::mem::size_of::<pjsua_logging_config>(), 2048,
            "pjsua_logging_config size mismatch");
    }
}
