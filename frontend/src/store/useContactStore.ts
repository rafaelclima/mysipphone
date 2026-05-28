import { create } from "zustand";

export interface Contact {
  id: string;
  name: string;
  sip_uri: string;
  phone_number?: string;
  avatar_url?: string;
}

interface ContactStore {
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (contact: Contact) => void;
  removeContact: (id: string) => void;
}

export const useContactStore = create<ContactStore>((set) => ({
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  updateContact: (contact) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === contact.id ? contact : c)),
    })),
  removeContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    })),
}));
