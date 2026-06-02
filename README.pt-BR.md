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

### AppImage (recomendado — sem precisar de ferramentas de desenvolvimento)

Baixe o AppImage mais recente da [página de releases](https://github.com/rafaelclima/mysipphone/releases):

```bash
chmod +x mySIPPhone_*.AppImage
./mySIPPhone_*.AppImage
```

### Arch Linux / Omarchy / Manjaro

```bash
# Pré-requisito: webkit2gtk-4.1 (runtime do Tauri, não incluso)
sudo pacman -S --needed webkit2gtk-4.1

# Setup automático (instala deps + baixa AppImage + cria atalho)
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/setup-arch.sh
```

O script detecta automaticamente o Hyprland (Wayland) e aplica `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

### Compilar a partir do código-fonte

```bash
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/install.sh
```

Sem necessidade de sudo. Instala em `~/.local/`:
- `~/.local/bin/mysipphone` — binário
- `~/.local/lib/mysipphone/` — bibliotecas pjsip empacotadas
- `~/.local/share/applications/mysipphone.desktop` — atalho no menu
- `~/.local/share/icons/hicolor/*/apps/mysipphone.png` — ícones

Após instalar, procure **mySIPPhone** no menu de aplicativos ou execute `mysipphone`.

### Dependências de Runtime

| Biblioteca | Finalidade |
|------------|------------|
| GTK3 + WebKit2GTK 4.1 | Webview do Tauri (presente na maioria das distros) |
| ALSA (`libasound2`) | Captura e reprodução de áudio (PipeWire oferece compatibilidade) |

## Como Usar

1. **Abra o aplicativo** — a tela de configuração de conta aparece na primeira execução.
2. **Informe seus dados SIP**: ramal, domínio, usuário, senha — mesmos dados de qualquer telefone SIP.
3. **Disque um ramal** e pressione o botão verde de chamada.
4. **Receba chamadas**: o aplicativo toca ao receber uma chamada — atenda ou recuse.
5. **Captura de chamada (`*8#`)**: disque `*8#` para capturar uma chamada tocando em outro ramal do mesmo grupo, ou `*8#ramal` para captura direcionada.
6. **Espera / Retomar**: pressione Espera durante uma chamada; pressione novamente para retomar.
7. **Transferência cega**: pressione Transferir → digite o ramal de destino → confirme. Cancele com ✕ ou Escape.
8. **Chamada em espera**: uma segunda chamada recebida exibe um banner — atender coloca a primeira em espera. Alterne livremente.
9. **Contatos**: adicione, edite e exclua contatos. Importação CSV disponível.
10. **Ajustes**: gerencie sua conta SIP, escolha dispositivos de áudio, alterne tema escuro, teste caixas de som, mude o tema do aparelho.

### Configuração da Conta

| Campo | Exemplo |
|-------|---------|
| Ramal | 595 |
| Domínio da Central | 192.168.54.2 |
| Usuário | 595 |
| Senha | sua_senha_sip |

O aplicativo faz o registro automático na central. Um indicador verde na barra de status confirma o registro.

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

# pjsip (compilação única a partir do fonte)
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
| `npm run dev` (em `frontend/`) | Servidor de desenvolvimento do frontend |
| `npx tsc --noEmit` (em `frontend/`) | Typecheck TypeScript |
| `npm run lint` (em `frontend/`) | Lint do frontend |
| `./scripts/install.sh` | Instalar em `~/.local/` |
| `./scripts/build-appimage.sh` | Gerar AppImage + .deb |

### Checklist Pré-Commit

1. `cargo test -p pjsip-sys` — verificar tamanhos das structs FFI
2. `cargo check`
3. `cargo clippy --all-targets -- -D warnings`
4. `npm run lint` (em `frontend/`)
5. `npx tsc --noEmit` (em `frontend/`)

## Solução de Problemas

### `pjsua_init failed: 70004 (PJ_EINVAL)`

Tamanho incorreto de struct FFI. Execute `cargo test -p pjsip-sys`. Veja `packages/pjsip-sys/src/lib.rs` — o padding `_opaque` deve corresponder exatamente ao tamanho real da struct C.

### `pkg-config: libpjproject not found`

Execute `./scripts/setup-pjsip.sh`, depois `source ./scripts/set-env.sh`.

### Nenhum dispositivo de áudio

```bash
aplay -l          # listar dispositivos de reprodução
arecord -l        # listar dispositivos de captura
sudo apt install pipewire-alsa  # se estiver usando PipeWire
```

### Ícone genérico no menu de aplicativos

```bash
gtk-update-icon-cache ~/.local/share/icons/hicolor
```

## Estrutura do Projeto

```
packages/
  pjsip-sys/       Bindings FFI para a API C do pjsua
  sip-engine/      Ciclo de vida do pjsip, controle de chamadas, emissão de eventos
  audio-engine/    Backend ALSA, tocador de ringtone, mudo
  persistence/     Repositórios SQLite (contas, contatos, histórico)
  shared/          Tipos sem dependências (enums, structs)
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

Caminho do áudio: `ALSA ← audio-engine ← Comandos Tauri ← React`

## Licença

MIT
