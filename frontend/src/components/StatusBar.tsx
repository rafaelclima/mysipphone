import { Box, Typography, Tooltip } from "@mui/material";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import WifiIcon from "@mui/icons-material/Wifi";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useTranslation } from "../i18n";

function StatusBar() {
  const [time, setTime] = useState(
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  const authState = useAuthStore((s) => s.state);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const regIcon = {
    registered: <CheckCircleIcon sx={{ fontSize: 11, color: "#4caf50" }} />,
    registering: <HourglassEmptyIcon sx={{ fontSize: 11, color: "#ff9800" }} />,
    unregistered: <RadioButtonUncheckedIcon sx={{ fontSize: 11, color: "#9e9e9e" }} />,
    failed: <WarningIcon sx={{ fontSize: 11, color: "#f44336" }} />,
  }[authState] ?? <RadioButtonUncheckedIcon sx={{ fontSize: 11, color: "#9e9e9e" }} />;

  const regLabel = {
    registered: t("status.registered"),
    registering: t("status.registering"),
    unregistered: t("status.unregistered"),
    failed: t("status.failed"),
  }[authState] ?? t("status.unregistered");

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        px: 2,
        pt: 3,
        pb: 0.25,
        bgcolor: "grey.900",
        color: "white",
        zIndex: 5,
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: 10, lineHeight: 1 }}>
        {time}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.25, alignItems: "center" }}>
        <Tooltip title={regLabel} arrow placement="top">
          <Box sx={{ display: "flex", alignItems: "center", mr: 0.5 }}>
            {regIcon}
          </Box>
        </Tooltip>
        <SignalCellularAltIcon sx={{ fontSize: 13 }} />
        <WifiIcon sx={{ fontSize: 12 }} />
        <BatteryFullIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  );
}

export default StatusBar;
