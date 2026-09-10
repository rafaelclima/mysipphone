//! Automatic Bluetooth headset profile switching (A2DP ↔ HSP/HFP).
//!
//! WirePlumber is *supposed* to move a Bluetooth card from the music-only
//! `a2dp-sink` profile to a microphone-capable `headset-head-unit` (HSP/HFP)
//! profile when an app starts capturing, and restore it afterwards
//! (`autoswitch-bluetooth-profile.lua`). In practice that trigger only fires
//! when the capture reaches PipeWire as a `Stream/Input/Audio` linked to the
//! internal `bluez_input` loopback node, which pjsip's ALSA backend does not
//! reliably produce — and after regressions such as WirePlumber 0.5.15 → 0.17
//! the card can stay stuck in A2DP (with endless
//! `Failure in Bluetooth audio transport` errors), leaving the headset
//! microphone unusable during calls.
//!
//! This module restores the expected phone behaviour deterministically:
//! - [`on_call_ringing`] (phone ringing, either direction) starts the switch
//!   early on a detached thread, giving SCO time to connect while the user
//!   decides to answer.
//! - [`on_call_audio_started`] (first call answered) switches **synchronously**
//!   and MUST be called BEFORE `pjsua_set_snd_dev` opens the ALSA handles:
//!   switching after the open leaves pjsip holding handles bound to the
//!   vanished A2DP nodes (dead audio in both directions).
//! - [`on_call_audio_stopped`] (last call ended) restores the saved profiles
//!   on a detached thread, after the sound device is nulled.
//!
//! The pjsip engine thread is only ever blocked by the two fast `pactl`
//! invocations of the synchronous switch (~100-300ms, comparable to the ALSA
//! open itself). Every failure degrades gracefully
//! to a `tracing::warn!` — the call itself always proceeds.

use std::collections::HashMap;
use std::process::Command;
use std::sync::{Mutex, OnceLock};

/// Profiles active before the call, saved at call start and restored at call
/// end. Keyed by card name (`bluez_card.*`).
static SAVED_PROFILES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

/// Preferred headset profiles, best codec first (mSBC, then CVSD).
const HEADSET_CANDIDATES: [&str; 2] = ["headset-head-unit", "headset-head-unit-cvsd"];

