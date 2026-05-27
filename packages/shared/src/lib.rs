use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CallState {
    Idle,
    Dialing,
    Ringing,
    Connecting,
    Connected,
    Held,
    Ended,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CallDirection {
    Outgoing,
    Incoming,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountState {
    Unregistered,
    Registering,
    Registered,
    RegistrationFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CallEndReason {
    LocalHangup,
    RemoteHangup,
    Busy,
    NoAnswer,
    Rejected,
    NetworkError,
    Timeout,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountConfig {
    pub id: String,
    pub display_name: String,
    pub sip_uri: String,
    pub registrar: String,
    pub username: String,
    pub password: String,
    pub realm: String,
    pub transport: SipTransport,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SipTransport {
    Udp,
    Tcp,
    Tls,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub device_type: AudioDeviceType,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AudioDeviceType {
    Speaker,
    Microphone,
    Ringtone,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallInfo {
    pub id: String,
    pub direction: CallDirection,
    pub state: CallState,
    pub remote_uri: String,
    pub remote_name: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_secs: u64,
    pub end_reason: Option<CallEndReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub sip_uri: String,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallLogEntry {
    pub id: String,
    pub remote_uri: String,
    pub remote_name: String,
    pub direction: CallDirection,
    pub start_time: String,
    pub duration_secs: u64,
    pub end_reason: CallEndReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppEvent {
    CallStateChanged(CallInfo),
    AccountStateChanged(AccountState),
    AudioDeviceChanged(Vec<AudioDevice>),
    IncomingCall(CallInfo),
    Error(String),
}
