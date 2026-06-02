use serde::{Deserialize, Serialize};
use shared::{AccountState, CallState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CallEvent {
    EngineStarted,
    AccountStateChanged {
        account_id: String,
        state: AccountState,
    },
    CallStateChanged {
        account_id: i32,
        call_id: i64,
        state: CallState,
    },
    IncomingCall {
        account_id: i32,
        call_id: i64,
        remote_uri: String,
    },

    PlayRingback,
    StopRingback,
    Error {
        call_id: Option<String>,
        message: String,
    },
    CallEnded(shared::CallLogEntry),
}
