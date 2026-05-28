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

**Deliverable**: App launches showing a realistic smartphone with working navigation and translations.

---

## M2 — SIP Registration (done)
- [x] pjsip 2.17 built locally (`pjsip-dist/`)
- [x] `pjsip-sys` crate: FFI bindings for pjsua API
- [x] Real pjsua initialization: create → init → start
- [x] Account registration via `pjsua_acc_add` + `pjsua_acc_set_registration`
- [x] Global callback bridge (pjsip C → Rust channel)
- [x] Tauri event system: `sip:account-state` events flow to frontend
- [x] SIP thread with graceful shutdown
- [x] Account persists across restarts (file-based SQLite at `/tmp/mysipphone.db`)
- [x] Transport fallback: port 5060 → port 0 if busy

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

## M5 — Call Features (done)
- [x] Hold / Resume
- [x] Mute
- [x] Blind Transfer (with cancel ✕ button)
- [x] Multiple simultaneous lines with swap
- [x] Call history persistence (SQLite on call end)
- [x] Call log view in UI (grouped by date, direction icons)
- [x] Conference bridge connect (bidirectional audio on media state)

**Deliverable**: Professional call features working.

---

## M6 — Full UI (done)
- [x] Contacts CRUD (add, edit, delete, call)
- [x] Auto SIP URI from extension (sip:ramal@dominio)
- [x] Call history (grouped by date, direction icons, duration)
- [x] Settings (SIP account, audio devices, dark mode, language)
- [x] Account setup wizard (AccountSetup.tsx)
- [x] Incoming call screen with accept/decline (+ keyboard Enter/Escape)
- [x] Quit button at bottom of Settings

**Deliverable**: Feature-complete softphone UI.

---

## M6b — UX Enhancements (pending)
- [ ] **Device themes**: iPhone, Galaxy, Pixel mockup (notch, corners, status bar)
- [ ] **Call from history**: Phone icon on each call log entry → invokes `make_call`
- [ ] **Call Pickup shortcut**: `*8#` button in Dialer via `sip:*8%23@dominio`
- [ ] **Animations/transitions** between routes (fade/slide)
- [ ] Import contacts (CSV)

---

## M7 — Polish & Stability (pending)
- [ ] Audio device hotplug (USB/Bluetooth detection)
- [ ] Stream recovery on glitch
- [ ] Reconnect handling on SIP transport loss
- [ ] Error recovery edge cases
- [ ] Performance profiling
- [ ] Release build optimization
- [ ] Package for distribution (.deb, .AppImage)

**Deliverable**: Production-ready release.

---

## Extra Ideas (not prioritized)
- Multiple SIP accounts (register more than one, choose which to call from)
- Conference (merge two calls)
- Custom ringtone per contact
- Contacts import (CSV/vCard)
