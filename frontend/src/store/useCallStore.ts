import { create } from "zustand";

export type CallState = "idle" | "dialing" | "ringing" | "connecting" | "connected" | "held" | "ended" | "failed";

export interface Call {
  id: string;
  direction: "outgoing" | "incoming";
  state: CallState;
  remoteUri: string;
  remoteName: string;
  durationSecs: number;
  isMuted: boolean;
  isOnHold: boolean;
}

interface CallStore {
  calls: Call[];
  activeCallId: string | null;
  incomingCall: Call | null;
  setActiveCall: (call: Call) => void;
  removeCall: (id: string) => void;
  updateCallState: (id: string, state: CallState) => void;
  setIncomingCall: (call: Call | null) => void;
  setMuted: (id: string, muted: boolean) => void;
  setHold: (id: string, held: boolean) => void;
}

export const useCallStore = create<CallStore>((set) => ({
  calls: [],
  activeCallId: null,
  incomingCall: null,

  setActiveCall: (call) =>
    set((state) => ({
      calls: [...state.calls.filter((c) => c.id !== call.id), call],
      activeCallId: call.id,
    })),

  removeCall: (id) =>
    set((state) => ({
      calls: state.calls.filter((c) => c.id !== id),
      activeCallId: state.activeCallId === id ? null : state.activeCallId,
    })),

  updateCallState: (id, state) =>
    set((prev) => ({
      calls: prev.calls.map((c) => (c.id === id ? { ...c, state } : c)),
    })),

  setIncomingCall: (call) => set({ incomingCall: call }),

  setMuted: (id, muted) =>
    set((prev) => ({
      calls: prev.calls.map((c) => (c.id === id ? { ...c, isMuted: muted } : c)),
    })),

  setHold: (id, held) =>
    set((prev) => ({
      calls: prev.calls.map((c) => (c.id === id ? { ...c, isOnHold: held } : c)),
    })),
}));
