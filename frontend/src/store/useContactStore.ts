import { create } from "zustand";

export interface Contact {
  id: string;
  name: string;
  sipUri: string;
  phoneNumber?: string;
  avatarUrl?: string;
}

interface ContactStore {
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  removeContact: (id: string) => void;
}

const MOCK_CONTACTS: Contact[] = [
  { id: "c1", name: "Alice Santos", sipUri: "sip:alice@pbx.local", phoneNumber: "+55 11 99999-0001" },
  { id: "c2", name: "Bruno Oliveira", sipUri: "sip:bruno@pbx.local", phoneNumber: "+55 11 99999-0002" },
  { id: "c3", name: "Carla Mendes", sipUri: "sip:carla@pbx.local", phoneNumber: "+55 11 99999-0003" },
  { id: "c4", name: "Diego Costa", sipUri: "sip:diego@pbx.local", phoneNumber: "+55 11 99999-0004" },
  { id: "c5", name: "Elena Souza", sipUri: "sip:elena@pbx.local", phoneNumber: "+55 11 99999-0005" },
  { id: "c6", name: "Fernando Lima", sipUri: "sip:fernando@pbx.local", phoneNumber: "+55 11 99999-0006" },
];

export const useContactStore = create<ContactStore>((set) => ({
  contacts: MOCK_CONTACTS,
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  removeContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    })),
}));
