import { useState, useEffect, useRef } from "react";
import { Box, Button, Typography, IconButton, Tooltip, CircularProgress } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import BackspaceIcon from "@mui/icons-material/Backspace";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../i18n";
import { useAuthStore } from "../store/useAuthStore";
import { SnackbarAlert } from "../components/SnackbarAlert";
import { buildSipUri } from "../lib/sipUri";

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

function getDomain(): string {
  const account = useAuthStore.getState().account;
  return account
    ? (account.sip_uri || account.registrar || "").replace(/^sip:/, "").replace(/[^@]+@/, "")
    : "";
}

function Dialer() {
  const { t } = useTranslation();
  const [number, setNumber] = useState("");
  const numberRef = useRef(number);
  numberRef.current = number;
  const [snack, setSnack] = useState({ open: false, msg: "" });
  const [calling, setCalling] = useState(false);
  const closeSnack = () => setSnack({ open: false, msg: "" });

  const handleDial = (digit: string) => {
    setNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!number || calling) return;
    const result = buildSipUri(number, getDomain());
    if ("error" in result) {
      setSnack({ open: true, msg: t("dialer.invalid_number") });
      return;
    }
    setCalling(true);
    try {
      await invoke("make_call", { uri: result.uri });
    } catch (err) {
      setSnack({ open: true, msg: String(err) });
    } finally {
      setCalling(false);
    }
  };

  const handlePickup = async () => {
    if (calling) return;
    const result = buildSipUri("*8#", getDomain());
    if ("error" in result) {
      setSnack({ open: true, msg: t("dialer.invalid_number") });
      return;
    }
    setCalling(true);
    try {
      await invoke("make_call", { uri: result.uri });
    } catch (err) {
      setSnack({ open: true, msg: String(err) });
    } finally {
      setCalling(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const n = numberRef.current;
        if (n) {
          const result = buildSipUri(n, getDomain());
          if ("error" in result) {
            setSnack({ open: true, msg: t("dialer.invalid_number") });
          } else {
            invoke("make_call", { uri: result.uri }).catch((err) => setSnack({ open: true, msg: String(err) }));
          }
        }
        return;
      }
      if (e.key === "Backspace") {
        setNumber((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === "Escape") {
        setNumber("");
        return;
      }
      const digit = e.key;
      if (/^[0-9*#]$/.test(digit)) {
        setNumber((prev) => prev + digit);
        return;
      }
      if (e.key === "+") {
        setNumber((prev) => prev + "0");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [t]);

  return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "100%",
          gap: 1,
          pt: 3,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 1.5,
            minHeight: 40,
            wordBreak: "break-all",
            textAlign: "center",
          }}
        >
          {number || (
            <Typography component="span" variant="h6" color="text.secondary">
              {t("dialer.enter_number")}
            </Typography>
          )}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1.25,
            mt: 1.5,
          }}
        >
          {DIAL_PAD.map(({ digit, letters }) => (
            <Button
              key={digit}
              onClick={() => handleDial(digit)}
              sx={{
                width: 64,
                height: 54,
                borderRadius: 2.5,
                fontSize: 22,
                fontWeight: 400,
                minWidth: "unset",
                flexDirection: "column",
                color: "text.primary",
                border: "1px solid",
                borderColor: (t) => t.palette.mode === "dark" ? "grey.600" : "grey.400",
                "&:hover": { bgcolor: "action.hover" },
                "&:active": { bgcolor: "action.selected" },
              }}
            >
              {digit}
              {letters && (
                <Box
                  component="span"
                  sx={{ fontSize: 10, opacity: 0.5, letterSpacing: 0.5 }}
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
            mt: 2.5,
          }}
        >
          <Tooltip title={t("dialer.backspace")}>
            <IconButton onClick={handleBackspace} size="medium" disabled={calling}>
              <BackspaceIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("dialer.call")}>
            <IconButton
              onClick={handleCall}
              disabled={calling || !number}
              sx={{
                bgcolor: calling ? "grey.500" : "success.main",
                color: "white",
                width: 54,
                height: 54,
                "&:hover": { bgcolor: calling ? "grey.500" : "success.dark" },
                "&.Mui-disabled": { bgcolor: "grey.500", color: "white" },
              }}
            >
              {calling ? <CircularProgress size={24} color="inherit" /> : <CallIcon sx={{ fontSize: 28 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("dialer.pickup")}>
            <IconButton
              onClick={handlePickup}
              size="small"
              disabled={calling}
              sx={{
                width: 40,
                height: 40,
                bgcolor: "warning.main",
                color: "white",
                "&:hover": { bgcolor: "warning.dark" },
                "&.Mui-disabled": { bgcolor: "grey.500", color: "white" },
              }}
            >
              <PhoneInTalkIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <SnackbarAlert open={snack.open} message={snack.msg} onClose={closeSnack} />
      </Box>
  );
}

export default Dialer;
