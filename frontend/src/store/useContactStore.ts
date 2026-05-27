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

export const useContactStore = create<ContactStore>((set) => ({
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  removeContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    })),
}));
