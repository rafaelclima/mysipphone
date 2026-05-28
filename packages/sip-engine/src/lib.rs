pub mod account;
pub mod call;
pub mod error;
pub mod events;

pub use account::PjsuaEngine;
pub use call::CallManager;
pub use error::SipError;
pub use events::CallEvent;

use std::sync::Arc;
use tokio::sync::mpsc;

pub type SipCommandSender = std::sync::mpsc::Sender<SipCommand>;
pub type SipCommandReceiver = std::sync::mpsc::Receiver<SipCommand>;
pub type CallEventSender = mpsc::Sender<CallEvent>;
pub type CallEventReceiver = mpsc::Receiver<CallEvent>;

#[derive(Debug)]
pub enum SipCommand {
    Register(shared::AccountConfig),
    Unregister(String),
    MakeCall(String),
    Hangup(String),
    Hold(String),
    Unhold(String),
    Mute(String, bool),
    Transfer(String, String),
    SendDtmf(String, String),
    Answer(String),
    Reject(String),
    RetryRegister(i32),
    Shutdown,
}

pub struct SipEngine {
    _engine: Arc<PjsuaEngine>,
}

impl SipEngine {
    pub fn new(command_rx: SipCommandReceiver, event_tx: CallEventSender) -> Self {
        let engine = PjsuaEngine::start(event_tx, command_rx);

        Self { _engine: engine }
    }
}
