import { Box, Paper } from "@mui/material";
import StatusBar from "./StatusBar";
import NavigationBar from "./NavigationBar";

const CORNER_RADIUS = 30;

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
        width: 110,
        height: 34,
        bgcolor: "grey.900",
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
          width: 18,
          height: 18,
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

function PhoneShell({ children }: PhoneShellProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        width: "100vw",
        height: "100vh",
        borderRadius: `${CORNER_RADIUS}px`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        bgcolor: "grey.900",
      }}
    >
      <StatusBar />
      <NotchCutout />
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
  );
}

export default PhoneShell;
