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

function AccountSetup() {
  const navigate = useNavigate();
  const setAccount = useAuthStore((s) => s.setAccount);
  const error = useAuthStore((s) => s.error);
  const existing = useAuthStore((s) => s.account);

  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [sipUri, setSipUri] = useState(existing?.sipUri ?? "");
  const [registrar, setRegistrar] = useState(existing?.registrar ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState(existing?.password ?? "");
  const [realm, setRealm] = useState(existing?.realm ?? "*");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!sipUri || !registrar || !username) {
      setLocalError("SIP URI, Registrar and Username are required");
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
        displayName,
        sipUri,
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
        <Typography variant="h6">SIP Account</Typography>
      </Box>

      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {localError || error}
        </Alert>
      )}

      <Paper sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          size="small"
          placeholder="John Doe"
        />
        <TextField
          label="SIP URI"
          value={sipUri}
          onChange={(e) => setSipUri(e.target.value)}
          placeholder="sip:user@domain.com"
          size="small"
          required
        />
        <TextField
          label="Registrar"
          value={registrar}
          onChange={(e) => setRegistrar(e.target.value)}
          placeholder="sip:pbx.local"
          size="small"
          required
        />
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          size="small"
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="small"
        />
        <TextField
          label="Realm"
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
          {loading ? <CircularProgress size={24} color="inherit" /> : existing ? "Update" : "Register"}
        </Button>
      </Paper>
    </Box>
  );
}

export default AccountSetup;
