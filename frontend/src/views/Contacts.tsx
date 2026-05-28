import { useEffect, useState } from "react";
import {
  Box, List, ListItem, ListItemText, ListItemAvatar, Avatar, Typography,
  TextField, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PhoneIcon from "@mui/icons-material/Phone";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useContactStore, Contact } from "../store/useContactStore";
import { useAuthStore } from "../store/useAuthStore";
import { useTranslation } from "../i18n";

function extractDomain(): string {
  const account = useAuthStore.getState().account;
  if (!account) return "";
  const uri = account.sip_uri || account.registrar || "";
  const m = uri.match(/@(.+)/);
  return m ? m[1] : "";
}

function stripDomain(uri: string): string {
  const m = uri.match(/^sip:(.+)@/);
  return m ? m[1] : uri;
}

function Contacts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const contacts = useContactStore((s) => s.contacts);
  const { setContacts, addContact, updateContact, removeContact } = useContactStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", extension: "", phone_number: "" });

  const domain = extractDomain();

  useEffect(() => {
    invoke<Contact[]>("get_contacts")
      .then(setContacts)
      .catch(console.error);
  }, [setContacts]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", extension: "", phone_number: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ name: c.name, extension: stripDomain(c.sip_uri), phone_number: c.phone_number || "" });
    setDialogOpen(true);
  };

  const buildSipUri = (ext: string): string => {
    const e = ext.trim();
    if (e.startsWith("sip:")) return e;
    if (e.includes("@")) return e.startsWith("sip:") ? e : `sip:${e}`;
    return domain ? `sip:${e}@${domain}` : `sip:${e}`;
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.extension.trim()) return;
    const sip_uri = buildSipUri(form.extension);
    const contact: Contact = {
      id: editing?.id || crypto.randomUUID(),
      name: form.name.trim(),
      sip_uri,
      phone_number: form.phone_number.trim() || undefined,
    };
    try {
      await invoke("add_contact", { contact });
      if (editing) {
        updateContact(contact);
      } else {
        addContact(contact);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Save contact failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_contact", { contactId: id });
      removeContact(id);
    } catch (err) {
      console.error("Delete contact failed:", err);
    }
  };

  const handleCall = (uri: string) => {
    navigate("/");
    setTimeout(() => {
      invoke("make_call", { uri }).catch(console.error);
    }, 100);
  };

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sip_uri.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6">{t("contacts.title")}</Typography>
        <IconButton size="small" onClick={openAdd} sx={{ bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } }}>
          <AddIcon />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder={t("contacts.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1 }}
      />

      <List sx={{ py: 0 }}>
        {filtered.map((contact) => (
          <ListItem
            key={contact.id}
            alignItems="flex-start"
            sx={{
              borderRadius: 2,
              mb: 0.5,
              gap: 1,
              pt: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ListItemAvatar sx={{ minWidth: 48, mt: 0 }}>
              <Avatar sx={{ bgcolor: "primary.main" }}>
                {contact.name.charAt(0).toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={contact.name}
              secondary={contact.sip_uri}
              primaryTypographyProps={{ fontWeight: 500 }}
              secondaryTypographyProps={{ mt: 1 }}
              sx={{ flex: "1 1 auto", minWidth: 0, mt: 0 }}
            />
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0, alignItems: "flex-start", pt: 0.5 }}>
              <IconButton size="small" onClick={() => handleCall(contact.sip_uri)} color="success">
                <PhoneIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => openEdit(contact)}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => handleDelete(contact.id)} color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </ListItem>
        ))}
      </List>

      {filtered.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
          {search ? t("contacts.no_results") : t("contacts.empty")}
        </Typography>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? t("contacts.edit") : t("contacts.add")}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
            <TextField
              size="small"
              label={t("contacts.name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <TextField
              size="small"
              label={t("contacts.extension")}
              value={form.extension}
              onChange={(e) => setForm({ ...form, extension: e.target.value })}
              placeholder={domain ? `ex: 100 (→ sip:100@${domain})` : "ex: sip:100@domain"}
              helperText={domain && form.extension.trim() && !form.extension.includes("@") ? `sip:${form.extension.trim()}@${domain}` : ""}
            />
            <TextField
              size="small"
              label={t("contacts.phone")}
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t("contacts.cancel")}</Button>
          <Button onClick={handleSave} variant="contained" disabled={!form.name.trim() || !form.extension.trim()}>
            {t("contacts.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Contacts;
