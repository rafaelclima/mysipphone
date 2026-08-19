# Manual Test Suite — mySIPPhone

## Preparação

1. Build o app: `cargo tauri dev` (ou `npm run build` no frontend + `cargo build` pra testar só Rust)
2. Mantenha o terminal rodando `cargo tauri dev` aberto para capturar logs
3. Abra o DevTools da janela Tauri (clicar com direito → Inspect, ou atalho)
4. Tenha um **segundo ramal SIP real** para fazer chamadas de/para o app
5. Tenha um **arquivo CSV** de exemplo para teste de import:
   ```
   Alice,100
   Bob,101,(11) 91234-5678
   Charlie,sip:102@dominio
   ```
6. **Atalhos de log**:
   - `cargo tauri dev 2>&1 | grep -E "sip_engine|audio_engine|mysipphone"` — filtra logs do app
   - DevTools Console: `localStorage.clear()` — limpa estado entre testes
   - DevTools Console: `useCallStore.getState()` — inspeciona estado atual das chamadas

---

## 1. Registro SIP

### 1.1 Registro bem-sucedido

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Inicie o app | Tela Dialer aparece |
| 2 | Vá em Settings → toque na linha SIP Account | Navega para AccountSetup |
| 3 | Preencha Display Name, SIP URI, Registrar, Username, Password — **SIP URI e Registrar exigem o prefixo `sip:`** (ex.: `sip:595@192.168.54.2` e `sip:192.168.54.2`; sem o prefixo o registro falha com `PJSIP_EINVALIDURI` 171039) | Campos preenchidos |
| 4 | Toque **Register** | Botão desabilita, feedback visual de registro |
| 5 | Aguarde ~2-5s | Chip no Settings muda para **Registered** (verde) |

**Log esperado no terminal:**
```
sip_engine: Registration state: acc_id=0, code=200
sip_engine: Registration success for account 0
```

**Log se falhar (coletar o bloco):**
```
sip_engine: Registration state: acc_id=0, code=403
sip_engine: Registration failed (code=403), retry #1 in 1000ms
```

**O que verificar:** Chip verde "Registered" em Settings. Barra de status no topo mostra registro.

---

### 1.2 Falha de registro (senha errada)

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Settings → SIP Account → altere a senha para uma errada | — |
| 2 | Toque **Update** | App tenta registrar |
| 3 | Aguarde | Chip muda para **Failed** (vermelho) |
| 4 | Observe logs | Backoff exponencial: 1s, 2s, 4s... |
| 5 | Corrija a senha, toque Update | Recupera e volta para Registered |

**Log esperado:**
```
sip_engine: Registration state: acc_id=0, code=403
sip_engine: Registration failed (code=403), retry #1 in 1000ms
sip_engine: RetryRegister success for acc_id=0
(silêncio de 1s)
sip_engine: Registration state: acc_id=0, code=403
sip_engine: Registration failed (code=403), retry #2 in 2000ms
...
sip_engine: Registration state: acc_id=0, code=200  ← após corrigir senha
```

**O que coletar se falhar:** Capturar o log inteiro de `sip_engine` dos segundos entre o update e a correção.

---

### 1.3 Reconexão automática

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | App rodando com registro OK (chip verde) | — |
| 2 | Force o servidor SIP a desconectar (ou desative a rede) | Chip fica Failed |
| 3 | Espere alguns segundos | App tenta reconectar com backoff |
| 4 | Restaure a rede | App reconecta, chip volta a Registered |

**Log esperado:**
```
sip_engine: Registration state: acc_id=0, code=408  (ou 503, etc)
sip_engine: Registration failed (code=408), retry #1 in 1000ms
sip_engine: RetryRegister success for acc_id=0
... (delay aumenta)
sip_engine: Registration state: acc_id=0, code=200  ← reconectou
```

**Importante:** O backoff máximo é 60s. Pode levar até 1 minuto entre tentativas após várias falhas.

---

## 2. Chamadas

