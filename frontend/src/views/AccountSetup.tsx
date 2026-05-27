import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useTranslation } from "../i18n";

function AccountSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAccount = useAuthStore((s) => s.setAccount);
  const error = useAuthStore((s) => s.error);
  const existing = useAuthStore((s) => s.account);

  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [sipUri, setSipUri] = useState(existing?.sip_uri ?? "");
  const [registrar, setRegistrar] = useState(existing?.registrar ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState(existing?.password ?? "");
  const [realm, setRealm] = useState(existing?.realm ?? "*");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!sipUri || !registrar || !username) {
      setLocalError(t("account_setup.validation"));
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      const config = {
        id: existing?.id ?? crypto.randomUUID(),
        display_name: displayName,
        sip_uri: sipUri,
        registrar,
        username,
        password,
        realm,
        transport: "Udp",
      };

      await invoke("register_account", { config });
      setAccount({
        id: config.id,
        display_name: displayName,
        sip_uri: sipUri,
        registrar,
        username,
        password,
        realm,
        transport: "Udp",
      });
      navigate("/settings");
    } catch (err) {
      setLocalError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate("/settings")} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">{t("account_setup.title")}</Typography>
      </Box>

      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {localError || error}
        </Alert>
      )}

      <Paper sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label={t("account_setup.display_name")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          size="small"
        />
        <TextField
          label={t("account_setup.sip_uri")}
          value={sipUri}
          onChange={(e) => setSipUri(e.target.value)}
          size="small"
          required
        />
        <TextField
          label={t("account_setup.registrar")}
          value={registrar}
          onChange={(e) => setRegistrar(e.target.value)}
          size="small"
          required
        />
        <TextField
          label={t("account_setup.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          size="small"
          required
        />
        <TextField
          label={t("account_setup.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="small"
        />
        <TextField
          label={t("account_setup.realm")}
          value={realm}
          onChange={(e) => setRealm(e.target.value)}
          size="small"
        />

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{ mt: 1 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : existing ? t("account_setup.update") : t("account_setup.register")}
        </Button>
      </Paper>
    </Box>
  );
}

export default AccountSetup;
