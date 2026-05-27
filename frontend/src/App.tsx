import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import PhoneShell from "./components/PhoneShell";
import Dialer from "./views/Dialer";
import ActiveCall from "./views/ActiveCall";
import IncomingCall from "./views/IncomingCall";
import Contacts from "./views/Contacts";
import CallHistory from "./views/CallHistory";
import Settings from "./views/Settings";
import AccountSetup from "./views/AccountSetup";
import { useAuthStore } from "./store/useAuthStore";
import { useCallStore, CallState } from "./store/useCallStore";

function App() {
  const navigate = useNavigate();
  const setState = useAuthStore((s) => s.setState);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const { setActiveCall, setIncomingCall, removeCall } = useCallStore();

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    listen<Record<string, unknown>>("sip:account-state", (event) => {
      console.log("EVENT sip:account-state", JSON.stringify(event.payload));
      const payload = event.payload as { state?: string };
      const s = payload.state === "registration_failed" ? "failed" : (payload.state as any) ?? "unregistered";
      setState(s);
    }).then((unlisten) => unlisteners.push(unlisten));

    listen<Record<string, unknown>>("sip:call-state", (event) => {
      console.log("EVENT sip:call-state", JSON.stringify(event.payload));
      const payload = event.payload as { call_id?: number; state?: string };
      const callId = String(payload.call_id ?? "?");
      const state = payload.state?.toLowerCase() as CallState | undefined;
      if (!state) return;

      if (state === "dialing") navigate(`/call/${callId}`);
      if (state === "ended" || state === "failed") {
        removeCall(callId);
        navigate("/", { replace: true });
      } else {
        setActiveCall({
          id: callId,
          direction: "outgoing",
          state,
          remoteUri: "",
          remoteName: "",
          durationSecs: 0,
          isMuted: false,
          isOnHold: false,
        });
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    listen<Record<string, unknown>>("sip:incoming-call", (event) => {
      console.log("EVENT sip:incoming-call", JSON.stringify(event.payload));
      const payload = event.payload as { call_id?: number };
      setIncomingCall({
        id: String(payload.call_id ?? "?"),
        direction: "incoming",
        state: "ringing",
        remoteUri: "",
        remoteName: "",
        durationSecs: 0,
        isMuted: false,
        isOnHold: false,
      });
    }).then((unlisten) => unlisteners.push(unlisten));

    return () => { unlisteners.forEach((fn) => fn()); };
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
