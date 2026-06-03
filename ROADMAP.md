# mySIPPhone — Implementation Roadmap

## M0 — Scaffold & Architecture (done)
- [x] Project structure
- [x] AGENTS.md
- [x] ARCHITECTURE.md
- [x] ROADMAP.md
- [x] Cargo workspace
- [x] Rust crate scaffolds
- [x] Frontend scaffold (React + Vite + MUI 6)
- [x] Tauri shell
- [x] pjsip build script

---

## M1 — UI Framework (done)
- [x] PhoneShell component (realistic smartphone frame)
- [x] Dark/Light theme (MUI)
- [x] React Router (dialer, contacts, history, settings)
- [x] Zustand stores
- [x] Status bar with time, signal, battery
- [x] Navigation bar (Dialer, Contacts, History, Settings)
- [x] i18n (EN / PT-BR) with language selector in Settings

---

## M2 — SIP Registration (done)
- [x] pjsip 2.17 built locally (`pjsip-dist/`)
- [x] `pjsip-sys` crate: FFI bindings for pjsua API
- [x] Real pjsua initialization: create → init → start
- [x] Account registration via `pjsua_acc_add`
- [x] Global callback bridge (pjsip C → Rust channel)
- [x] Tauri event system: `sip:account-state` events flow to frontend
- [x] SIP thread with graceful shutdown
- [x] Account persists across restarts (file-based SQLite at `/tmp/mysipphone.db`)
- [x] Transport fallback: port 5060 → port 0 if busy
- [x] **FFI struct size fix**: `pjsua_config._opaque: [u8; 2048]` → `[u8; 2640]` (causava `PJ_EINVAL`)

---

## M3 — Audio Engine (done)
- [x] ALSA backend (`audio-engine` crate)
- [x] Device enumeration (direct ALSA calls)
- [x] Ringtone player (dedicated thread)
- [x] Device selection via Tauri commands
- [x] Multiple device support (PipeWire ALSA compat layer)

---

## M4 — Basic Calls (done)
- [x] Outgoing call flow
- [x] Incoming call ring + answer
- [x] Bidirectional RTP audio (PCMA @8kHz via conference bridge)
- [x] Call state machine (idle → dialing → ringing → connecting → connected → ended)
- [x] DTMF
- [x] ActiveCall screen displays duration, caller, hangup button

---

## M5 — Call Features (done)
- [x] Hold / Resume
- [x] Mute
- [x] Blind Transfer (with cancel ✕ button)
- [x] Multiple simultaneous lines with swap
- [x] Call history persistence (SQLite on call end)
- [x] Call log view in UI (grouped by date, direction icons)
- [x] Conference bridge connect (bidirectional audio on media state)

---

## M6 — Full UI (done)
- [x] Contacts CRUD (add, edit, delete, call)
- [x] Auto SIP URI from extension (sip:ramal@dominio)
- [x] Call history (grouped by date, direction icons, duration)
- [x] Settings (SIP account, audio devices, dark mode, language)
- [x] Account setup wizard (AccountSetup.tsx)
- [x] Incoming call screen with accept/decline (+ keyboard Enter/Escape)
- [x] Quit button at bottom of Settings

---

## M6b — UX Enhancements (feito)
- [x] **Call from history**: Phone icon on each call log entry → invokes `make_call`
- [x] **Call Pickup shortcut**: `*8#` button in Dialer via `sip:*8%23@dominio`
- [x] **Animations/transitions** between routes (fade/slide via Framer Motion `AnimatePresence`)
- [x] **Device themes**: iPhone, Galaxy, Pixel mockup (notch, corners, status bar, icons)
- [x] Import contacts (CSV)

---

## M7 — Polish & Stability (done)
- [x] Audio device hotplug (USB/Bluetooth detection) via 2s polling
- [x] Reconnect handling on SIP transport loss (exponential backoff 1-60s)
- [x] Error recovery edge cases
- [x] Release build optimization
- [x] Per-user install script (`install.sh` → `~/.local/`)
- [x] Binary RUNPATH `$ORIGIN/../lib/mysipphone` for pjsip libs
- [x] pjsip `.so` files shipped with `$ORIGIN` RPATH
- [x] Desktop entry with absolute icon path + `StartupWMClass`
- [x] Icon cache update (`gtk-update-icon-cache`)
- [x] All 7 hicolor icon sizes (16×16 to 256×256)
- [x] AppImage build script (`build-appimage.sh`)
- [x] FFI struct size test (`cargo test -p pjsip-sys`)
- [x] Pre-commit checklist in AGENTS.md

---

## Extra Ideas (not prioritized)
- Multiple SIP accounts (register more than one, choose which to call from)
- Conference (merge two calls)
- Custom ringtone per contact
- Contacts import (CSV/vCard)

---

## M8 — Quality of Life (feito)
- [x] **Call history auto-prune**: Keep only 7 days of history (auto-delete on save)
- [x] **Registration indicator**: Visual icon (green/red/yellow/grey) in the status bar next to the network icons — shows registered/failed/registering/unregistered at a glance
- [x] **App version**: Dynamic from Tauri API (was hardcoded "v0.1.0")
- [x] **Help section**: Modal in Settings with usage tips, call features, keyboard shortcuts, and audio device guide — translated to EN/PT-BR

---

## M9 — Audit Remediation Phase 1-3 (feito)
Comprehensive audit via voip-auditor agent (28 findings) + remediation roadmap via voip-architect agent.

### Phase 1 — Critical
- [x] Fixed `useEffect` missing dependency arrays in `IncomingCall.tsx` and `IncomingPopup.tsx`
- [x] Replaced magic numbers 0–6 with named constants (`INV_STATE_NULL` through `INV_STATE_DISCONNECTED`)
- [x] Fixed hardcoded `account_id: 0` — added `CALL_ACC_MAP: OnceLock<Mutex<HashMap<i32, i32>>>` to track which SIP account owns each call
- [x] Removed unnecessary `#[no_mangle]` from `RETRY_COUNT` (static, not linked from C)
- [x] Replaced 5 `blocking_send` calls with `try_send` to prevent deadlocks in mpsc channels
- [x] Replaced hardcoded "Chamada Recebida" with `t("incoming_call.title")` for i18n

### Phase 2 — Important
- [x] Converted `pjsua_acc_config` to opaque `_opaque` (size verified: 4960 bytes via C test program)
- [x] Added `SipCommand::SetAudioDevice(capture, playback)` + Tauri command `set_audio_device` to switch pjsip sound devices at runtime
- [x] Fixed race condition in incoming call popup (proper error handling on `close()`)
- [x] Created `frontend/src/lib/sipUri.ts` with `validateSipUserPart` and `buildSipUri` (RFC 3261 §25.1)
- [x] Added rate limiting on `RetryRegister` (500ms cooldown per account via `LAST_RETRY_TIME`)
- [x] Error propagation for make_call, answer, transfer via `CallEvent::Error { call_id, message }`

### Phase 3 — Hardening
- [x] TLS transport: `mysip_create_tls_transport` C helper + `SipCommand::CreateTlsTransport` + Tauri command `create_tls_transport`
- [x] Error propagation to frontend via `CallEvent::Error` for make_call, answer, transfer
- [x] Frontend UX improvements: `CircularProgress` loading states on all action buttons, tooltips on all buttons
- [x] i18n keys added: `dialer.call`, `dialer.backspace`, `call.hangup` (EN + PT-BR)
- [x] Release build fix: `[profile.release] opt-level = 0` (workaround for pjsip UB crash)
- [x] Install script fix: `cargo tauri build` instead of `cargo build --release`
