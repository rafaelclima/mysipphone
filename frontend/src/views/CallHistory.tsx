import { useEffect, useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  IconButton,
  CircularProgress,
} from "@mui/material";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import PhoneForwardedIcon from "@mui/icons-material/PhoneForwarded";
import MissedCallIcon from "@mui/icons-material/PhoneMissed";
import PhoneIcon from "@mui/icons-material/Phone";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import { useTranslation } from "../i18n";
import { SnackbarAlert } from "../components/SnackbarAlert";

interface HistoryEntry {
  id: string;
  remote_uri: string;
  remote_name: string;
  direction: string;
  start_time: string;
  duration_secs: number;
  end_reason: string;
}

function formatDuration(secs: number): string {
  if (!secs || secs === 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function displayName(entry: HistoryEntry): string {
  const fromUri = (uri: string) => {
    const match = uri.match(/sip:(.+)@/);
    return match ? match[1] : uri;
  };
  return entry.remote_name || fromUri(entry.remote_uri) || entry.remote_uri;
}

function isMissed(entry: HistoryEntry): boolean {
  return (
    entry.direction === "incoming" &&
    (entry.end_reason === "no_answer" || entry.end_reason === "busy" || entry.end_reason === "rejected")
  );
}

function CallHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: "" });
  const closeSnack = () => setSnack({ open: false, msg: "" });

  const handleCall = (uri: string) => {
    navigate("/");
    setTimeout(() => {
      invoke("make_call", { uri }).catch((err) => setSnack({ open: true, msg: String(err) }));
    }, 100);
  };

  useEffect(() => {
    setLoading(true);
    invoke<HistoryEntry[]>("get_call_history")
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setSnack({ open: true, msg: String(err) });
      });
  }, []);

  const grouped = logs.reduce<Record<string, HistoryEntry[]>>((acc, log) => {
    const parts = (log.start_time || "").split(" ");
    const date = parts[0] || "unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("history.title")}
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && Object.entries(grouped).length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
          {t("history.empty")}
        </Typography>
      )}

      {Object.entries(grouped).map(([date, calls]) => (
        <Box key={date}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1, fontWeight: 600 }}
          >
            {date}
          </Typography>
          <List sx={{ py: 0 }}>
            {calls.map((log) => {
              const missed = isMissed(log);
              return (
              <ListItem
                key={log.id}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor:
                        missed
                          ? "error.main"
                          : log.direction === "incoming"
                          ? "success.main"
                          : "primary.main",
                    }}
                  >
                    {missed ? (
                      <MissedCallIcon />
                    ) : log.direction === "incoming" ? (
                      <PhoneCallbackIcon />
                    ) : (
                      <PhoneForwardedIcon />
                    )}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={displayName(log)}
                  secondary={`${log.start_time || ""} ${formatDuration(log.duration_secs) ? `· ${formatDuration(log.duration_secs)}` : ""}`}
                  primaryTypographyProps={{ fontWeight: 500 }}
                  sx={{ flex: "1 1 auto", minWidth: 0 }}
                />
                <IconButton size="small" onClick={() => handleCall(log.remote_uri)} color="success">
                  <PhoneIcon fontSize="small" />
                </IconButton>
              </ListItem>
              );
            })}
          </List>
        </Box>
      ))}

      <SnackbarAlert open={snack.open} message={snack.msg} onClose={closeSnack} />
    </Box>
  );
}

export default CallHistory;
