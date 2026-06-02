<p align="center">
  <strong>🇧🇷 Português</strong> &nbsp;·&nbsp; <a href="#en">🇺🇸 English</a>
</p>

<!-- ─── PORTUGUÊS (padrão) ─── -->

# mySIPPhone

[![Licença: MIT](https://img.shields.io/badge/Licença-MIT-blue.svg)](LICENSE)

**Softphone SIP para desktop Linux** — conecta-se diretamente a uma central Asterisk/Issabel na rede local. Construído com stack real pjsip e áudio ALSA nativo. Sem nuvem, sem WebRTC, sem áudio via navegador.

## Capturas de Tela

| Discador & Chamada Ativa | Config. de Conta & Ajustes | Chamada Recebida |
|---|---|---|
| ![Discador](resources/prints/01.png) | ![Config. de Conta](resources/prints/02.png) | ![Chamada Recebida](resources/prints/03.png) |
| ![Chamada Ativa](resources/prints/04.png) | ![Ajustes](resources/prints/05.png) | |

## Funcionalidades

| Funcionalidade | Status |
|----------------|--------|
| Registro SIP (reconexão automática) | ✅ |
| Chamadas realizadas (INVITE + áudio RTP) | ✅ |
| Tom de ringback ao chamar | ✅ |
| Chamadas recebidas (toque + atender) | ✅ |
| Captura de chamada `*8#` (+ direcionada `*8#ramal`) | ✅ |
| Espera / Retomar | ✅ |
| Mudo | ✅ |
| Transferência cega | ✅ |
| Chamada em espera / alternar | ✅ |
| DTMF (RFC 2833) | ✅ |
| Histórico de chamadas (SQLite) | ✅ |
| Contatos (CRUD + importação CSV) | ✅ |
| Múltiplas linhas | ✅ |
| Detecção automática de dispositivos de áudio | ✅ |
| Tema escuro / claro | ✅ |
| Temas de aparelho (iPhone / Galaxy / Pixel) | ✅ |
| Popup de chamada recebida | ✅ |
| Internacionalização PT-BR / EN | ✅ |
| Instalação por usuário (sem sudo) | ✅ |

## Instalação Rápida

### AppImage (recomendado)

Baixe o AppImage mais recente da [página de releases](https://github.com/rafaelclima/mysipphone/releases):

```bash
chmod +x mySIPPhone_*.AppImage
./mySIPPhone_*.AppImage
```

### Arch Linux / Omarchy / Manjaro

```bash
sudo pacman -S --needed webkit2gtk-4.1
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/setup-arch.sh
```

O script detecta automaticamente o Hyprland (Wayland) e aplica `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

### Compilar do código-fonte

```bash
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/install.sh
```

Sem sudo. Instala em `~/.local/`:
- `~/.local/bin/mysipphone` — binário
- `~/.local/lib/mysipphone/` — bibliotecas pjsip
- `~/.local/share/applications/mysipphone.desktop` — atalho no menu
- `~/.local/share/icons/hicolor/*/apps/mysipphone.png` — ícones

### Dependências de Runtime

| Biblioteca | Finalidade |
|------------|------------|
| GTK3 + WebKit2GTK 4.1 | Webview do Tauri |
| ALSA (`libasound2`) | Áudio (PipeWire é compatível) |

## Como Usar

1. **Abra o app** — tela de configuração de conta na primeira execução.
2. **Informe seus dados SIP**: ramal, domínio, usuário, senha.
3. **Disque um ramal** e pressione o botão verde de chamada.
4. **Receba chamadas**: o app toca — atenda ou recuse.
5. **Captura (`*8#`)**: disque `*8#` para capturar chamada do grupo, ou `*8#ramal` para captura direcionada.
6. **Espera / Retomar**: pressione Espera; pressione novamente para retomar.
7. **Transferência cega**: pressione Transferir → digite o ramal → confirme. Cancele com ✕ ou Escape.
8. **Chamada em espera**: segunda chamada exibe um banner — atender coloca a primeira em espera.
9. **Contatos**: adicione, edite, exclua. Importação CSV disponível.
10. **Ajustes**: gerencie sua conta, escolha dispositivos de áudio, alterne tema escuro, teste caixas de som, mude o tema do aparelho.

### Configuração da Conta

| Campo | Exemplo |
|-------|---------|
| Ramal | 595 |
| Domínio da Central | 192.168.54.2 |
| Usuário | 595 |
| Senha | sua_senha_sip |

Registro automático na central. Indicador verde na barra de status confirma o registro.

## Desenvolvimento

### Dependências do Sistema

```bash
# Ubuntu 24.04 / Pop!_OS 24.04 / Debian 12+
sudo apt install -y \
  build-essential pkg-config curl make \
  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
  libasound2-dev \
  libx11-dev libxext-dev libxft-dev libxinerama-dev \
  libxcursor-dev libxrandr-dev libxi-dev \
  uuid-dev libtool autoconf automake g++ nodejs npm
```

### Configuração Inicial

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts

# pjsip (compilação única)
./scripts/setup-pjsip.sh

# Dependências do frontend
cd frontend && npm install && cd ..
```

### Ambiente (a cada shell)

```bash
source ./scripts/set-env.sh
```

### Comandos

| Comando | Descrição |
|---------|-----------|
| `cargo tauri dev` | App completo com recarga automática |
| `cargo check` | Verificar compilação |
| `cargo clippy --all-targets -- -D warnings` | Lint Rust |
| `cargo test -p pjsip-sys` | Verificar tamanhos das structs FFI |
| `npm run dev` (em `frontend/`) | Servidor de desenvolvimento |
| `npx tsc --noEmit` (em `frontend/`) | Typecheck TypeScript |
| `npm run lint` (em `frontend/`) | Lint do frontend |
| `./scripts/install.sh` | Instalar em `~/.local/` |
| `./scripts/build-appimage.sh` | Gerar AppImage + .deb |

### Checklist Pré-Commit

1. `cargo test -p pjsip-sys` — verificar structs FFI
2. `cargo check`
3. `cargo clippy --all-targets -- -D warnings`
4. `npm run lint` (em `frontend/`)
5. `npx tsc --noEmit` (em `frontend/`)

## Solução de Problemas

### `pjsua_init failed: 70004 (PJ_EINVAL)`

Tamanho incorreto de struct FFI. Execute `cargo test -p pjsip-sys`. Veja `packages/pjsip-sys/src/lib.rs` — o padding `_opaque` deve corresponder ao tamanho real da struct C.

### `pkg-config: libpjproject not found`

Execute `./scripts/setup-pjsip.sh`, depois `source ./scripts/set-env.sh`.

### Nenhum dispositivo de áudio

```bash
aplay -l          # listar dispositivos de reprodução
arecord -l        # listar dispositivos de captura
sudo apt install pipewire-alsa  # se usar PipeWire
```

### Ícone genérico no menu

```bash
gtk-update-icon-cache ~/.local/share/icons/hicolor
```

## Estrutura do Projeto

```
packages/
  pjsip-sys/       Bindings FFI para API C do pjsua
  sip-engine/      Ciclo de vida pjsip, controle de chamadas
  audio-engine/    Backend ALSA, ringtone, mudo
  persistence/     Repositórios SQLite (contas, contatos, histórico)
  shared/          Tipos sem dependências
src-tauri/         Shell Tauri (comandos, estado, main)
frontend/          App React (views, stores, componentes, i18n)
scripts/           Scripts de build e instalação
```

## Arquitetura

```
pjsip (C) → pjsip-sys (FFI) → sip-engine (Rust)
                                   │
                              canal mpsc
                                   │
                           Evento Tauri (sip:*)
                                   │
                            Store Zustand
                                   │
                               React UI
```

Áudio: `ALSA ← audio-engine ← Comandos Tauri ← React`

## Licença

MIT

---

<h1 id="en"></h1>

<p align="center">
  <a href="#"><strong>🇧🇷 Português</strong></a> &nbsp;·&nbsp; <strong>🇺🇸 English</strong>
</p>

<!-- ─── ENGLISH ─── -->

# mySIPPhone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Desktop SIP softphone for Linux** — connects directly to an Asterisk/Issabel PBX over local network. Built with real pjsip stack and native ALSA audio. No cloud, no WebRTC, no browser audio.

## Screenshots

| Dialer & Active Call | Account Setup & Settings | Incoming Call |
|---|---|---|
| ![Dialer](resources/prints/01.png) | ![Account Setup](resources/prints/02.png) | ![Incoming Call](resources/prints/03.png) |
| ![Active Call](resources/prints/04.png) | ![Settings](resources/prints/05.png) | |

## Features

| Feature | Status |
|---------|--------|
| SIP registration (auto-reconnect) | ✅ |
| Outgoing calls (INVITE + RTP audio) | ✅ |
| Outgoing ringback tone | ✅ |
| Incoming calls (ring + answer) | ✅ |
| Call pickup `*8#` (+ targeted `*8#extension`) | ✅ |
| Hold / Resume | ✅ |
| Mute | ✅ |
| Blind Transfer | ✅ |
| Call waiting / swap | ✅ |
| DTMF (RFC 2833) | ✅ |
| Call history (SQLite) | ✅ |
| Contacts CRUD + CSV import | ✅ |
| Multiple lines | ✅ |
| Audio hotplug detection | ✅ |
| Dark / Light theme | ✅ |
| Device themes (iPhone / Galaxy / Pixel) | ✅ |
| Incoming call popup window | ✅ |
| PT-BR / EN internationalization | ✅ |
| Per-user install (no sudo) | ✅ |

## Quick Install

### AppImage (recommended)

Download the latest AppImage from the [releases page](https://github.com/rafaelclima/mysipphone/releases):

```bash
chmod +x mySIPPhone_*.AppImage
./mySIPPhone_*.AppImage
```

### Arch Linux / Omarchy / Manjaro

```bash
sudo pacman -S --needed webkit2gtk-4.1
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/setup-arch.sh
```

The script auto-detects Hyprland (Wayland) and applies `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

### Build from source

```bash
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/install.sh
```

No sudo required. Installs to `~/.local/`:
- `~/.local/bin/mysipphone` — binary
- `~/.local/lib/mysipphone/` — bundled pjsip libraries
- `~/.local/share/applications/mysipphone.desktop` — app menu entry
- `~/.local/share/icons/hicolor/*/apps/mysipphone.png` — app icons

### Runtime Dependencies

| Library | Purpose |
|---------|---------|
| GTK3 + WebKit2GTK 4.1 | Tauri webview |
| ALSA (`libasound2`) | Audio (PipeWire compatible) |

## Usage

1. **Launch the app** — Account Setup appears on first run.
2. **Enter your SIP credentials**: extension, domain, user, password.
3. **Dial an extension** and press the green call button.
4. **Receive calls**: app rings — answer or reject.
5. **Call pickup (`*8#`)**: dial `*8#` to pick up from your group, or `*8#extension` for targeted pickup.
6. **Hold / Resume**: press Hold; press again to resume.
7. **Blind Transfer**: press Transfer → enter target extension → confirm. Cancel with ✕ or Escape.
8. **Call waiting**: second incoming call shows a banner — answer puts the first on hold.
9. **Contacts**: add, edit, delete. CSV import supported.
10. **Settings**: manage your SIP account, pick audio devices, toggle dark mode, test speakers, change device theme.

### Account Configuration

| Field | Example |
|-------|---------|
| Extension | 595 |
| PBX Domain | 192.168.54.2 |
| Username | 595 |
| Password | your_sip_password |

Auto-registers on the PBX. Green indicator in the status bar confirms registration.

## Development

### System Dependencies

```bash
# Ubuntu 24.04 / Pop!_OS 24.04 / Debian 12+
sudo apt install -y \
  build-essential pkg-config curl make \
  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
  libasound2-dev \
  libx11-dev libxext-dev libxft-dev libxinerama-dev \
  libxcursor-dev libxrandr-dev libxi-dev \
  uuid-dev libtool autoconf automake g++ nodejs npm
```

### Setup

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts

# pjsip (one-time build)
./scripts/setup-pjsip.sh

# Frontend dependencies
cd frontend && npm install && cd ..
```

### Environment (every shell)

```bash
source ./scripts/set-env.sh
```

### Commands

| Command | Description |
|---------|-------------|
| `cargo tauri dev` | Full app with hot-reload |
| `cargo check` | Check compilation |
| `cargo clippy --all-targets -- -D warnings` | Rust lint |
| `cargo test -p pjsip-sys` | Verify FFI struct sizes |
| `npm run dev` (in `frontend/`) | Frontend dev server |
| `npx tsc --noEmit` (in `frontend/`) | TypeScript typecheck |
| `npm run lint` (in `frontend/`) | Frontend lint |
| `./scripts/install.sh` | Install to `~/.local/` |
| `./scripts/build-appimage.sh` | Build AppImage + .deb |

### Pre-Commit Checklist

1. `cargo test -p pjsip-sys` — verify FFI struct sizes
2. `cargo check`
3. `cargo clippy --all-targets -- -D warnings`
4. `npm run lint` (in `frontend/`)
5. `npx tsc --noEmit` (in `frontend/`)

## Troubleshooting

### `pjsua_init failed: 70004 (PJ_EINVAL)`

FFI struct size mismatch. Run `cargo test -p pjsip-sys`. See `packages/pjsip-sys/src/lib.rs` — the `_opaque` padding must match the actual C struct size.

### `pkg-config: libpjproject not found`

Run `./scripts/setup-pjsip.sh`, then `source ./scripts/set-env.sh`.

### No audio devices

```bash
aplay -l          # list playback devices
arecord -l        # list capture devices
sudo apt install pipewire-alsa  # if using PipeWire
```

### Icon shows generic gear in app menu

```bash
gtk-update-icon-cache ~/.local/share/icons/hicolor
```

## Project Structure

```
packages/
  pjsip-sys/       Raw FFI bindings to pjsua C API
  sip-engine/      pjsip lifecycle, call control, events
  audio-engine/    ALSA backend, ringtone, mute
  persistence/     SQLite repos (accounts, contacts, history)
  shared/          Zero-dependency types
src-tauri/         Tauri shell (commands, state, main)
frontend/          React app (views, stores, components, i18n)
scripts/           Build and install scripts
```

## Architecture

```
pjsip (C) → pjsip-sys (FFI) → sip-engine (Rust)
                                   │
                              mpsc channel
                                   │
                           Tauri event (sip:*)
                                   │
                            Zustand store
                                   │
                               React UI
```

Audio: `ALSA ← audio-engine ← Tauri commands ← React`

## License

MIT
