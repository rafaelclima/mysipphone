use pjsip_sys::*;
use std::ffi::CString;

pub struct CallManager;

impl CallManager {
    pub fn new() -> Self {
        Self
    }

    pub fn make_call_raw(acc_id: i32, uri: &str) -> Result<i32, crate::SipError> {
        let uri_c = CString::new(uri).map_err(|e| crate::SipError::InvalidUri(e.to_string()))?;
        let mut call_id: std::ffi::c_int = -1;
        let status = unsafe {
            mysip_make_call(acc_id, uri_c.as_ptr(), &raw mut call_id)
        };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(call_id as i32)
    }

    pub fn hangup_raw(call_id: i32) -> Result<(), crate::SipError> {
        let status = unsafe { mysip_call_hangup(call_id) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }

    pub fn answer_raw(call_id: i32) -> Result<(), crate::SipError> {
        let status = unsafe { mysip_call_answer(call_id, 200) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }

    pub fn reject_raw(call_id: i32) -> Result<(), crate::SipError> {
        let status = unsafe { mysip_call_answer(call_id, 486) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }

    pub fn set_hold_raw(call_id: i32) -> Result<(), crate::SipError> {
        let status = unsafe { mysip_call_set_hold(call_id) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }

    pub fn unhold_raw(call_id: i32) -> Result<(), crate::SipError> {
        let status = unsafe { mysip_call_unhold(call_id) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }

    pub fn dial_dtmf_raw(call_id: i32, digits: &str) -> Result<(), crate::SipError> {
        let digits_c = CString::new(digits).map_err(|e| crate::SipError::InvalidDtmf(e.to_string()))?;
        let status = unsafe { mysip_call_dial_dtmf(call_id, digits_c.as_ptr()) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }

    pub fn transfer_raw(call_id: i32, target: &str) -> Result<(), crate::SipError> {
        let target_c = CString::new(target).map_err(|e| crate::SipError::InvalidUri(e.to_string()))?;
        let status = unsafe { mysip_call_xfer(call_id, target_c.as_ptr()) };
        if status != 0 {
            return Err(crate::SipError::CallFailed(status));
        }
        Ok(())
    }
}

impl Default for CallManager {
    fn default() -> Self {
        Self::new()
    }
}
