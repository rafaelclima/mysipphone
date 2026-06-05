import { useEffect, useRef, lazy, Suspense, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { CircularProgress, Box } from "@mui/material";
import PhoneShell from "./components/PhoneShell";
import { SnackbarAlert } from "./components/SnackbarAlert";
import IncomingPopup from "./views/IncomingPopup";
import { useAuthStore, AccountConfig } from "./store/useAuthStore";
import { useCallStore, CallState } from "./store/useCallStore";
import { useAudioDevicesStore } from "./store/useAudioDevicesStore";
import { useSettingsStore } from "./store/useSettingsStore";

const Dialer = lazy(() => import("./views/Dialer"));
const ActiveCall = lazy(() => import("./views/ActiveCall"));
const IncomingCall = lazy(() => import("./views/IncomingCall"));
const Contacts = lazy(() => import("./views/Contacts"));
const CallHistory = lazy(() => import("./views/CallHistory"));
const Settings = lazy(() => import("./views/Settings"));
const AccountSetup = lazy(() => import("./views/AccountSetup"));

const pageTransitionCss = `
  @keyframes pageFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%", display: "flex", flexDirection: "column",
        animation: "pageFadeIn 0.18s ease-in-out",
      }}
    >
      <style>{pageTransitionCss}</style>
      {children}
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const setAccount = useAuthStore((s) => s.setAccount);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const setIncomingCall = useCallStore((s) => s.setIncomingCall);
  const removeCall = useCallStore((s) => s.removeCall);
  const pjsipDevices = useAudioDevicesStore((s) => s.pjsipDevices);
  const fetchDevices = useAudioDevicesStore((s) => s.fetchDevices);

  const [snack, setSnack] = useState({ open: false, msg: "" });
  const closeSnack = () => setSnack({ open: false, msg: "" });
  const unlistenersRef = useRef<(() => void)[]>([]);
  const isPopup = getCurrentWebviewWindow().label.startsWith("popup-");

  // R1: On mount, fetch audio devices so `pjsipDevices` is populated.
  // Required so the apply-persisted effect below can validate the
  // user's saved Speaker/Microphone choice against pjsip's actual
  // device list. Without this, pjsip keeps the first working device
  // it auto-selected at startup (e.g., idx 0 = lavrate) and the
  // user's persisted choice is shown in the radio but not active
  // in pjsip. The first call would then use the wrong device.
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // R1: Once pjsipDevices is available, if the user has a valid
  // persisted Speaker + Microphone choice in localStorage, apply it
  // to pjsip via `pjsua_set_snd_dev(capture, playback)`. Runs once
  // per app launch, gated by ref. Errors are logged and the user
  // retains the default pjsip startup routing; they can re-open
  // Settings to retry after a transient pjsip/ALSA failure.
  const applyPersistedRef = useRef(false);
  useEffect(() => {
    if (applyPersistedRef.current) return;
    if (pjsipDevices.length === 0) return;
    applyPersistedRef.current = true;

    const { inputDeviceId, outputDeviceId, ringtoneDeviceId } = useSettingsStore.getState();

    // R1: Speaker + Microphone → pjsip routing
    if (inputDeviceId !== null && outputDeviceId !== null) {
      const captureId = parseInt(inputDeviceId, 10);
      const playbackId = parseInt(outputDeviceId, 10);
      if (!Number.isNaN(captureId) && !Number.isNaN(playbackId)) {
        const inputDevice = pjsipDevices.find((d) => d.id === inputDeviceId);
        const outputDevice = pjsipDevices.find((d) => d.id === outputDeviceId);
        if (inputDevice && outputDevice && inputDevice.input_count > 0 && outputDevice.output_count > 0) {
          invoke("set_audio_device", { captureId, playbackId }).catch((e) => {
            console.warn("R1: failed to apply persisted audio device:", e);
          });
        } else {
          // Stale IDs (unplugged device etc.) — clear so the reapply in
          // Settings can re-seed with the current pjsip "default".
          useSettingsStore.getState().clearInputDevice();
          useSettingsStore.getState().clearOutputDevice();
        }
      }
    }

    // K6: Ringtone → AudioDeviceManager.ringtone_device (consumed by
    // `RingtonePlayer::play(device)`). The ALSA list isn't in the React
    // tree here, so we don't validate the id against a current list; the
    // backend will fail to open an unplugged device and log it. We just
    // push whatever the user last persisted.
    if (ringtoneDeviceId !== null) {
      invoke("set_audio_ringtone_device", { deviceId: ringtoneDeviceId }).catch((e) => {
        console.warn("K6: failed to apply persisted ringtone device:", e);
      });
    }
  }, [pjsipDevices]);

  useEffect(() => {
    if (isPopup) return;
    const setup = async () => {
      const u1 = await listen<Record<string, unknown>>("sip:account-state", (event) => {
        const payload = event.payload as { state?: string };
        const s = payload.state === "registration_failed" ? "failed" : (payload.state as any) ?? "unregistered";
        useAuthStore.getState().setState(s);
      });
      unlistenersRef.current.push(u1);

      const u2 = await listen<Record<string, unknown>>("sip:call-state", (event) => {
        const payload = event.payload as { call_id?: number; state?: string };
        const callId = String(payload.call_id ?? "?");
        const state = payload.state?.toLowerCase() as CallState | undefined;
        if (!state) return;

        if (state === "ended" || state === "failed") {
          const wasActive = useCallStore.getState().activeCallId === callId;
          removeCall(callId);
          invoke("stop_ringtone").catch(() => setSnack({ open: true, msg: "Falha ao parar ringtone" }));
          emit("popup:dismiss", {}).catch(() => setSnack({ open: true, msg: "Falha ao fechar popup" }));
          const remaining = useCallStore.getState().calls;
          if (remaining.length > 0 && wasActive) {
            navigate(`/call/${remaining[remaining.length - 1].id}`, { replace: true });
          } else {
            navigate("/", { replace: true });
          }
          if (useCallStore.getState().incomingCall?.id === callId) {
            setIncomingCall(null);
          }
          return;
        }

        if (state === "connected") {
          invoke("stop_ringtone").catch(() => setSnack({ open: true, msg: "Falha ao parar ringtone" }));
          const inc = useCallStore.getState().incomingCall;
          if (inc && inc.id === callId) {
            emit("popup:dismiss", {}).catch(() => setSnack({ open: true, msg: "Falha ao fechar popup" }));
            setIncomingCall(null);
          }
        }

        const existing = useCallStore.getState().calls.find((c) => c.id === callId);
        const isNew = !existing;
        if (isNew) {
          navigate(`/call/${callId}`, { replace: true });
        }
        setActiveCall({
          id: callId,
          direction: existing?.direction ?? "outgoing",
          state,
          remoteUri: existing?.remoteUri ?? "",
          remoteName: existing?.remoteName ?? "",
          durationSecs: existing?.durationSecs ?? 0,
          isMuted: existing?.isMuted ?? false,
          isOnHold: existing?.isOnHold ?? false,
        });
      });
      unlistenersRef.current.push(u2);

      const u3 = await listen<Record<string, unknown>>("sip:incoming-call", (event) => {
        const payload = event.payload as { call_id?: number; remote_uri?: string };
        const id = String(payload.call_id ?? "?");
        const remoteUri = payload.remote_uri ?? "";
        const hasActiveCalls = useCallStore.getState().calls.length > 0;
        if (!hasActiveCalls) {
          invoke("stop_ringtone").catch(() => setSnack({ open: true, msg: "Falha ao parar ringtone" }));
          invoke("play_ringtone").catch(() => setSnack({ open: true, msg: "Falha ao tocar ringtone" }));
        } else {
          emit("popup:dismiss", {}).catch(() => setSnack({ open: true, msg: "Falha ao fechar popup" }));
        }
        setIncomingCall({
          id,
          direction: "incoming",
          state: "ringing",
          remoteUri,
          remoteName: "",
          durationSecs: 0,
          isMuted: false,
          isOnHold: false,
        });
      });
      unlistenersRef.current.push(u3);

      const u4 = await listen<Record<string, unknown>>("popup:answer", (event) => {
        const payload = event.payload as { callId?: string };
        invoke("stop_ringtone").catch(() => setSnack({ open: true, msg: "Falha ao parar ringtone" }));
        setIncomingCall(null);
        if (payload.callId) {
          navigate(`/call/${payload.callId}`, { replace: true });
        }
      });
      unlistenersRef.current.push(u4);

      const u5 = await listen<Record<string, unknown>>("popup:reject", () => {
        invoke("stop_ringtone").catch(() => setSnack({ open: true, msg: "Falha ao parar ringtone" }));
        setIncomingCall(null);
        navigate("/", { replace: true });
      });
      unlistenersRef.current.push(u5);

      const saved = await invoke<AccountConfig | null>("get_active_account").catch(() => {
        setSnack({ open: true, msg: "Falha ao carregar conta salva" });
        return null;
      });
      if (saved) {
        setAccount(saved);
        invoke("register_account", { config: saved }).catch(() => setSnack({ open: true, msg: "Falha ao registrar conta" }));
      }
    };

    setup();

    return () => {
      unlistenersRef.current.forEach((fn) => fn());
      unlistenersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user is in a call and the bottom nav takes them back to the
  // Dialer (route "/"), redirect to the active call screen. The Dialer
  // is unreachable while a call is in progress — the user can return to
  // the call from any tab by clicking the Dialer button, which is also
  // the visual indicator for the active call.
  useEffect(() => {
    if (isPopup) return;
    if (location.pathname !== "/") return;
    const { activeCallId, calls } = useCallStore.getState();
    if (activeCallId && calls.length > 0) {
      navigate(`/call/${activeCallId}`, { replace: true });
    }
  }, [isPopup, location.pathname, navigate]);

  if (isPopup) return <IncomingPopup />;

  const showIncoming = incomingCall && useCallStore.getState().calls.length === 0;

  return (
    <>
      <PhoneShell>
        {showIncoming ? (
          <Routes>
            <Route path="*" element={<LazyPage><Suspense fallback={<LoadFallback />}><IncomingCall /></Suspense></LazyPage>} />
          </Routes>
        ) : (
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<LazyPage><Suspense fallback={<LoadFallback />}><Dialer /></Suspense></LazyPage>} />
            <Route path="/call/:id" element={<LazyPage><Suspense fallback={<LoadFallback />}><ActiveCall /></Suspense></LazyPage>} />
            <Route path="/contacts" element={<LazyPage><Suspense fallback={<LoadFallback />}><Contacts /></Suspense></LazyPage>} />
            <Route path="/history" element={<LazyPage><Suspense fallback={<LoadFallback />}><CallHistory /></Suspense></LazyPage>} />
            <Route path="/settings" element={<LazyPage><Suspense fallback={<LoadFallback />}><Settings /></Suspense></LazyPage>} />
            <Route path="/account-setup" element={<LazyPage><Suspense fallback={<LoadFallback />}><AccountSetup /></Suspense></LazyPage>} />
          </Routes>
        )}
      </PhoneShell>
      <SnackbarAlert open={snack.open} message={snack.msg} onClose={closeSnack} />
    </>
  );
}

function LoadFallback() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <CircularProgress size={24} />
    </Box>
  );
}

export default App;
