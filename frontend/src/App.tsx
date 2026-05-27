import { useEffect, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
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

function App() {
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
          removeCall(callId);
          invoke("stop_ringtone").catch(() => {});
          navigate("/", { replace: true });
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
        invoke("play_ringtone").catch(() => {});
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

  if (incomingCall) {
    return (
      <PhoneShell>
        <Routes>
          <Route path="/incoming" element={<IncomingCall />} />
          <Route path="*" element={<IncomingCall />} />
        </Routes>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <Routes>
        <Route path="/" element={<Dialer />} />
        <Route path="/call/:id" element={<ActiveCall />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/history" element={<CallHistory />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/account-setup" element={<AccountSetup />} />
      </Routes>
    </PhoneShell>
  );
}

export default App;
