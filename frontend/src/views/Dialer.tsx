import { useState } from "react";
import { Box, Button, Typography, IconButton } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import BackspaceIcon from "@mui/icons-material/Backspace";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

const DIAL_PAD = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

function Dialer() {
  const [number, setNumber] = useState("");
  const navigate = useNavigate();

  const handleDial = (digit: string) => {
    setNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!number) return;
    try {
      await invoke("make_call", { uri: number });
      navigate(`/call/new?uri=${encodeURIComponent(number)}`);
    } catch (err) {
      console.error("Call failed:", err);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        gap: 1,
        pt: 4,
      }}
    >
      <Typography
        variant="h4"
        sx={{
          fontVariantNumeric: "tabular-nums",
          letterSpacing: 2,
          minHeight: 48,
          wordBreak: "break-all",
          textAlign: "center",
        }}
      >
        {number || (
          <Typography component="span" variant="h6" color="text.secondary">
            Enter number
          </Typography>
        )}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1.5,
          mt: 2,
        }}
      >
        {DIAL_PAD.map(({ digit, letters }) => (
          <Button
            key={digit}
            onClick={() => handleDial(digit)}
            sx={{
              width: 72,
              height: 64,
              borderRadius: 3,
              fontSize: 24,
              fontWeight: 400,
              minWidth: "unset",
              flexDirection: "column",
              color: "text.primary",
              border: 1,
              borderColor: "divider",
              "&:hover": { bgcolor: "action.hover" },
              "&:active": { bgcolor: "action.selected" },
            }}
          >
            {digit}
            {letters && (
              <Box
                component="span"
                sx={{ fontSize: 10, opacity: 0.5, mt: 0.5, letterSpacing: 1 }}
              >
                {letters}
              </Box>
            )}
          </Button>
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 4,
          alignItems: "center",
          mt: 3,
        }}
      >
        <IconButton onClick={handleBackspace} size="large">
          <BackspaceIcon />
        </IconButton>
        <IconButton
          onClick={handleCall}
          size="large"
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
        <Box sx={{ width: 48 }} />
      </Box>
    </Box>
  );
}

export default Dialer;