#[derive(Debug, thiserror::Error)]
pub enum BluetoothError {
    #[error("failed to run {0}: {1}")]
    Spawn(String, #[source] std::io::Error),
    #[error("`{0}` timed out")]
    Timeout(String),
    #[error("`{0}` exited with status {1}: {2}")]
    Status(String, String, String),
    #[error("failed to parse `{0}` output: {1}")]
    Parse(String, String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BtCard {
    name: String,
    active_profile: String,
    /// Known profiles (empty when parsed from text output, which lacks them).
    profiles: Vec<String>,
}

/// Early head start: begin the switch while the phone is still ringing, so
/// HSP/HFP (and SCO) is more likely ready when the call is answered.
/// Runs on a detached thread; never blocks the caller. Idempotent: cards
/// already on a headset profile are left untouched.
pub fn on_call_ringing() {
    if let Err(e) = std::thread::Builder::new()
        .name("bt-profile-early".into())
        .spawn(switch_all_to_headset)
    {
        tracing::warn!("Could not spawn Bluetooth profile thread: {e}");
    }
}

/// Call entry point: move Bluetooth cards to HSP/HFP now, synchronously.
/// MUST be called before `pjsua_set_snd_dev` opens the sound device.
/// Returns true if at least one card was actually switched (the caller
/// should then allow a moment for SCO to connect before opening ALSA
/// handles — opening mid-flip blocks or fails, leaving dead audio).
pub fn on_call_audio_started() -> bool {
    switch_all_to_headset()
}

/// Call entry point: give Bluetooth cards their pre-call profile back.
/// Runs on a detached thread; never blocks the caller.
pub fn on_call_audio_stopped() {
    if let Err(e) = std::thread::Builder::new()
        .name("bt-profile-restore".into())
        .spawn(restore_saved_profiles)
    {
        tracing::warn!("Could not spawn Bluetooth profile thread: {e}");
    }
}

fn pactl_binary() -> String {
    std::env::var("MYSIPPHONE_PACTL").unwrap_or_else(|_| "pactl".to_string())
}

fn switch_all_to_headset() -> bool {
    switch_all_to_headset_with(&pactl_binary())
}

fn restore_saved_profiles() {
    restore_saved_profiles_with(&pactl_binary());
}

/// Runs `f` on a detached thread, waiting at most `timeout` for its value.
/// Returns the value, or `None` on timeout (the thread keeps running to
/// completion). Used to keep subprocess and ALSA calls — which can stall for
/// seconds on a churning PipeWire graph — from wedging the pjsip worker or
/// command threads.
pub(crate) fn run_with_timeout<F, T>(timeout: std::time::Duration, f: F) -> Option<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    let (tx, rx) = std::sync::mpsc::channel();
    if std::thread::Builder::new()
        .name("snd-open".into())
        .spawn(move || {
            let _ = tx.send(f());
        })
        .is_err()
    {
        return None;
    }
    rx.recv_timeout(timeout).ok()
}

/// How long a `pactl` invocation may take before it is abandoned. `pactl`
/// talks to the PipeWire server and can stall while the audio graph churns
/// (e.g. mid profile-switch) — without a bound it would wedge the pjsip
/// worker thread that requested the switch.
const PACTL_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);

fn run_pactl(bin: &str, args: &[&str]) -> Result<String, BluetoothError> {
    run_pactl_with_timeout(bin, args, PACTL_TIMEOUT)
}

fn run_pactl_with_timeout(
    bin: &str,
    args: &[&str],
    timeout: std::time::Duration,
) -> Result<String, BluetoothError> {
    let cmd_str = format!("{bin} {}", args.join(" "));
    let bin = bin.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let output = run_with_timeout(timeout, move || {
        Command::new(&bin).args(&args).output()
    });
    let output = match output {
        None => return Err(BluetoothError::Timeout(cmd_str)),
        Some(r) => r.map_err(|e| BluetoothError::Spawn(cmd_str.clone(), e))?,
    };
    if !output.status.success() {
        return Err(BluetoothError::Status(
            cmd_str,
            output.status.to_string(),
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub(crate) fn query_cards(bin: &str) -> Result<Vec<BtCard>, BluetoothError> {
    match run_pactl(bin, &["-f", "json", "list", "cards"])
        .and_then(|out| parse_cards_json(&out))
    {
        Ok(cards) => Ok(cards),
        Err(json_err) => {
            tracing::debug!(
                "pactl JSON listing unavailable ({json_err}), falling back to text parsing"
            );
            run_pactl(bin, &["list", "cards"]).map(|out| parse_cards_text(&out))
        }
    }
}

pub(crate) fn parse_cards_json(text: &str) -> Result<Vec<BtCard>, BluetoothError> {
    let cmd = "pactl -f json list cards";
    let value: serde_json::Value =
        serde_json::from_str(text).map_err(|e| BluetoothError::Parse(cmd.into(), e.to_string()))?;
    let entries = value
        .as_array()
        .ok_or_else(|| BluetoothError::Parse(cmd.into(), "top level is not an array".into()))?;
    let mut cards = Vec::new();
    for entry in entries {
        let name = entry
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if !name.starts_with("bluez_card.") {
            continue;
        }
        let active_profile = entry
            .get("active_profile")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let mut profiles: Vec<String> = entry
            .get("profiles")
            .and_then(|v| v.as_object())
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default();
        profiles.sort();
        cards.push(BtCard {
            name: name.to_string(),
            active_profile,
            profiles,
        });
    }
    Ok(cards)
}

pub(crate) fn parse_cards_text(text: &str) -> Vec<BtCard> {
    let mut cards = Vec::new();
    let mut pending: Option<String> = None;
    for raw in text.lines() {
        let line = raw.trim();
        if let Some(name) = line.strip_prefix("Name:") {
            pending = Some(name.trim().to_string());
        } else if let Some(profile) = line.strip_prefix("Active Profile:") {
            if let Some(name) = pending.take() {
                if name.starts_with("bluez_card.") {
                    cards.push(BtCard {
                        name,
                        active_profile: profile.trim().to_string(),
                        profiles: Vec::new(),
                    });
                }
            }
        }
    }
    cards
}

pub(crate) fn is_headset_profile(profile: &str) -> bool {
    profile == "headset-head-unit"
        || profile == "headset-head-unit-cvsd"
        || profile.starts_with("headset-")
}

/// Headset profiles to try, best codec first. When the card's profile list is
/// known, only offered profiles are returned; otherwise the fixed preference
/// order is used and misses fail fast in [`set_profile`].
pub(crate) fn headset_candidates(card: &BtCard) -> Vec<String> {
    let mut out = Vec::new();
    for candidate in HEADSET_CANDIDATES {
        if card.profiles.is_empty() || card.profiles.iter().any(|p| p == candidate) {
            out.push(candidate.to_string());
        }
    }
    for profile in &card.profiles {
        if profile.starts_with("headset") && !out.iter().any(|o| o == profile) {
            out.push(profile.clone());
        }
    }
    out
}

pub(crate) fn set_profile(bin: &str, card: &str, profile: &str) -> Result<(), BluetoothError> {
    run_pactl(bin, &["set-card-profile", card, profile]).map(|_| ())
}

/// Switches every non-headset Bluetooth card to its best headset profile.
/// Returns true if at least one card was actually switched.
pub(crate) fn switch_all_to_headset_with(bin: &str) -> bool {
    let cards = match query_cards(bin) {
        Ok(cards) => cards,
        Err(e) => {
            tracing::warn!("Bluetooth profile switch skipped, cannot list cards: {e}");
            return false;
        }
    };
    if cards.is_empty() {
        tracing::debug!("No Bluetooth audio cards found, nothing to switch");
        return false;
    }
    let saved = SAVED_PROFILES.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = match saved.lock() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::warn!("Bluetooth profile switch skipped, state lock poisoned: {e}");
            return false;
        }
    };
    let mut switched_any = false;
    for card in &cards {
        if is_headset_profile(&card.active_profile) {
            tracing::debug!(
                "Bluetooth card {} already on headset profile {}, leaving untouched",
                card.name,
                card.active_profile
            );
            continue;
        }
        // Remember the pre-call profile once, so overlapping switches cannot
        // overwrite the restore target.
        guard
            .entry(card.name.clone())
            .or_insert_with(|| card.active_profile.clone());
        let mut switched = false;
        for candidate in headset_candidates(card) {
            match set_profile(bin, &card.name, &candidate) {
                Ok(()) => {
                    tracing::info!(
                        "Bluetooth card {} switched {} -> {} for call",
                        card.name,
                        card.active_profile,
                        candidate
                    );
                    switched = true;
                    break;
                }
                Err(e) => {
                    tracing::debug!(
                        "Bluetooth card {} rejected profile {candidate}: {e}",
                        card.name
                    );
                }
            }
        }
        if !switched {
            tracing::warn!(
                "Bluetooth card {}: no headset profile accepted, microphone may not work",
                card.name
            );
        } else {
            switched_any = true;
        }
    }
    switched_any
}

pub(crate) fn restore_saved_profiles_with(bin: &str) {
    let entries: Vec<(String, String)> = SAVED_PROFILES
        .get()
        .and_then(|m| m.lock().ok())
        .map(|mut guard| guard.drain().collect())
        .unwrap_or_default();
    if entries.is_empty() {
        tracing::debug!("No saved Bluetooth profiles to restore");
        return;
    }
    for (card, profile) in entries {
        match set_profile(bin, &card, &profile) {
            Ok(()) => tracing::info!("Bluetooth card {card} restored to {profile} after call"),
            Err(e) => {
                tracing::warn!("Failed to restore Bluetooth card {card} to {profile}: {e}");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    const JSON_FIXTURE: &str = r#"[
        {"name": "alsa_card.pci-0000_00_1f.3", "active_profile": "output:analog-stereo+input:analog-stereo", "profiles": {}},
        {"name": "bluez_card.11_22_33_44_55_66", "active_profile": "a2dp-sink",
         "profiles": {"a2dp-sink": {}, "headset-head-unit": {}, "headset-head-unit-cvsd": {}, "off": {}}},
        {"name": "bluez_card.AA_BB_CC_DD_EE_FF", "active_profile": "headset-head-unit",
         "profiles": {"headset-head-unit": {}, "off": {}}}
    ]"#;

    const TEXT_FIXTURE: &str = "Card #57\n\tName: alsa_card.pci-0000_00_1f.3\n\tActive Profile: output:analog-stereo+input:analog-stereo\nCard #108\n\tName: bluez_card.11_22_33_44_55_66\n\tDriver: module-bluez5-device.c\n\tActive Profile: a2dp-sink\n";

    #[test]
    fn parses_json_cards_and_filters_bluez() {
        let cards = parse_cards_json(JSON_FIXTURE).expect("valid fixture");
        assert_eq!(cards.len(), 2);
        assert_eq!(cards[0].name, "bluez_card.11_22_33_44_55_66");
        assert_eq!(cards[0].active_profile, "a2dp-sink");
        assert!(cards[0].profiles.contains(&"headset-head-unit".to_string()));
        assert_eq!(cards[1].active_profile, "headset-head-unit");
    }

    #[test]
    fn rejects_invalid_json() {
        assert!(parse_cards_json("not json").is_err());
        assert!(parse_cards_json("{}").is_err());
    }

    #[test]
    fn parses_text_cards_and_skips_alsa() {
        let cards = parse_cards_text(TEXT_FIXTURE);
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].name, "bluez_card.11_22_33_44_55_66");
        assert_eq!(cards[0].active_profile, "a2dp-sink");
        assert!(cards[0].profiles.is_empty());
    }

    #[test]
    fn headset_candidate_order_prefers_msbc() {
        let card = BtCard {
            name: "bluez_card.x".into(),
            active_profile: "a2dp-sink".into(),
            profiles: vec![
                "a2dp-sink".into(),
                "headset-head-unit".into(),
                "headset-head-unit-cvsd".into(),
            ],
        };
        assert_eq!(
            headset_candidates(&card),
            vec!["headset-head-unit", "headset-head-unit-cvsd"]
        );
    }

    #[test]
    fn headset_candidates_fall_back_to_cvsd() {
        let card = BtCard {
            name: "bluez_card.x".into(),
            active_profile: "a2dp-sink".into(),
            profiles: vec!["a2dp-sink".into(), "headset-head-unit-cvsd".into()],
        };
        assert_eq!(headset_candidates(&card), vec!["headset-head-unit-cvsd"]);
    }

    #[test]
    fn headset_candidates_default_order_without_profile_list() {
        let card = BtCard {
            name: "bluez_card.x".into(),
            active_profile: "a2dp-sink".into(),
            profiles: Vec::new(),
        };
        assert_eq!(
            headset_candidates(&card),
            vec!["headset-head-unit", "headset-head-unit-cvsd"]
        );
    }

    #[test]
    fn pactl_timeout_is_bounded() {
        let dir = std::env::temp_dir().join(format!("mysip_bt_hang_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("stub dir");
        let bin = dir.join("pactl");
        std::fs::write(&bin, "#!/bin/sh\nsleep 30\n").expect("stub script");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&bin).expect("meta").permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&bin, perms).expect("chmod stub");
        }
        let bin = bin.to_string_lossy().into_owned();
        let start = std::time::Instant::now();
        let err = run_pactl_with_timeout(&bin, &["-f", "json", "list", "cards"], std::time::Duration::from_millis(200))
            .expect_err("hung pactl must fail");
        assert!(start.elapsed() < std::time::Duration::from_secs(10), "must return promptly");
        assert!(matches!(err, BluetoothError::Timeout(_)), "unexpected: {err:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_headset_profiles() {
        assert!(is_headset_profile("headset-head-unit"));
        assert!(is_headset_profile("headset-head-unit-cvsd"));
        assert!(!is_headset_profile("a2dp-sink"));
        assert!(!is_headset_profile("off"));
    }

    /// Creates a fake `pactl` answering from fixture files. `json_body` is
    /// served for `-f json list cards`, `text_body` for `list cards`, and
    /// `set-card-profile` calls are appended to `calls.log`.
    fn make_stub(name: &str, json_body: &str, text_body: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("mysip_bt_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("stub dir");
        std::fs::write(dir.join("cards.json"), json_body).expect("json fixture");
        std::fs::write(dir.join("cards.txt"), text_body).expect("text fixture");
        let script = format!(
            "#!/bin/sh\nDIR=\"{}\"\nif [ \"$1\" = \"-f\" ]; then\n  cat \"$DIR/cards.json\"\n  exit 0\nfi\nif [ \"$1\" = \"list\" ]; then\n  cat \"$DIR/cards.txt\"\n  exit 0\nfi\nif [ \"$1\" = \"set-card-profile\" ]; then\n  echo \"$2 $3\" >> \"$DIR/calls.log\"\n  exit 0\nfi\necho \"unexpected: $@\" >&2\nexit 1\n",
            dir.display()
        );
        let bin = dir.join("pactl");
        {
            let mut f = std::fs::File::create(&bin).expect("stub script");
            f.write_all(script.as_bytes()).expect("write stub");
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&bin).expect("meta").permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&bin, perms).expect("chmod stub");
        }
        dir
    }

    fn read_calls(dir: &std::path::Path) -> String {
        std::fs::read_to_string(dir.join("calls.log")).unwrap_or_default()
    }

    // NOTE: the stub-driven scenarios below live in a single #[test] because
    // they share the process-wide SAVED_PROFILES map and must not interleave.
    #[test]
    fn switch_restore_and_text_fallback_with_stub() {
        // ── Scenario 1: switch skips non-Bluetooth/already-headset cards ──
        let json = r#"[
            {"name": "alsa_card.pci-0000_00_1f.3", "active_profile": "output:analog-stereo+input:analog-stereo", "profiles": {}},
            {"name": "bluez_card.00_flow_music", "active_profile": "a2dp-sink",
             "profiles": {"a2dp-sink": {}, "headset-head-unit": {}, "headset-head-unit-cvsd": {}, "off": {}}},
            {"name": "bluez_card.00_flow_call", "active_profile": "headset-head-unit",
             "profiles": {"headset-head-unit": {}, "off": {}}}
        ]"#;
        let dir = make_stub("flow", json, "");
        let bin = dir.join("pactl").to_string_lossy().into_owned();

        assert!(switch_all_to_headset_with(&bin));
        assert_eq!(read_calls(&dir), "bluez_card.00_flow_music headset-head-unit\n");

        restore_saved_profiles_with(&bin);
        assert_eq!(
            read_calls(&dir),
            "bluez_card.00_flow_music headset-head-unit\nbluez_card.00_flow_music a2dp-sink\n"
        );

        // Second restore is a no-op (map was drained).
        restore_saved_profiles_with(&bin);
        assert_eq!(
            read_calls(&dir),
            "bluez_card.00_flow_music headset-head-unit\nbluez_card.00_flow_music a2dp-sink\n"
        );
        let _ = std::fs::remove_dir_all(&dir);

        // ── Scenario 2: text fallback when JSON is invalid ──
        let text = "Card #108\n\tName: bluez_card.00_flow_text\n\tActive Profile: a2dp-sink\n";
        let dir = make_stub("text", "this is not json", text);
        let bin = dir.join("pactl").to_string_lossy().into_owned();

        assert!(switch_all_to_headset_with(&bin));
        assert_eq!(read_calls(&dir), "bluez_card.00_flow_text headset-head-unit\n");

        restore_saved_profiles_with(&bin);
        assert!(read_calls(&dir).ends_with("bluez_card.00_flow_text a2dp-sink\n"));
        let _ = std::fs::remove_dir_all(&dir);

        // ── Scenario 3: nothing to do when already on headset ──
        let json = r#"[
            {"name": "bluez_card.00_flow_done", "active_profile": "headset-head-unit",
             "profiles": {"headset-head-unit": {}, "off": {}}}
        ]"#;
        let dir = make_stub("done", json, "");
        let bin = dir.join("pactl").to_string_lossy().into_owned();

        assert!(!switch_all_to_headset_with(&bin));
        assert_eq!(read_calls(&dir), "");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
