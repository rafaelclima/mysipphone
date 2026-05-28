use thiserror::Error;

#[derive(Error, Debug)]
pub enum SipError {
    #[error("SIP registration failed: {0}")]
    RegistrationFailed(String),

    #[error("Call failed: {0}")]
    CallFailed(i32),

    #[error("Account not found: {0}")]
    AccountNotFound(String),

    #[error("Call not found: {0}")]
    CallNotFound(String),

    #[error("pjsip error: {0}")]
    PjsipError(String),

    #[error("Invalid URI: {0}")]
    InvalidUri(String),

    #[error("Invalid DTMF digits: {0}")]
    InvalidDtmf(String),

    #[error("Engine not running")]
    EngineNotRunning,

    #[error("Transport error: {0}")]
    TransportError(String),
}
