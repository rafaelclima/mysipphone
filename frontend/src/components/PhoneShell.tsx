import { useEffect } from "react";
import { Box, Paper } from "@mui/material";
import StatusBar from "./StatusBar";
import NavigationBar from "./NavigationBar";
import { useSettingsStore } from "../store/useSettingsStore";
import { DEVICE_THEMES } from "../theme/deviceThemes";
import type { DeviceTheme } from "../theme/deviceThemes";
import { invoke } from "@tauri-apps/api/core";

interface PhoneShellProps {
  children: React.ReactNode;
}

function CameraCutout({ deviceTheme }: { deviceTheme: DeviceTheme }) {
  const cfg = DEVICE_THEMES[deviceTheme];
  const size = cfg.cameraSize;

  if (cfg.notchType === "iphone-notch") {
    return (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 110,
          height: 34,
          bgcolor: cfg.shellColor,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: size,
            height: size,
            borderRadius: "50%",
            bgcolor: "#0d0d18",
            border: "2.5px solid #55556a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&::after": {
              content: '""',
              position: "absolute",
              top: 3,
              right: 3,
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "rgba(130, 170, 255, 0.5)",
            },
          }}
        />
      </Box>
    );
  }

  const leftPos = cfg.notchType === "center-hole" ? "50%" : "22%";

  return (
    <Box
      sx={{
        position: "absolute",
        top: 10,
        left: leftPos,
        transform: cfg.notchType === "center-hole" ? "translateX(-50%)" : "none",
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "#0d0d18",
        border: "2px solid #55556a",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&::after": {
          content: '""',
          position: "absolute",
          top: 2,
          right: 2,
          width: 3,
          height: 3,
          borderRadius: "50%",
          bgcolor: "rgba(130, 170, 255, 0.5)",
        },
      }}
    />
  );
}

function PhoneShell({ children }: PhoneShellProps) {
  const deviceTheme = useSettingsStore((s) => s.deviceTheme);
  const cfg = DEVICE_THEMES[deviceTheme];

  useEffect(() => {
    invoke("set_window_corner_radius", { radius: cfg.cornerRadius }).catch(() => {});
  }, [deviceTheme, cfg.cornerRadius]);

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100vw",
        height: "100vh",
        borderRadius: `${cfg.cornerRadius}px`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        bgcolor: cfg.shellColor,
      }}
    >
      <StatusBar deviceTheme={deviceTheme} />
      <CameraCutout deviceTheme={deviceTheme} />
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          bgcolor: cfg.contentBgColor,
          mx: 0.5,
          mb: 0.5,
          borderRadius: `${cfg.cornerRadius - 6}px ${cfg.cornerRadius - 6}px 0 0`,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          {children}
        </Box>
      </Box>
      <NavigationBar deviceTheme={deviceTheme} />
    </Paper>
  );
}

export default PhoneShell;
