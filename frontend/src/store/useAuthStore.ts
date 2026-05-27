import { create } from "zustand";

export interface AccountConfig {
  id: string;
  displayName: string;
  sipUri: string;
  registrar: string;
  username: string;
  password: string;
  realm: string;
  transport: "Udp" | "Tcp" | "Tls";
}

type AccountState = "unregistered" | "registering" | "registered" | "failed";

interface AuthStore {
  account: AccountConfig | null;
  state: AccountState;
  error: string | null;
  setAccount: (account: AccountConfig) => void;
  setState: (state: AccountState) => void;
  setError: (error: string | null) => void;
  clearAccount: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  account: null,
  state: "unregistered",
  error: null,

  setAccount: (account) => set({ account, state: "registering", error: null }),
  setState: (state) => set({ state }),
  setError: (error) => set({ error, state: "failed" }),
  clearAccount: () => set({ account: null, state: "unregistered", error: null }),
}));
