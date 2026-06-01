import { useEffect, useState, useRef } from "react";
import {
  Box, List, ListItem, ListItemText, ListItemAvatar, Avatar, Typography,
  TextField, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Alert, CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PhoneIcon from "@mui/icons-material/Phone";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useContactStore, Contact } from "../store/useContactStore";
import { useAuthStore } from "../store/useAuthStore";
import { useTranslation } from "../i18n";
import { SnackbarAlert } from "../components/SnackbarAlert";

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
  const setContacts = useContactStore((s) => s.setContacts);
  const addContact = useContactStore((s) => s.addContact);
  const updateContact = useContactStore((s) => s.updateContact);
  const removeContact = useContactStore((s) => s.removeContact);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", extension: "", phone_number: "" });
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: "" });

  const closeSnack = () => setSnack({ open: false, msg: "" });

  const domain = extractDomain();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importContacts, setImportContacts] = useState<Contact[]>([]);
  const [importError, setImportError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l);
      const parsed: Contact[] = [];
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          setImportError(`Line ${i + 1}: need at least name,extension`);
          return;
        }
        const ext = parts[1];
        const sip_uri = ext.startsWith("sip:") ? ext : domain ? `sip:${ext}@${domain}` : `sip:${ext}`;
        parsed.push({
          id: crypto.randomUUID(),
          name: parts[0],
          sip_uri,
          phone_number: parts[2] || undefined,
        });
      }
      if (parsed.length === 0) {
        setImportError("No valid contacts found in CSV");
        return;
      }
      setImportContacts(parsed);
      setImportDialogOpen(true);
    };
    reader.onerror = () => setImportError("Failed to read file");
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    for (const c of importContacts) {
      try {
        await invoke("add_contact", { contact: c });
        addContact(c);
      } catch {
        // Error handled silently; SnackbarAlert in Rodada 2
      }
    }
    setImportDialogOpen(false);
    setImportContacts([]);
  };

  useEffect(() => {
    setLoading(true);
    invoke<Contact[]>("get_contacts")
      .then((data) => {
        setContacts(data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setSnack({ open: true, msg: String(err) });
      });
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
      setSnack({ open: true, msg: String(err) });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_contact", { contactId: id });
      removeContact(id);
    } catch (err) {
      setSnack({ open: true, msg: String(err) });
    }
  };

  const handleCall = (uri: string) => {
    navigate("/");
    setTimeout(() => {
      invoke("make_call", { uri }).catch((err) => setSnack({ open: true, msg: String(err) }));
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
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <IconButton size="small" onClick={() => fileInputRef.current?.click()} color="primary">
            <FileUploadIcon />
          </IconButton>
          <IconButton size="small" onClick={openAdd} sx={{ bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } }}>
            <AddIcon />
          </IconButton>
        </Box>
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

      {importError && (
        <Alert severity="error" sx={{ mb: 1, py: 0.5, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
          {importError}
        </Alert>
      )}

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("contacts.import_title")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {importContacts.length} {t("contacts.import_confirm")}
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: "auto" }}>
            {importContacts.slice(0, 20).map((c) => (
              <ListItem key={c.id} disableGutters sx={{ py: 0 }}>
                <ListItemText
                  primary={c.name}
                  secondary={c.sip_uri}
                  primaryTypographyProps={{ fontSize: "0.8rem" }}
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
              </ListItem>
            ))}
            {importContacts.length > 20 && (
              <Typography variant="caption" color="text.secondary">
                ...and {importContacts.length - 20} more
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>{t("contacts.cancel")}</Button>
          <Button onClick={handleImportConfirm} variant="contained">
            {t("contacts.import_action")}
          </Button>
        </DialogActions>
      </Dialog>

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

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      <SnackbarAlert
        open={snack.open}
        message={snack.msg}
        onClose={closeSnack}
      />
    </Box>
  );
}

export default Contacts;
