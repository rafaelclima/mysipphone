import { useEffect, useState } from "react";
import { Box, Typography, IconButton, Avatar } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface IncomingCallInfo {
  call_id: number;
  remote_uri: string;
}

function IncomingPopup() {
  const [info, setInfo] = useState<IncomingCallInfo | null>(null);

  useEffect(() => {
    invoke<IncomingCallInfo | null>("get_incoming_call_info").then((r) => {
      if (r) {
        setInfo(r);
      } else {
        // No call info — close stale popup after brief delay
        setTimeout(() => closeSelf(), 500);
      }
    });

    const unlisten = listen<Record<string, unknown>>("popup:dismiss", () => {
      closeSelf();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && info) handleAnswer();
      if (e.key === "Escape") handleReject();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const closeSelf = async () => {
    try {
      await getCurrentWebviewWindow().close();
    } catch {}
  };

  const focusMain = async () => {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const main = await WebviewWindow.getByLabel("main");
      if (main) await main.setFocus();
    } catch {}
  };

  const handleAnswer = async () => {
    if (!info) return;
    try {
      await invoke("answer", { callId: String(info.call_id) });
      await emit("popup:answer", { callId: String(info.call_id) });
    } catch {
      // Error handled silently; SnackbarAlert in Rodada 2
    }
    await focusMain();
    await closeSelf();
  };

  const handleReject = async () => {
    if (!info) return;
    try {
      await invoke("reject", { callId: String(info.call_id) });
      await emit("popup:reject", { callId: String(info.call_id) });
    } catch {
      // Error handled silently; SnackbarAlert in Rodada 2
    }
    await closeSelf();
  };

  if (!info) {
    return (
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">...</Typography>
      </Box>
    );
  }

  const avatarLetter = (info.remote_uri || "?").charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        bgcolor: "background.paper",
        px: 2,
      }}
    >
      <Avatar sx={{ width: 48, height: 48, bgcolor: "success.main", fontSize: 24 }}>
        {avatarLetter}
      </Avatar>
      <Typography variant="body1" fontWeight={600} noWrap textAlign="center">
        {info.remote_uri}
      </Typography>
      <Typography variant="caption" color="success.main" fontWeight={500}>
        Chamada Recebida
      </Typography>
      <Box sx={{ display: "flex", gap: 3, mt: 1 }}>
        <IconButton
          onClick={handleReject}
          sx={{ bgcolor: "error.main", color: "white", "&:hover": { bgcolor: "error.dark" }, width: 48, height: 48 }}
        >
          <CallEndIcon sx={{ fontSize: 24 }} />
        </IconButton>
        <IconButton
          onClick={handleAnswer}
          sx={{ bgcolor: "success.main", color: "white", "&:hover": { bgcolor: "success.dark" }, width: 48, height: 48 }}
        >
          <CallIcon sx={{ fontSize: 24 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default IncomingPopup;
