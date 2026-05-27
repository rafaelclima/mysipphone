# mySIPPhone — Implementation Roadmap

## M0 — Scaffold & Architecture (done)
- [x] Project structure
- [x] AGENTS.md
- [x] ARCHITECTURE.md
- [x] ROADMAP.md
- [x] Cargo workspace
- [x] Rust crate scaffolds
- [x] Frontend scaffold (React + Vite + MUI 3)
- [x] Tauri shell
- [x] pjsip build script

---

## M1 — UI Framework (done)
- [x] PhoneShell component (realistic smartphone frame)
- [x] Dark/Light theme (MUI 3)
- [x] React Router (dialer, contacts, history, settings)
- [x] Zustand stores
- [x] Placeholder screens with mock data
- [x] Status bar with time, signal, battery
- [x] Navigation bar (Dialer, Contacts, History, Settings)

**Deliverable**: App launches showing a realistic smartphone with working navigation.

---

## M2 — SIP Registration (done)
- [x] pjsip 2.17 built locally (`pjsip-dist/`)
- [x] `pjsip-sys` crate: FFI bindings for pjsua API
- [x] Real pjsua initialization: create → init → start
- [x] Account registration via `pjsua_acc_add` + `pjsua_acc_set_registration`
- [x] Global callback bridge (pjsip C → Rust channel)
- [x] Tauri event system: `sip:account-state` events flow to frontend
- [x] SIP thread with graceful shutdown
- [x] Settings UI shows registration status
- [x] AccountSetup form → Tauri command → real pjsip registration

**Deliverable**: User enters SIP credentials, sees registration status in real time.

---

## M3 — Audio Engine (done)
- [x] ALSA backend (`audio-engine` crate)
- [x] Device enumeration (direct ALSA calls)
- [x] Ringtone player (dedicated thread)
- [x] Device selection via Tauri commands
- [x] Multiple device support (PipeWire ALSA compat layer)

**Deliverable**: App detects audio devices, plays ringtone on selected output.

---

## M4 — Basic Calls (done)
- [x] Outgoing call flow
- [x] Incoming call ring + answer
- [x] Bidirectional RTP audio (PCMA @8kHz via conference bridge)
- [x] Call state machine (idle → dialing → ringing → connecting → connected → ended)
- [x] DTMF
- [x] ActiveCall screen displays duration, caller, hangup button

**Deliverable**: Full call capability between two SIP endpoints.

---

## M5 — Call Features
- Hold
- Mute
- Transfer (attended + blind)
- Multiple simultaneous lines
- Call history persistence
- Call log view in UI

**Deliverable**: Professional call features working.

---

## M6 — Full UI
- Contacts (CRUD, import)
- Call history (grouped by date)
- Settings (accounts, audio, appearance)
- Account setup wizard
- Incoming call screen with accept/decline
- Animations and transitions

**Deliverable**: Feature-complete softphone UI.

---

## M7 — Polish & Stability
- Audio device hotplug (USB/Bluetooth)
- Stream recovery on glitch
- Reconnect handling on SIP transport loss
- Error recovery edge cases
- Performance profiling
- Release build optimization
- Package for distribution (.deb, .AppImage)

**Deliverable**: Production-ready release.
