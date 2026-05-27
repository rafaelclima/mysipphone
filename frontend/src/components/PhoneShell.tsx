import { Box, Paper } from "@mui/material";
import StatusBar from "./StatusBar";
import NavigationBar from "./NavigationBar";

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const CORNER_RADIUS = 48;

interface PhoneShellProps {
  children: React.ReactNode;
}

function NotchCutout() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 160,
        height: 28,
        bgcolor: "grey.900",
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: "#1a1a2e",
          border: "2px solid #2a2a3e",
        }}
      />
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: "#1a1a2e",
        }}
      />
    </Box>
  );
}

function PhoneShell({ children }: PhoneShellProps) {
  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Paper
        elevation={24}
        sx={{
          width: PHONE_WIDTH,
          height: PHONE_HEIGHT,
          borderRadius: `${CORNER_RADIUS}px`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          bgcolor: "grey.900",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)"
              : "0 0 0 1px rgba(0,0,0,0.1), 0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <NotchCutout />
        <StatusBar />
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            bgcolor: "background.paper",
            mx: 0.5,
            mb: 0.5,
            borderRadius: `${CORNER_RADIUS - 6}px ${CORNER_RADIUS - 6}px 0 0`,
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            {children}
          </Box>
        </Box>
        <NavigationBar />
      </Paper>
    </Box>
  );
}

export default PhoneShell;