### 2.1 Chamada outgoing básica

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | App aberto na Dialer | — |
| 2 | Disque o número do outro ramal | Número aparece no display |
| 3 | Toque no ícone verde de telefone (ou Enter no teclado) | Navega para ActiveCall |
| 4 | Aguarde o outro ramal atender | Timer de duração aparece |
| 5 | Ambos falam | Áudio bidirecional |

**Log esperado:**
```
sip_engine: Making call to sip:100@dominio
sip_engine: Call state changed: call_id=0, state=5  (CONNECTING)
sip_engine: Call state changed: call_id=0, state=6  (CONFIRMED/CONNECTED)
sip_engine: Call media state changed: call_id=0
sip_engine: Call media connected: call_id=0
```

**Evento DevTools (console):**
```
EVENT sip:call-state {"type":"CallStateChanged","call_id":0,"state":"Connected"}
```

**Se não houver áudio** (`Call media connected` aparece mas não se ouve):
- Verificar dispositivos de áudio em Settings
- Rodar `speaker-test -t sine -f 440` no terminal para testar ALSA

---

### 2.2 Receber chamada incoming

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | App aberto na Dialer (sem chamada ativa) | — |
| 2 | Ligue do outro ramal para o ramal do app | Tela **Incoming Call** aparece em tela cheia |
| 3 | Toque **Answer** (ou Enter) | Chamada conecta, ActiveCall com timer |
| 4 | Encerre a chamada | Volta para Dialer |

**Log esperado:**
```
sip_engine: Incoming call: acc_id=0, call_id=1
sip_engine: Call state changed: call_id=1, state=3  (RINGING → INCOMING)
sip_engine: Answering call: 1
sip_engine: Call state changed: call_id=1, state=6  (CONNECTED)
sip_engine: Call media connected: call_id=1
```

**Se a tela Incoming Call não aparecer:** Verificar evento `sip:incoming-call` no console DevTools.

---

### 2.3 Encerrar chamada por cada lado

| Cenário | Ação | Resultado | end_reason esperado no histórico |
|---------|------|-----------|----------------------------------|
| Local hangup | ActiveCall → toque ✕ | Timer para, volta ao Dialer | `local_hangup` |
| Remote hangup | Outro ramal desliga | Timer para, volta ao Dialer | `remote_hangup` |

**Log:**
```
sip_engine: Call state changed: call_id=0, state=7  (DISCONNECTED/ENDED)
mysipphone: Emitting Tauri event {"event":"sip:call-log","type":"CallEnded","entry":{"end_reason":"local_hangup",...}}
```

**Verificar no histórico:** Acessar CallHistory → o registro deve mostrar o ícone correto (↗ local, ↙ remote).

---

### 2.4 End reason — cenários avançados

| Cenário | Como testar | end_reason esperado |
|----------|-------------|---------------------|
| Chamada recebida e **rejeitada** | Incoming → toque Reject | `rejected` |
| Chamada para ramal **ocupado** | Disque um ramal em chamada ativa | `busy` |
| Chamada **não atendida** | Disque o ramal, deixe tocar até timeout | `no_answer` |
| Chamada recebida e **você desliga** | Answer → depois ✕ | `local_hangup` |
| Chamada recebida e **outro desliga** | Answer → outro lado ✕ | `remote_hangup` |

**Verificação:** CallHistory → olhar coluna de status para cada entrada.

**Log para Busy (486):**
```
sip_engine: Call state changed: call_id=2, state=7
sip_engine: last_status=486 → Busy
```

**Log para NoAnswer (408):**
```
sip_engine: Call state changed: call_id=2, state=7
sip_engine: last_status=408 → NoAnswer
```

---

