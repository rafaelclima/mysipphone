mysipphone master ❯ env WEBKIT_DISABLE_DMABUF_RENDERER=1 /home/rafaellima/.local/share/AppImage/mySIPPhone_0.1.1_amd64.AppImage
2026-05-30T22:12:12.223005Z  INFO sip_engine::account: Starting pjsip engine
2026-05-30T22:12:12.223044Z  INFO audio_engine::alsa_backend: ALSA backend initialized
19:12:12.225         os_core_unix.c !pjlib 2.17 for POSIX initialized
2026-05-30T22:12:12.228483Z  INFO audio_engine: Audio engine initialized with 3 devices
19:12:12.228         sip_endpoint.c  .Creating endpoint instance...
2026-05-30T22:12:12.228843Z  INFO mysipphone::state: Database path: /home/rafaellima/.local/share/mysipphone/mysipphone.db
19:12:12.228                  pjlib  .select() I/O Queue created (0x7fd364011208)
19:12:12.228         sip_endpoint.c  .Module "mod-msg-print" registered
19:12:12.228        sip_transport.c  .Transport manager created.
19:12:12.228           pjsua_core.c  .PJSUA state changed: NULL --> CREATED
19:12:12.228         os_core_unix.c  Info: possibly re-registering existing thread
19:12:12.229         sip_endpoint.c !.Module "mod-pjsua-log" registered
19:12:12.229         sip_endpoint.c  .Module "mod-tsx-layer" registered
19:12:12.229         sip_endpoint.c  .Module "mod-stateful-util" registered
19:12:12.229         sip_endpoint.c  .Module "mod-ua" registered
19:12:12.229         sip_endpoint.c  .Module "mod-100rel" registered
19:12:12.229         sip_endpoint.c  .Module "mod-pjsua" registered
19:12:12.229         sip_endpoint.c  .Module "mod-invite" registered
19:12:12.298             alsa_dev.c  ..ALSA driver found 3 devices
19:12:12.298             alsa_dev.c  ..ALSA initialized
19:12:12.299                  pjlib  ..select() I/O Queue created (0x7fd364077f68)
19:12:12.303         sip_endpoint.c  .Module "mod-evsub" registered
19:12:12.303         sip_endpoint.c  .Module "mod-presence" registered
19:12:12.303         sip_endpoint.c  .Module "mod-dlg_even" registered
19:12:12.303         sip_endpoint.c  .Module "mod-mwi" registered
19:12:12.303         sip_endpoint.c  .Module "mod-refer" registered
19:12:12.303         sip_endpoint.c  .Module "mod-pjsua-pres" registered
19:12:12.303         sip_endpoint.c  .Module "mod-unsolicited-mwi" registered
19:12:12.303         sip_endpoint.c  .Module "mod-pjsua-im" registered
19:12:12.303         sip_endpoint.c  .Module "mod-pjsua-options" registered
19:12:12.303           pjsua_core.c  .1 SIP worker threads created
19:12:12.303           pjsua_core.c  .pjsua version 2.17 for Linux-7.0.9/x86_64/glibc-2.39 initialized
19:12:12.303           pjsua_core.c  .PJSUA state changed: CREATED --> INIT
19:12:12.303           pjsua_core.c  PJSUA state changed: INIT --> STARTING
19:12:12.303           pjsua_core.c  .PJSUA state changed: STARTING --> RUNNING
19:12:12.304           pjsua_core.c  SIP UDP socket reachable at 192.168.2.17:5060
19:12:12.304      udp0x7fd36409ca40  SIP UDP transport started, published address is 192.168.2.17:5060
2026-05-30T22:12:12.304421Z  INFO sip_engine::account: UDP transport created on port 5060
  device 0: pipewire (in=0, out=0, rate=0)
  device 1:  (in=0, out=0, rate=0)
  device 2:  (in=0, out=0, rate=0)
19:12:12.304            pjsua_aud.c  Setting null sound device..
19:12:12.304            pjsua_aud.c  .Opening null sound device..
2026-05-30T22:12:12.304638Z  INFO sip_engine::account: No working sound device found, using null device
2026-05-30T22:12:12.421011Z  INFO mysipphone: EVENT_RX: variant=Discriminant(0)
2026-05-30T22:12:12.421027Z  INFO mysipphone: Emitting Tauri event event_name="sip:engine-started" payload={"type":"EngineStarted"}
2026-05-30T22:12:12.421035Z  INFO mysipphone: emit done
Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...
2026-05-30T22:12:17.421215Z DEBUG mysipphone: event loop heartbeat alive
2026-05-30T22:12:22.421213Z DEBUG mysipphone: event loop heartbeat alive
2026-05-30T22:12:27.420957Z DEBUG mysipphone: event loop heartbeat alive
2026-05-30T22:12:32.420568Z DEBUG mysipphone: event loop heartbeat alive
2026-05-30T22:12:37.420671Z DEBUG mysipphone: event loop heartbeat alive
2026-05-30T22:12:42.421249Z DEBUG mysipphone: event loop heartbeat alive
