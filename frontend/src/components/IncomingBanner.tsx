import { Box, Typography, IconButton, Avatar } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { invoke } from "@tauri-apps/api/core";
import { useCallStore, Call } from "../store/useCallStore";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";

function IncomingBanner({ call }: { call: Call }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setIncomingCall = useCallStore((s) => s.setIncomingCall);
  const setHold = useCallStore((s) => s.setHold);
  const activeCallId = useCallStore((s) => s.activeCallId);

  const handleAnswer = async () => {
    if (activeCallId) {
      try {
        await invoke("hold", { callId: activeCallId });
        setHold(activeCallId, true);
      } catch (err) {
        console.error("Hold failed:", err);
      }
    }
    try {
      await invoke("answer", { callId: call.id });
      setIncomingCall(null);
      navigate(`/call/${call.id}`, { replace: true });
    } catch (err) {
      console.error("Answer failed:", err);
    }
  };

  const handleReject = async () => {
    try {
      await invoke("reject", { callId: call.id });
    } catch (err) {
      console.error("Reject failed:", err);
    }
    setIncomingCall(null);
  };

  const avatarLetter = (call.remoteName || call.remoteUri).charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: "success.main",
          fontSize: 16,
        }}
      >
        {avatarLetter}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {call.remoteName || call.remoteUri}
        </Typography>
        <Typography variant="caption" color="success.main" fontWeight={500}>
          {t("incoming_call.title")}
        </Typography>
      </Box>
      <IconButton
        onClick={handleAnswer}
        size="small"
        sx={{ bgcolor: "success.main", color: "white", "&:hover": { bgcolor: "success.dark" } }}
      >
        <CallIcon sx={{ fontSize: 20 }} />
      </IconButton>
      <IconButton
        onClick={handleReject}
        size="small"
        sx={{ bgcolor: "error.main", color: "white", "&:hover": { bgcolor: "error.dark" } }}
      >
        <CallEndIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Box>
  );
}

export default IncomingBanner;
