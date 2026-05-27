import { useEffect } from "react";
import { Box, Typography, IconButton, Avatar } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useCallStore } from "../store/useCallStore";
import { useTranslation } from "../i18n";

function IncomingCall() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const incomingCall = useCallStore((s) => s.incomingCall);
  const setIncomingCall = useCallStore((s) => s.setIncomingCall);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleAnswer();
        return;
      }
      if (e.key === "Escape") {
        handleReject();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!incomingCall) {
    return null;
  }

  const handleAnswer = async () => {
    try {
      await invoke("answer", { callId: incomingCall.id });
      setIncomingCall(null);
      navigate(`/call/${incomingCall.id}`);
    } catch (err) {
      console.error("Answer failed:", err);
    }
  };

  const handleReject = async () => {
    try {
      await invoke("reject", { callId: incomingCall.id });
    } catch (err) {
      console.error("Reject failed:", err);
    }
    setIncomingCall(null);
    navigate("/");
  };

  const avatarLetter = (incomingCall.remoteName || incomingCall.remoteUri).charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 3,
      }}
    >
      <Avatar
        sx={{
          width: 96,
          height: 96,
          bgcolor: "success.main",
          fontSize: 42,
          mb: 1,
        }}
      >
        {avatarLetter}
      </Avatar>

      <Typography variant="h6" color="success.main" fontWeight={600}>
        {t("incoming_call.title")}
      </Typography>

      <Typography variant="h5" fontWeight={500}>
        {incomingCall.remoteName || incomingCall.remoteUri}
      </Typography>

      <Box sx={{ display: "flex", gap: 6, mt: 4 }}>
        <IconButton
          onClick={handleReject}
          sx={{
            bgcolor: "error.main",
            color: "white",
            width: 64,
            height: 64,
            "&:hover": { bgcolor: "error.dark" },
          }}
        >
          <CallEndIcon sx={{ fontSize: 32 }} />
        </IconButton>
        <IconButton
          onClick={handleAnswer}
          sx={{
            bgcolor: "success.main",
            color: "white",
            width: 64,
            height: 64,
            "&:hover": { bgcolor: "success.dark" },
          }}
        >
          <CallIcon sx={{ fontSize: 32 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default IncomingCall;
