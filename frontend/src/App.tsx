import { useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import PhoneShell from "./components/PhoneShell";
import Dialer from "./views/Dialer";
import ActiveCall from "./views/ActiveCall";
import IncomingCall from "./views/IncomingCall";
import Contacts from "./views/Contacts";
import CallHistory from "./views/CallHistory";
import Settings from "./views/Settings";
import AccountSetup from "./views/AccountSetup";
import { useAuthStore, AccountConfig } from "./store/useAuthStore";
import { useCallStore, CallState } from "./store/useCallStore";

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {children}
    </motion.div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const setAccount = useAuthStore((s) => s.setAccount);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const { setActiveCall, setIncomingCall, removeCall } = useCallStore();

  const unlistenersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const setup = async () => {
      const u1 = await listen<Record<string, unknown>>("sip:account-state", (event) => {
        console.log("EVENT sip:account-state", JSON.stringify(event.payload));
        const payload = event.payload as { state?: string };
        const s = payload.state === "registration_failed" ? "failed" : (payload.state as any) ?? "unregistered";
        useAuthStore.getState().setState(s);
      });
      unlistenersRef.current.push(u1);

      const u2 = await listen<Record<string, unknown>>("sip:call-state", (event) => {
        console.log("EVENT sip:call-state", JSON.stringify(event.payload));
        const payload = event.payload as { call_id?: number; state?: string };
        const callId = String(payload.call_id ?? "?");
        const state = payload.state?.toLowerCase() as CallState | undefined;
        if (!state) return;

        if (state === "ended" || state === "failed") {
          const wasActive = useCallStore.getState().activeCallId === callId;
          removeCall(callId);
          invoke("stop_ringtone").catch(() => {});
          const remaining = useCallStore.getState().calls;
          if (remaining.length > 0 && wasActive) {
            navigate(`/call/${remaining[remaining.length - 1].id}`, { replace: true });
          } else {
            navigate("/", { replace: true });
          }
          return;
        }

        if (state === "connected") {
          invoke("stop_ringtone").catch(() => {});
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
        console.log("EVENT sip:incoming-call", JSON.stringify(event.payload));
        const payload = event.payload as { call_id?: number; remote_uri?: string };
        const id = String(payload.call_id ?? "?");
        const remoteUri = payload.remote_uri ?? "";
        const hasActiveCalls = useCallStore.getState().calls.length > 0;
        if (!hasActiveCalls) {
          invoke("play_ringtone").catch(() => {});
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

      const saved = await invoke<AccountConfig | null>("get_active_account").catch(() => null);
      if (saved) {
        setAccount(saved);
        invoke("register_account", { config: saved }).catch(console.error);
      }
    };

    setup();

    return () => {
      unlistenersRef.current.forEach((fn) => fn());
      unlistenersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (incomingCall && useCallStore.getState().calls.length === 0) {
    return (
      <PhoneShell>
        <Routes>
          <Route path="/incoming" element={<AnimatedPage><IncomingCall /></AnimatedPage>} />
          <Route path="*" element={<AnimatedPage><IncomingCall /></AnimatedPage>} />
        </Routes>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<AnimatedPage><Dialer /></AnimatedPage>} />
          <Route path="/call/:id" element={<AnimatedPage><ActiveCall /></AnimatedPage>} />
          <Route path="/contacts" element={<AnimatedPage><Contacts /></AnimatedPage>} />
          <Route path="/history" element={<AnimatedPage><CallHistory /></AnimatedPage>} />
          <Route path="/settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
          <Route path="/account-setup" element={<AnimatedPage><AccountSetup /></AnimatedPage>} />
        </Routes>
      </AnimatePresence>
    </PhoneShell>
  );
}

export default App;