### 2.5 DTMF durante chamada

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Chamada ativa | — |
| 2 | Toque no botão **Keypad** na ActiveCall | Teclado numérico aparece |
| 3 | Toque dígitos (ex: 1, 2, 3, #) | Tons DTMF enviados |
| 4 | Alternativa: teclado físico (se keypad aberto) | Mesmo resultado |

**Log:**
```
sip_engine: Sending DTMF: 123#
sip_engine: DTMF sent successfully
```

**O que coletar se falhar:** O evento `sip:dtmf` aparece no DevTools? O log mostra `sip_engine: DTMF sent successfully`?

---

## 3. Multi-line (Call Waiting)

### 3.1 Segunda chamada incoming durante chamada ativa

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Chamada ativa com ramal A | ActiveCall visível |
| 2 | Ramal B liga para você | **IncomingBanner** aparece no topo do ActiveCall (NÃO tela cheia) |

**Log:**
```
sip_engine: Incoming call: acc_id=0, call_id=2
(ringtone NÃO toca — apenas se for a primeira chamada)
```

**Evento DevTools:**
```
EVENT sip:incoming-call {"call_id":2,"remote_uri":"sip:..."}  ← banner aparece
```

---

### 3.2 Atender segunda chamada

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Banner visível com ramal B | — |
| 2 | Toque **Answer** no banner | Ramal A é colocado em espera, Ramal B conecta |
| 3 | Observe a tela | Ramal A aparece na lista "Calls waiting" com badge **HOLD** |

**Log:**
```
sip_engine: Holding call: 0  ← colocou A em espera
sip_engine: Answering call: 2  ← atendeu B
sip_engine: Call media connected: call_id=2
```

**Verificação visual:** ActiveCall mostra:
- Chamada ativa (B) com timer rodando
- Ramal A na lista com "HOLD" badge

---

### 3.3 Swap entre chamadas

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Duas chamadas (A em espera, B ativa) | — |
| 2 | Toque no item **A** na lista "Calls waiting" | A vira ativa, B vai pra espera |

**Log:**
```
sip_engine: Holding call: 2  ← colocou B em espera
sip_engine: Unholding call: 0  ← retomou A
sip_engine: Call media connected: call_id=0
```

---

### 3.4 Encerrar uma, voltar pra outra

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Duas chamadas (A ativa, B em espera) | — |
| 2 | Toque ✕ na chamada ativa A | A encerra, B sai da espera automaticamente |
| 3 | Observe | B vira a chamada ativa, sem navegar para Dialer |

**Log:**
```
sip_engine: Call state changed: call_id=0, state=7  (A ended)
sip_engine: Unholding call: 2  (B auto-retomada)
sip_engine: Call media connected: call_id=2
```

---

## 4. Recursos de Chamada

### 4.1 Hold / Unhold

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Chamada ativa | — |
| 2 | Toque **Hold** (⏸) | Áudio pausa, badge **HOLD** aparece no número |
| 3 | Toque **Resume** (▶) | Áudio volta |

**Log:**
```
sip_engine: Holding call: 0
sip_engine: Unholding call: 0
sip_engine: Call media connected: call_id=0
```

---

### 4.2 Mute

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Chamada ativa | — |
| 2 | Toque **Mute** (🎤 com risco) | Ícone fica ativo (ex: vermelho) |
| 3 | Fale | O outro lado NÃO ouve |
| 4 | Toque Mute novamente | O outro lado ouve de novo |

**Log:**
```
audio_engine: Mute enabled
audio_engine: Mute disabled
```

**Nota:** Mute é gerenciado pelo `audio-engine` (`AudioCommand::SetMute`), NÃO pelo pjsip.

---

### 4.3 Blind Transfer

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Chamada ativa com ramal A | — |
| 2 | Toque **Transfer** | Input field aparece ("Target number") |
| 3 | Digite o ramal de destino C (ex: 103) | — |
| 4 | Toque o ícone de confirmação (➡) | Chamada é transferida de A para C |
| 5 | Observe | Tela volta para Dialer |

**Log:**
```
sip_engine: Transferring call 0 to sip:103@dominio
sip_engine: Call state changed: call_id=0, state=7 (ended — transferred)
```

---

### 4.4 Call Pickup (*8#)

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | App aberto na Dialer | — |
| 2 | Toque no botão laranja **Pickup** (⭐) no canto inferior | Display mostra `*8#` |
| 3 | Toque o ícone de telefone (ou Enter) | App disca `sip:*8%23@dominio` |

**Log:**
```
sip_engine: Making call to sip:*8%23@dominio
```

**Nota:** O `#` é enviado como `%23` conforme RFC. Se o PABX não aceitar, pode ser necessário testar com `*8` direto.

---

## 5. Histórico

### 5.1 Persistência entre restart

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Faça algumas chamadas (pelo menos 3 tipos diferentes) | Histórico populado |
| 2 | Feche o app (Settings → Quit) | App encerra |
| 3 | Reabra o app (`cargo tauri dev`) | — |
| 4 | Vá em CallHistory | Histórico **preservado** com as mesmas entradas |

**Arquivo de banco:** `/tmp/mysipphone.db` — use `sqlite3 /tmp/mysipphone.db "SELECT * FROM call_log;"` para verificar diretamente.

**Se falhar:** Verificar se o log mostra "Database opened at /tmp/mysipphone.db" na inicialização.

---

### 5.2 Direção e end_reason corretos

| Passo | Ação | CallHistory deve mostrar |
|-------|------|--------------------------|
| 1 | Faça chamada **outgoing** (você liga) | Ícone ↗ e `outgoing` |
| 2 | Receba chamada **incoming** e atenda | Ícone ↙ e `incoming` |
| 3 | Você desliga primeiro | `local_hangup` |
| 4 | Outro lado desliga primeiro | `remote_hangup` |
| 5 | Ramal ocupado | `busy` |
| 6 | Chamada não atendida (timeout) | `no_answer` e marcado como perdida |

**Verificação:** O chip na CallHistory deve mostrar:
- "Missed" para `no_answer` e `busy` (em chamadas incoming)
- Timestamp correto
- Duração > 0 para chamadas atendidas

---

### 5.3 Ligar do histórico

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Vá em CallHistory | Lista de chamadas |
| 2 | Toque no ícone **📞** (PhoneIcon) ao lado de uma entrada | Navega para Dialer e inicia chamada para aquele URI |

**Log:**
```
sip_engine: Making call to sip:100@dominio
```

---

### 5.4 Chamada perdida identificada

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Receba chamada e **não atenda** (deixe cair) | — |
| 2 | Vá em CallHistory | A chamada aparece com badge "Missed" |

**O que verificar:** A cor/estilo da chamada perdida é diferente das demais (ex: texto em vermelho ou badge "Missed").

---

## 6. Contatos

### 6.1 CRUD (Adicionar / Editar / Excluir)

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Vá em Contacts | Lista de contatos (vazia se primeira vez) |
| 2 | Toque **+** (Adicionar) | Dialog abre |
| 3 | Preencha: Nome="Alice", Número="100" | Campo helper mostra `sip:100@dominio` |
| 4 | Toque **Save** | Contato aparece na lista |
| 5 | Toque **✏️** no contato | Dialog com dados preenchidos |
| 6 | Altere o nome para "Alice Silva", Save | Nome atualizado |
| 7 | Toque **🗑️** no contato | Contato removido da lista |

**Verificação SQLite:**
```bash
sqlite3 /tmp/mysipphone.db "SELECT * FROM contacts;"
```

---

### 6.2 Ligar do contato

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Contato salvo (ex: "Bob", ramal 101) | — |
| 2 | Toque **📞** ao lado do contato | Navega para Dialer e inicia chamada para `sip:101@dominio` |

---

### 6.3 Importar CSV

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Contacts → toque **📁** (FileUpload) ao lado do + | File picker abre |
| 2 | Selecione o arquivo CSV de exemplo | Dialog de preview aparece com os contatos |
| 3 | Verifique a lista de contatos a importar | Nomes e SIP URIs corretos |
| 4 | Toque **Import** | Contatos adicionados, lista atualizada |
| 5 | Feche e reabra Contacts | Contatos persistem |

**Log se falhar:**
```
[ERROR] Failed to import Charlie: ...
```

**Formato CSV esperado:**
```csv
Nome,Ramal,Telefone (opcional)
Alice,100,
Bob,101,(11) 91234-5678
Charlie,sip:102@dominio,
```

---

### 6.4 Busca por nome/URI

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Contacts com alguns contatos salvos | — |
| 2 | Digite no campo de busca "Ali" | Filtra para mostrar apenas Alice |
| 3 | Limpe a busca | Todos os contatos reaparecem |

---

## 7. Configurações

### 7.1 Dispositivos de áudio

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Vá em Settings → expanda **Audio Devices** | Lista de speakers, microphones, ringtone |
| 2 | Dispositivo padrão tem chip "Default" | — |
| 3 | Selecione um speaker diferente | Rádio muda, escolha persiste |

**Log:**
```
audio_engine: Output device set to: hw:0,0
```

**Dica:** Use `aplay -l` no terminal para listar dispositivos ALSA disponíveis.

---

### 7.2 Test Tone no speaker

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Settings → Audio Devices | — |
| 2 | Toque no 🔊 (VolumeUpOutlined) ao lado de um speaker | Tom de 1000Hz toca por ~400ms no dispositivo selecionado |

**Log:**
```
None (execução síncrona no audio-engine)
```

**Se não ouvir nada:** O dispositivo selecionado está correto? Teste com `speaker-test -D hw:0,0 -t sine -f 440`.

---

### 7.3 Hotplug (USB / Bluetooth)

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Settings → Audio Devices aberto | Lista atual de dispositivos |
| 2 | Conecte um fone USB ou Bluetooth | Após ~2s, lista é atualizada automaticamente |
| 3 | Desconecte o fone | Após ~2s, lista é atualizada |

**Log:**
```
audio_engine: Audio devices changed: 3 -> 5
mysipphone: Emitting Tauri event {"event":"sip:devices-changed",...}
```

**Não removeu o dispositivo:** O polling é a cada 2s. Aguarde até 2s para ver a mudança.

---

### 7.4 Dark Mode

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Settings → Dark Mode toggle | Alterna entre tema claro/escuro |
| 2 | Navegue para outras telas | Tema consistente em todas |

---

### 7.5 Idioma (EN ↔ PT-BR)

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Settings → Language selector | Mude para "Português" |
| 2 | Navegue para todas as telas | Textos em português |
| 3 | Mude para "English" | Textos em inglês |
| 4 | Feche e reabra o app | Idioma persiste (salvo em localStorage) |

---

## 8. Navegação e UX

### 8.1 Animações de transição

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Toque em Contacts (NavigationBar) | Transição fade+slide da direita |
| 2 | Toque em History | Transição fade+slide |
| 3 | Toque em Settings | Transição fade+slide |
| 4 | Toque em Dial | Transição fade+slide |

**Nota:** As animações usam `framer-motion` com duração de 180ms. Devem ser suaves e não causar clipe visual.

---

### 8.2 Teclado físico

| Tecla | Contexto | Ação esperada |
|-------|----------|---------------|
| `0-9` | Dialer | Dispa o dígito |
| `*` | Dialer | Dispa `*` |
| `#` | Dialer | Dispa `#` (exibe como `#` no display) |
| `Enter` | Dialer | Inicia chamada (wrap com domínio) |
| `Escape` | ActiveCall (keypad aberto) | Fecha o keypad |
| `Escape` | ActiveCall (transfer aberto) | Fecha o transfer input |
| `Enter` | ActiveCall (transfer aberto) | Confirma transferência |
| `0-9*#` | ActiveCall (keypad aberto) | Envia DTMF |
| `Escape` | IncomingCall | Rejeita chamada |
| `Enter` | IncomingCall | Atende chamada |

---

### 8.3 Fechar transfer com Escape / ✕

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Chamada ativa → toque Transfer | Input field aparece |
| 2 | Pressione `Escape` | Input field fecha, botões normais reaparecem |
| 3 | Toque Transfer novamente → toque ✕ no input | Input field fecha |

---

## 9. Resiliência

### 9.1 Derrubar rede durante chamada

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Chamada ativa (áudio funcionando) | — |
| 2 | Desligue a rede (Wi-Fi / cabo) | Áudio pode falhar |
| 3 | Aguarde ~30s | Chamada pode cair (timeout SIP) |
| 4 | Religue a rede | App tenta re-registrar com backoff |
| 5 | Registro recupera | App volta a funcionar |

**Log:**
```
sip_engine: Registration failed (code=408), retry #1 in 1000ms
sip_engine: Call state changed: call_id=0, state=7  (call drops)
...
sip_engine: Registration state: acc_id=0, code=200  (re-registered)
```

---

### 9.2 Matar e religar app

| Passo | Ação | Resultado |
|-------|------|-----------|
| 1 | Faça algumas chamadas, salve contatos, mude configurações | — |
| 2 | `Ctrl+C` no terminal do `cargo tauri dev` | App fecha |
| 3 | Reabra com `cargo tauri dev` | — |
| 4 | Verifique: | Histórico preservado ✅ |
| 5 | | Contatos preservados ✅ |
| 6 | | Configurações de áudio preservadas ✅ |
| 7 | | Conta SIP é recarregada e registra automaticamente ✅ |

**Log esperado após restart:**
```
mysipphone: Database opened at /tmp/mysipphone.db
sip_engine: Account restored from DB, registering...
sip_engine: Registration state: acc_id=0, code=200
```

---

## 11. Instalação e Ícones

### 11.1 Instalação completa (install.sh)

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Rode `./scripts/install.sh` | Script completa todos os 5 passos sem erro |
| 2 | Verifique `~/.local/bin/mysipphone` | Binário existe, `ldd` não mostra "not found" |
| 3 | Verifique `~/.local/lib/mysipphone/*.so.2` | 17 arquivos `.so` com RUNPATH `$ORIGIN` |
| 4 | Verifique `~/.local/share/applications/mysipphone.desktop` | Desktop entry com `Icon=` (caminho absoluto) |
| 5 | Verifique `~/.local/share/icons/hicolor/*/apps/mysipphone.png` | 7 tamanhos de ícone instalados |
| 6 | Verifique `~/.local/share/icons/hicolor/index.theme` | Arquivo existe (para gtk-update-icon-cache) |
| 7 | Verifique `~/.local/share/icons/hicolor/icon-theme.cache` | Cache de ícones atualizado |

**Verificação técnica:**
```bash
# Sem libs não resolvidas
ldd ~/.local/bin/mysipphone | grep "not found" | wc -l  # deve ser 0
# RUNPATH no binário
readelf -d ~/.local/bin/mysipphone | grep RUNPATH
# Deve mostrar: Biblioteca runpath: [$ORIGIN/../lib/mysipphone]
```

**Log de sucesso esperado:**
```
=== mySIPPhone instalado com sucesso! ===
  Binário:  /home/user/.local/bin/mysipphone
  Libs:     /home/user/.local/lib/mysipphone
```

---

### 11.2 FFI Struct Sizes

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Rode `cargo test -p pjsip-sys` | Test `verify_struct_sizes` passa |
| 2 | Verifique no código `packages/pjsip-sys/src/lib.rs` | `pjsua_config._opaque: [u8; 2640]` |

Se o teste falhar, os tamanhos das structs C mudaram (pjsip atualizado ou plataforma diferente).
Use o programa C em `scripts/check_struct_sizes.c` para medir os tamanhos reais.

**Valores atuais (pjsip 2.17, x86_64):**
| Struct | Tamanho Real | Opaque Rust |
|--------|-------------|-------------|
| `pjsua_config` | 2648 | `[u8; 2640]` |
| `pjsua_logging_config` | 48 | `[u8; 2048]` |
| `pjsua_media_config` | 832 | `[u8; 2048]` |
| `pjsua_acc_config` | 4960 | (full fields) |
| `pjsua_callback` | 464 | (C helpers) |

---

### 11.3 Ícone no Menu

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Após instalação, procure "mySIPPhone" no menu de apps | Ícone personalizado (não genérico) aparece |
| 2 | Abra o app pelo menu | Janela abre com 320×600, sem decorações |
| 3 | Verifique o ícone na dock/taskbar | Ícone do app aparece (pode precisar re-logar) |

**Se o ícone no menu for genérico:**
```bash
# Forçar refresh do cache de ícones
gtk-update-icon-cache ~/.local/share/icons/hicolor
```

**Se o ícone da janela for genérico mas o do menu estiver correto:**
- O WM_CLASS no `.desktop` deve ser `com.mysipphone.desktop`
- Pode precisar re-logar para o desktop associar a janela ao atalho

---

## 12. Coleta de Logs para Reportar Bugs

Sempre que encontrar um problema, capture:

1. **Log completo do terminal** (mínimo 20 linhas antes e depois do erro):
   ```bash
   cargo tauri dev 2>&1 | tee /tmp/mysipphone-test.log
   ```

2. **Console do DevTools** (Copy all → salve em arquivo)

3. **Estado do banco** (se relevante):
   ```bash
   sqlite3 /tmp/mysipphone.db ".dump"
   ```

4. **Passo-a-passo para reproduzir:** Qual teste da lista acima estava executando, e em qual passo exato ocorreu o erro.

5. **Comportamento esperado vs observado:** O que deveria acontecer e o que aconteceu de fato.

---

## Marcador de Progresso

```markdown
- [ ] 1.1 Registro bem-sucedido
- [ ] 1.2 Falha de registro
- [ ] 1.3 Reconexão automática
- [ ] 2.1 Chamada outgoing
- [ ] 2.2 Chamada incoming
- [ ] 2.3 Encerrar (local/remoto)
- [ ] 2.4 End reason (busy, no answer, rejected)
- [ ] 2.5 DTMF
- [ ] 3.1 IncomingBanner
- [ ] 3.2 Atender segunda chamada (hold)
- [ ] 3.3 Swap
- [ ] 3.4 Encerrar uma, voltar pra outra
- [ ] 4.1 Hold/Unhold
- [ ] 4.2 Mute
- [ ] 4.3 Blind transfer
- [ ] 4.4 Call Pickup
- [ ] 5.1 Persistência
- [ ] 5.2 Direção e end_reason
- [ ] 5.3 Ligar do histórico
- [ ] 5.4 Chamada perdida
- [ ] 6.1 CRUD contatos
- [ ] 6.2 Ligar do contato
- [ ] 6.3 Importar CSV
- [ ] 6.4 Busca
- [ ] 7.1 Dispositivos de áudio
- [ ] 7.2 Test tone
- [ ] 7.3 Hotplug
- [ ] 7.4 Dark mode
- [ ] 7.5 Idioma
- [ ] 8.1 Animações
- [ ] 8.2 Teclado
- [ ] 8.3 Transfer cancel (Escape/✕)
- [ ] 9.1 Derrubar rede
- [ ] 9.2 Matar e religar
```

---

## 10. Validação Arch/Omarchy (Hyprland, AMD Baffin) — 2026-08

### 10.1 Build nativo (release, `opt-level = 0`)

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | `PKG_CONFIG_PATH=$PWD/pjsip-dist/lib/pkgconfig cargo build --release` | Compila sem erros (~2 min na máquina de teste) |
| 2 | Executar binário com `LD_LIBRARY_PATH=$PWD/pjsip-dist/lib` | Janela mapeia; WebKitWebProcess do sistema spawna |
| 3 | Conferir `hyprctl clients` | `class: mysipphone`, janela 320×600, flutuante (com regra Hyprland) |

**Logs esperados (binário nativo):**
```
sip_engine::account: Starting pjsip engine
sip_engine::account: UDP transport created on port 5060
audio_engine: Audio engine initialized with 15 devices
```

**O que verificar:** UI renderiza (nenhum `EGL_BAD_PARAMETER`), registro SIP,
áudio bidirecional em chamada.

### 10.2 AppImage (fallback sem recompilar)

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | `./mySIPPhone_0.1.3_amd64.AppImage --appimage-extract` | Extrai em `squashfs-root/` |
| 2 | `LD_LIBRARY_PATH=/usr/lib:./squashfs-root/usr/lib/mysipphone ./squashfs-root/usr/bin/mysipphone` | Janela renderiza (WebKit do sistema em vez do embutido) |
| 3 | Rodar o AppImage direto (controle) | **Falha esperada**: `Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...`, janela em branco |

### 10.3 Janela em formato celular (Hyprland)

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Regra: `o.window("mysipphone", { float = true, center = true, size = { 320, 600 } })` em `~/.config/hypr/hyprland.lua` | `hyprctl reload` sem erros |
| 2 | Abrir o app | Janela flutuante centralizada 320×600 (não esticada pelo tiling) |
| 3 | `hyprctl clients -j` | `size [320, 600]`, `floating: True` |
