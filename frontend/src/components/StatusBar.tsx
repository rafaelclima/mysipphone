import { Box, Typography, Tooltip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useTranslation } from "../i18n";
import { SignalIcon, DeviceWifiIcon, BatteryIcon } from "../theme/icons";
import { DEVICE_THEMES } from "../theme/deviceThemes";
import type { DeviceTheme } from "../theme/deviceThemes";

interface StatusBarProps {
  deviceTheme: DeviceTheme;
}

function StatusBar({ deviceTheme }: StatusBarProps) {
  const [time, setTime] = useState(
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  const authState = useAuthStore((s) => s.state);
  const { t } = useTranslation();
  const cfg = DEVICE_THEMES[deviceTheme];

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
        alignItems: "flex-end",
        px: 2,
        pt: cfg.statusBarPt,
        pb: 0.35,
        bgcolor: cfg.shellColor,
        color: "white",
        zIndex: 5,
        minHeight: 20,
      }}
    >
      <Typography
        sx={{
          fontWeight: 600,
          fontSize: 10,
          lineHeight: 1,
          visibility: cfg.timeAlign === "center" ? "hidden" : "visible",
        }}
      >
        {time}
      </Typography>
      {cfg.timeAlign === "center" && (
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: 10,
            lineHeight: 1,
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {time}
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 0.25, alignItems: "center" }}>
        <Tooltip title={regLabel} arrow placement="top">
          <Box sx={{ display: "flex", alignItems: "center", mr: 0.5 }}>
            {regIcon}
          </Box>
        </Tooltip>
        <SignalIcon deviceTheme={deviceTheme} />
        <DeviceWifiIcon deviceTheme={deviceTheme} />
        <BatteryIcon deviceTheme={deviceTheme} />
      </Box>
    </Box>
  );
}

export default StatusBar;

