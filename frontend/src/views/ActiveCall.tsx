import { useState, useEffect, useRef } from "react";
import { Box, Typography, IconButton, Avatar } from "@mui/material";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import DialpadIcon from "@mui/icons-material/Dialpad";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useCallStore } from "../store/useCallStore";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function ActiveCall() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const call = useCallStore((s) => s.calls.find((c) => c.id === id));
  const setMuted = useCallStore((s) => s.setMuted);
  const setHold = useCallStore((s) => s.setHold);

  const [duration, setDuration] = useState(call?.durationSecs ?? 0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (call?.state === "connected") {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [call?.state]);

  if (!call) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 2,
        }}
      >
        <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main" }}>
          <PhoneInTalkIcon sx={{ fontSize: 40 }} />
        </Avatar>
        <Typography variant="h6">Connecting...</Typography>
      </Box>
    );
  }

  const handleHangup = async () => {
    try {
      await invoke("hangup", { callId: call.id });
    } catch (err) {
      console.error("Hangup failed:", err);
    }
    navigate("/");
  };

  const toggleMute = async () => {
    try {
      await invoke("mute", { callId: call.id, muted: !call.isMuted });
      setMuted(call.id, !call.isMuted);
    } catch (err) {
      console.error("Mute failed:", err);
    }
  };

  const toggleHold = async () => {
    try {
      if (call.isOnHold) {
        await invoke("unhold", { callId: call.id });
      } else {
        await invoke("hold", { callId: call.id });
      }
      setHold(call.id, !call.isOnHold);
    } catch (err) {
      console.error("Hold failed:", err);
    }
  };

  const avatarLetter = (call.remoteName || call.remoteUri).charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100%",
        py: 4,
      }}
    >
      <Box sx={{ textAlign: "center" }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            bgcolor: "primary.main",
            fontSize: 36,
            mb: 2,
            mx: "auto",
          }}
        >
          {avatarLetter}
        </Avatar>
        <Typography variant="h5" fontWeight={500}>
          {call.remoteName || call.remoteUri}
        </Typography>
        <Typography variant="h3" sx={{ fontVariantNumeric: "tabular-nums", mt: 1 }}>
          {formatDuration(duration)}
        </Typography>
        {call.isOnHold && (
          <Typography variant="body2" color="warning.main" fontWeight={600}>
            ON HOLD
          </Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
        <ActionButton
          icon={call.isMuted ? <MicOffIcon /> : <MicIcon />}
          label="Mute"
          active={call.isMuted}
          onClick={toggleMute}
        />
        <ActionButton
          icon={<DialpadIcon />}
          label="Keypad"
          onClick={() => {}}
        />
        <ActionButton
          icon={call.isOnHold ? <PlayArrowIcon /> : <PauseIcon />}
          label={call.isOnHold ? "Resume" : "Hold"}
          active={call.isOnHold}
          onClick={toggleHold}
        />
        <ActionButton
          icon={<VolumeUpIcon />}
          label="Speaker"
          onClick={() => {}}
        />
      </Box>

      <IconButton
        onClick={handleHangup}
        sx={{
          bgcolor: "error.main",
          color: "white",
          width: 64,
          height: 64,
          "&:hover": { bgcolor: "error.dark" },
        }}
      >
        <CallEndIcon sx={{ fontSize: 36 }} />
      </IconButton>
    </Box>
  );
}

function ActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <IconButton
        onClick={onClick}
        sx={{
          bgcolor: active ? "primary.main" : "action.selected",
          color: active ? "primary.contrastText" : "text.primary",
          width: 52,
          height: 52,
          "&:hover": { bgcolor: active ? "primary.dark" : "action.hover" },
        }}
      >
        {icon}
      </IconButton>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export default ActiveCall;
