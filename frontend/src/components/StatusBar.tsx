import { Box, Typography } from "@mui/material";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import WifiIcon from "@mui/icons-material/Wifi";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import { useEffect, useState } from "react";

function StatusBar() {
  const [time, setTime] = useState(
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );

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
        <SignalCellularAltIcon sx={{ fontSize: 13 }} />
        <WifiIcon sx={{ fontSize: 12 }} />
        <BatteryFullIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  );
}

export default StatusBar;
