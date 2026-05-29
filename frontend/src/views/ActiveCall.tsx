import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, IconButton, Avatar, Button, TextField } from "@mui/material";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import DialpadIcon from "@mui/icons-material/Dialpad";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import SwapCallsIcon from "@mui/icons-material/SwapCalls";
import PhoneForwardedIcon from "@mui/icons-material/PhoneForwarded";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useCallStore } from "../store/useCallStore";
import { useTranslation } from "../i18n";
import IncomingBanner from "../components/IncomingBanner";

const DTMF_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function ActiveCall() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const call = useCallStore((s) => s.calls.find((c) => c.id === id));
  const calls = useCallStore((s) => s.calls);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const setMuted = useCallStore((s) => s.setMuted);
  const setHold = useCallStore((s) => s.setHold);

  const [duration, setDuration] = useState(call?.durationSecs ?? 0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const callId = call?.id;
  const sendDtmf = useCallback(async (digit: string) => {
    if (!callId) return;
    try {
      await invoke("send_dtmf", { callId, digits: digit });
    } catch (err) {
      console.error("DTMF failed:", err);
    }
  }, [callId]);

  const handleTransfer = useCallback(async () => {
    if (!callId || !transferTarget) return;
    try {
      await invoke("transfer", { callId, target: transferTarget });
      setTransferTarget("");
      setShowTransfer(false);
    } catch (err) {
      console.error("Transfer failed:", err);
    }
  }, [callId, transferTarget]);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showTransfer) { setShowTransfer(false); return; }
        if (showKeypad) { setShowKeypad(false); return; }
        return;
      }
      if (showKeypad) {
        const digit = e.key;
        if (/^[0-9*#]$/.test(digit)) {
          sendDtmf(digit);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showKeypad, showTransfer, sendDtmf]);

  if (!call) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 2 }}>
        <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main" }}>
          <PhoneInTalkIcon sx={{ fontSize: 40 }} />
        </Avatar>
        <Typography variant="h6">{t("call.connecting")}</Typography>
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

  const heldCalls = calls.filter((c) => c.isOnHold && c.id !== call?.id);

  const handleSwap = async (targetId: string) => {
    if (!call) return;
    try {
      await invoke("hold", { callId: call.id });
      setHold(call.id, true);
    } catch (err) {
      console.error("Hold failed:", err);
      return;
    }
    try {
      await invoke("unhold", { callId: targetId });
      setHold(targetId, false);
    } catch (err) {
      console.error("Unhold failed:", err);
      return;
    }
    navigate(`/call/${targetId}`, { replace: true });
  };

  const avatarLetter = (call.remoteName || call.remoteUri).charAt(0).toUpperCase();

  return (
    <Box sx={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", height: "100%", pt: 1.5, pb: 2 }}>
      {incomingCall && <IncomingBanner call={incomingCall} />}
      <Box sx={{ textAlign: "center", mb: 0.5 }}>
        <Avatar sx={{ width: 60, height: 60, bgcolor: "primary.main", fontSize: 28, mb: 0.5, mx: "auto" }}>
          {avatarLetter}
        </Avatar>
        <Typography variant="subtitle1" fontWeight={500} sx={{ lineHeight: 1.2 }}>
          {call.remoteName || call.remoteUri}
        </Typography>
        <Typography variant="h5" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {formatDuration(duration)}
        </Typography>
        {call.isOnHold && (
          <Typography variant="caption" color="warning.main" fontWeight={600}>
            ON HOLD
          </Typography>
        )}
      </Box>

      {showKeypad && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, mb: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
            {DTMF_KEYS.flat().map((digit) => (
              <Button
                key={digit}
                onClick={() => sendDtmf(digit)}
                sx={{
                  width: 52, height: 42, borderRadius: 2, fontSize: 18,
                  minWidth: "unset", color: "text.primary",
                  border: "1px solid", borderColor: "grey.500",
                  "&:hover": { bgcolor: "action.hover" },
                  "&:active": { bgcolor: "action.selected" },
                }}
              >
                {digit}
              </Button>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">{t("call.keypad_hint")}</Typography>
        </Box>
      )}

      {showTransfer && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1, px: 1 }}>
          <TextField
            size="small"
            placeholder={t("call.transfer_hint")}
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTransfer();
              if (e.key === "Escape") setShowTransfer(false);
            }}
            autoFocus
            sx={{ "& .MuiInputBase-input": { fontSize: 14, py: 0.75 } }}
          />
          <Button size="small" variant="contained" onClick={handleTransfer}>{t("call.transfer")}</Button>
          <Button size="small" onClick={() => setShowTransfer(false)} sx={{ minWidth: 36, px: 0.5 }}>✕</Button>
        </Box>
      )}

      {!showKeypad && !showTransfer && (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center", mb: 1 }}>
          <ActionButton
            icon={call.isMuted ? <MicOffIcon /> : <MicIcon />}
            label={t("call.mute")}
            active={call.isMuted}
            onClick={toggleMute}
          />
          <ActionButton
            icon={<DialpadIcon />}
            label={t("call.keypad")}
            onClick={() => setShowKeypad(true)}
          />
          <ActionButton
            icon={call.isOnHold ? <PlayArrowIcon /> : <PauseIcon />}
            label={call.isOnHold ? t("call.resume") : t("call.hold")}
            active={call.isOnHold}
            onClick={toggleHold}
          />
          <ActionButton
            icon={<SwapCallsIcon />}
            label={t("call.transfer")}
            onClick={() => setShowTransfer(true)}
          />
        </Box>
      )}

      {heldCalls.length > 0 && (
        <Box sx={{ width: "100%", px: 1.5, mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
            {t("call.on_hold")}
          </Typography>
          {heldCalls.map((held) => (
            <Box
              key={held.id}
              onClick={() => handleSwap(held.id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: 2,
                bgcolor: "action.selected",
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
                mb: 0.5,
              }}
            >
              <PhoneForwardedIcon sx={{ fontSize: 18, color: "warning.main" }} />
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                {held.remoteName || held.remoteUri}
              </Typography>
              <Typography variant="caption" color="warning.main" fontWeight={600}>
                {t("call.on_hold_label")}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <IconButton
        onClick={handleHangup}
        sx={{
          bgcolor: "error.main", color: "white",
          width: 60, height: 60, mt: "auto",
          "&:hover": { bgcolor: "error.dark" },
        }}
      >
        <CallEndIcon sx={{ fontSize: 32 }} />
      </IconButton>
    </Box>
  );
}

function ActionButton({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
      <IconButton
        onClick={onClick}
        sx={{
          bgcolor: active ? "primary.main" : "action.selected",
          color: active ? "primary.contrastText" : "text.primary",
          width: 44,
          height: 44,
          "&:hover": { bgcolor: active ? "primary.dark" : "action.hover" },
        }}
      >
        {icon}
      </IconButton>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
    </Box>
  );
}

export default ActiveCall;
