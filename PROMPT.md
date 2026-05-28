You are a senior VoIP engineer, Linux audio specialist, Rust architect and desktop application engineer.

Your task is to build a production-grade SIP softphone desktop application for Linux focused on stability, audio reliability and professional SIP communication.

# Project Goals

Build a modern desktop SIP Phone inspired visually by Blink softphone and Android Material 3 design language.

The application must visually resemble a real smartphone device rendered on desktop, including:
- realistic smartphone frame
- rounded corners
- modern Android-inspired UI
- polished transitions
- professional softphone UX

However:
VISUALS MUST NEVER BE PRIORITIZED OVER SIP OR AUDIO STABILITY.

The project target is Linux desktop environments, especially:
- PipeWire
- PulseAudio
- Bluetooth headsets
- USB headsets

The app will connect directly to an Asterisk/Issabel PBX on local network using traditional SIP + RTP.

# Technical Requirements

## Mandatory Stack

- Rust for backend/core
- Tauri for desktop shell
- React for frontend
- Material UI / Material 3
- SQLite for local persistence
- Cargo workspace monorepo
- Zustand or equivalent lightweight state management

## SIP Requirements

The SIP stack MUST be production-grade.

Use mature SIP implementation strategy:
- pjsip/pjsua2 bindings preferred
- avoid implementing SIP protocol manually

Must support:
- SIP registration
- outgoing calls
- incoming calls
- mute
- hold
- transfer
- multiple simultaneous lines
- RTP audio
- DTMF
- reconnect handling
- call state synchronization

# Audio Requirements

Audio stability is the HIGHEST PRIORITY of the entire project.

Must support:
- PipeWire
- PulseAudio
- USB headsets
- Bluetooth audio devices
- device switching
- ringtone output device selection
- microphone selection
- speaker selection

Avoid browser/WebRTC limitations whenever possible.

Implement robust:
- audio device enumeration
- reconnect behavior
- stream recovery
- audio error handling

# Persistence

Use SQLite locally for:
- call history
- contacts
- settings
- audio preferences

No backend server required in V1.

# UI/UX Requirements

The UI must:
- resemble a premium Android smartphone
- support dark/light mode
- have realistic smartphone proportions
- modern Material 3 components
- smooth animations
- responsive call screens

Views required:
- dialer
- active call
- incoming call
- contacts
- call history
- settings
- account registration

# Engineering Requirements

Architecture MUST prioritize:
- maintainability
- modularity
- production-readiness
- separation of concerns
- SIP stability
- audio reliability

Avoid:
- fake implementations
- placeholder SIP logic
- mocked call systems
- pseudo-SIP architecture

If a feature cannot be safely implemented, explain limitations instead of inventing APIs.

# Deliverables

Generate:
- complete monorepo structure
- AGENTS.md
- architecture documentation
- folder structure
- implementation roadmap
- SIP engine architecture
- audio architecture
- UI architecture
- state management architecture
- persistence strategy
- build strategy

# Development Strategy

The project MUST be developed incrementally.

FIRST:
- architecture
- workspace structure
- SIP integration strategy
- audio architecture

ONLY AFTER:
- basic SIP registration
- call handling
- audio routing

ONLY AFTER THAT:
- premium UI polish

# Important Constraints

- Linux-first application
- local network usage only
- production-oriented code
- avoid overengineering
- stability over visual effects
- no unnecessary cloud dependencies
- no backend unless truly required

# Code Quality

Prefer:
- strongly typed code
- modular Rust crates
- clear ownership boundaries
- safe concurrency
- event-driven architecture

Avoid:
- gigantic files
- business logic inside UI
- tightly coupled SIP/UI code
- fragile async patterns

# Expected First Output

Your first response must NOT generate the full application immediately.

Instead:
1. analyze architecture
2. propose project structure
3. identify technical risks
4. define SIP strategy
5. define Linux audio strategy
6. define incremental milestones
7. define AGENTS.md content
8. explain why each decision was made

Only after architecture approval should implementation begin.