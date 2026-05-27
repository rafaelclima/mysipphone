import { useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
} from "@mui/material";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import PhoneForwardedIcon from "@mui/icons-material/PhoneForwarded";
import MissedCallIcon from "@mui/icons-material/PhoneMissed";

const MOCK_HISTORY = [
  { id: "h1", remoteName: "Alice Santos", direction: "Incoming", durationSecs: 145, startTime: "2026-05-26 09:15" },
  { id: "h2", remoteName: "Bruno Oliveira", direction: "Outgoing", durationSecs: 32, startTime: "2026-05-26 08:50" },
  { id: "h3", remoteName: "+55 11 98888-0000", direction: "Missed", durationSecs: 0, startTime: "2026-05-26 08:30" },
  { id: "h4", remoteName: "Carla Mendes", direction: "Incoming", durationSecs: 612, startTime: "2026-05-25 14:22" },
  { id: "h5", remoteName: "Diego Costa", direction: "Outgoing", durationSecs: 89, startTime: "2026-05-25 11:05" },
  { id: "h6", remoteName: "Elena Souza", direction: "Incoming", durationSecs: 245, startTime: "2026-05-25 10:30" },
  { id: "h7", remoteName: "Fernando Lima", direction: "Missed", durationSecs: 0, startTime: "2026-05-24 18:45" },
];

function formatDuration(secs: number): string {
  if (secs === 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CallHistory() {
  const [logs] = useState(MOCK_HISTORY);

  const grouped = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    const date = log.startTime.split(" ")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Call History
      </Typography>

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
            {calls.map((log) => (
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
                        log.direction === "Missed"
                          ? "error.main"
                          : log.direction === "Incoming"
                          ? "success.main"
                          : "primary.main",
                    }}
                  >
                    {log.direction === "Missed" ? (
                      <MissedCallIcon />
                    ) : log.direction === "Incoming" ? (
                      <PhoneCallbackIcon />
                    ) : (
                      <PhoneForwardedIcon />
                    )}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={log.remoteName}
                  secondary={`${log.startTime} ${formatDuration(log.durationSecs) ? `· ${formatDuration(log.durationSecs)}` : ""}`}
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
                <Chip
                  label={log.direction}
                  size="small"
                  variant="outlined"
                  color={
                    log.direction === "Missed"
                      ? "error"
                      : log.direction === "Incoming"
                      ? "success"
                      : "primary"
                  }
                  sx={{ fontWeight: 500 }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );
}

export default CallHistory;
