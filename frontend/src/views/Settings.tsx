import { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Typography,
  Divider,
  Avatar,
  Chip,
  Collapse,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SpeakerIcon from "@mui/icons-material/Speaker";
import MicIcon from "@mui/icons-material/Mic";
import RingVolumeIcon from "@mui/icons-material/RingVolume";
import LanguageIcon from "@mui/icons-material/Language";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAuthStore } from "../store/useAuthStore";
import { useAudioDevicesStore } from "../store/useAudioDevicesStore";
import { useTranslation } from "../i18n";

function Settings() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const account = useAuthStore((s) => s.account);
  const authState = useAuthStore((s) => s.state);
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();

  const {
    devices,
    loading: devicesLoading,
    fetchDevices,
  } = useAudioDevicesStore();

  const {
    outputDeviceId,
    inputDeviceId,
    ringtoneDeviceId,
    setOutputDevice,
    setInputDevice,
    setRingtoneDevice,
  } = useSettingsStore();

  const [audioOpen, setAudioOpen] = useState(false);

  useEffect(() => {
    if (audioOpen && devices.length === 0) {
      fetchDevices();
    }
  }, [audioOpen, devices.length, fetchDevices]);

  const stateLabel: Record<string, { label: string; color: "success" | "warning" | "error" | "default" }> = {
    registered: { label: t("status.registered"), color: "success" },
    registering: { label: t("status.registering"), color: "warning" },
    unregistered: { label: t("status.unregistered"), color: "default" },
    failed: { label: t("status.failed"), color: "error" },
  };

  const status = stateLabel[authState] || stateLabel.unregistered;

  const speakers = devices.filter((d) => d.device_type === "Speaker");
  const microphones = devices.filter((d) => d.device_type === "Microphone");
  const ringtoneDevices = devices.filter((d) => d.device_type === "Ringtone");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, px: 2, py: 0.75 }}>
        {t("settings.title")}
      </Typography>

      <List dense>
        <ListItem
          onClick={() => navigate("/account-setup")}
          sx={{
            borderRadius: 2,
            mx: 0.75,
            mb: 0.25,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
              <AccountCircleIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={account ? account.display_name : t("settings.sip_account")}
            secondary={account ? account.sip_uri : t("settings.not_configured")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
            secondaryTypographyProps={{ fontSize: "0.75rem" }}
          />
          <Chip
            label={status.label}
            size="small"
            color={status.color}
            variant="outlined"
            sx={{ height: 20, "& .MuiChip-label": { fontSize: 10, px: 0.75 } }}
          />
        </ListItem>

        <ListItem
          onClick={() => setAudioOpen(!audioOpen)}
          sx={{
            borderRadius: 2,
            mx: 0.75,
            mb: 0.25,
            "&:hover": { bgcolor: "action.hover" },
            cursor: "pointer",
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}>
              <VolumeUpIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={t("settings.audio_devices")}
            secondary={t("settings.audio_devices_desc")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
            secondaryTypographyProps={{ fontSize: "0.75rem" }}
          />
          {audioOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </ListItem>

        <Collapse in={audioOpen} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2, py: 0.5 }}>
            {devicesLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <CircularProgress size={20} />
              </Box>
            )}

            {!devicesLoading && devices.length === 0 && (
              <Alert severity="info" sx={{ mb: 0.5, py: 0.5, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
                {t("settings.no_devices")}
              </Alert>
            )}

            {speakers.length > 0 && (
              <FormControl component="fieldset" size="small" sx={{ mb: 1.5, width: "100%" }}>
                <FormLabel component="legend" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, "&.MuiFormLabel-root": { fontSize: "0.8rem" } }}>
                  <SpeakerIcon sx={{ fontSize: 14 }} /> {t("settings.speaker")}
                </FormLabel>
                <RadioGroup
                  value={outputDeviceId || ""}
                  onChange={(e) => setOutputDevice(e.target.value)}
                >
                  {speakers.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      value={d.id}
                      control={<Radio sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }} />}
                      label={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 140, fontSize: "0.78rem" }}>
                          {d.name}
                        </Typography>
                      }
                      sx={{ "& .MuiTypography-root": { fontSize: "0.78rem" }, my: -0.25 }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}

            {microphones.length > 0 && (
              <FormControl component="fieldset" size="small" sx={{ mb: 1.5, width: "100%" }}>
                <FormLabel component="legend" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, "&.MuiFormLabel-root": { fontSize: "0.8rem" } }}>
                  <MicIcon sx={{ fontSize: 14 }} /> {t("settings.microphone")}
                </FormLabel>
                <RadioGroup
                  value={inputDeviceId || ""}
                  onChange={(e) => setInputDevice(e.target.value)}
                >
                  {microphones.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      value={d.id}
                      control={<Radio sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }} />}
                      label={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 140, fontSize: "0.78rem" }}>
                          {d.name}
                        </Typography>
                      }
                      sx={{ "& .MuiTypography-root": { fontSize: "0.78rem" }, my: -0.25 }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}

            {ringtoneDevices.length > 0 && (
              <FormControl component="fieldset" size="small" sx={{ mb: 0.5, width: "100%" }}>
                <FormLabel component="legend" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, "&.MuiFormLabel-root": { fontSize: "0.8rem" } }}>
                  <RingVolumeIcon sx={{ fontSize: 14 }} /> {t("settings.ringtone")}
                </FormLabel>
                <RadioGroup
                  value={ringtoneDeviceId || ""}
                  onChange={(e) => setRingtoneDevice(e.target.value)}
                >
                  {ringtoneDevices.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      value={d.id}
                      control={<Radio sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }} />}
                      label={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 140, fontSize: "0.78rem" }}>
                          {d.name}
                        </Typography>
                      }
                      sx={{ "& .MuiTypography-root": { fontSize: "0.78rem" }, my: -0.25 }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          </Box>
        </Collapse>

        <Divider sx={{ my: 0.75 }} />

        <ListItem
          sx={{
            borderRadius: 2,
            mx: 0.75,
            mb: 0.25,
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "grey.500" }}>
              <DarkModeIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={t("settings.dark_mode")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
          />
          <Switch
            size="small"
            checked={themeMode === "dark"}
            onChange={(_, checked) => setThemeMode(checked ? "dark" : "light")}
          />
        </ListItem>

        <ListItem
          sx={{
            borderRadius: 2,
            mx: 0.75,
            mb: 0.25,
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "grey.500" }}>
              <LanguageIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={t("settings.language")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
          />
          <Select
            size="small"
            value={locale}
            onChange={(e) => setLocale(e.target.value as "en" | "pt-BR")}
            sx={{
              fontSize: "0.75rem",
              "& .MuiSelect-select": { py: 0.25, pr: 2 },
            }}
          >
            <MenuItem value="en">{t("language.en")}</MenuItem>
            <MenuItem value="pt-BR">{t("language.pt_BR")}</MenuItem>
          </Select>
        </ListItem>
      </List>

      <Box sx={{ mt: "auto" }}>
        <Divider sx={{ mb: 0.5 }} />
        <ListItem
          onClick={() => { invoke("shutdown"); }}
          sx={{
            borderRadius: 2,
            mx: 0.75,
            mb: 0.25,
            "&:hover": { bgcolor: "error.light", cursor: "pointer" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "error.main" }}>
              <PowerSettingsNewIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={t("settings.quit")}
            primaryTypographyProps={{ color: "error.main", fontWeight: 600, fontSize: "0.85rem" }}
          />
        </ListItem>
        <Box sx={{ px: 2, mt: 2, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
            mySIPPhone v0.1.0
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default Settings;
