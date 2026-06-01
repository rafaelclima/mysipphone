import { useState, useEffect, useCallback } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SpeakerIcon from "@mui/icons-material/Speaker";
import MicIcon from "@mui/icons-material/Mic";
import RingVolumeIcon from "@mui/icons-material/RingVolume";
import LanguageIcon from "@mui/icons-material/Language";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../store/useSettingsStore";
import { DEVICE_THEMES } from "../theme/deviceThemes";
import { useAuthStore } from "../store/useAuthStore";
import { useAudioDevicesStore } from "../store/useAudioDevicesStore";
import { useTranslation } from "../i18n";

function Settings() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const deviceTheme = useSettingsStore((s) => s.deviceTheme);
  const setDeviceTheme = useSettingsStore((s) => s.setDeviceTheme);
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  useEffect(() => {
    if (audioOpen && devices.length === 0) {
      fetchDevices();
    }
  }, [audioOpen, devices.length, fetchDevices]);

  useEffect(() => {
    const unlisten = listen("sip:devices-changed", () => {
      fetchDevices();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [fetchDevices]);

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

  const handleTestTone = useCallback((deviceId: string) => {
    invoke("play_test_tone", { deviceId });
  }, []);

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
                    <Box key={d.id} sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        value={d.id}
                        control={<Radio sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }} />}
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, overflow: "hidden" }}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 120, fontSize: "0.78rem" }}>
                              {d.name}
                            </Typography>
                            {d.is_default && (
                              <Chip label={t("settings.default")} size="small" sx={{ height: 16, "& .MuiChip-label": { fontSize: 9, px: 0.5 } }} />
                            )}
                          </Box>
                        }
                        sx={{ "& .MuiTypography-root": { fontSize: "0.78rem" }, my: -0.25, flex: 1, minWidth: 0 }}
                      />
                      <Tooltip title={t("settings.test_tone")}>
                        <IconButton
                          size="small"
                          onClick={() => handleTestTone(d.id)}
                          sx={{ mr: 0.5, "&:hover": { color: "primary.main" } }}
                        >
                          <VolumeUpOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
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
                    <Box key={d.id} sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        value={d.id}
                        control={<Radio sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }} />}
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, overflow: "hidden" }}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 160, fontSize: "0.78rem" }}>
                              {d.name}
                            </Typography>
                            {d.is_default && (
                              <Chip label={t("settings.default")} size="small" sx={{ height: 16, "& .MuiChip-label": { fontSize: 9, px: 0.5 } }} />
                            )}
                          </Box>
                        }
                        sx={{ "& .MuiTypography-root": { fontSize: "0.78rem" }, my: -0.25, flex: 1, minWidth: 0 }}
                      />
                    </Box>
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
                    <Box key={d.id} sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        value={d.id}
                        control={<Radio sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }} />}
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, overflow: "hidden" }}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 160, fontSize: "0.78rem" }}>
                              {d.name}
                            </Typography>
                            {d.is_default && (
                              <Chip label={t("settings.default")} size="small" sx={{ height: 16, "& .MuiChip-label": { fontSize: 9, px: 0.5 } }} />
                            )}
                          </Box>
                        }
                        sx={{ "& .MuiTypography-root": { fontSize: "0.78rem" }, my: -0.25, flex: 1, minWidth: 0 }}
                      />
                    </Box>
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          </Box>
        </Collapse>

        <Divider sx={{ my: 0.75 }} />

        <ListItem
          onClick={() => setHelpOpen(true)}
          sx={{
            borderRadius: 2,
            mx: 0.75,
            mb: 0.25,
            "&:hover": { bgcolor: "action.hover", cursor: "pointer" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "info.main" }}>
              <HelpOutlineIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={t("settings.help")}
            secondary={t("settings.help_desc")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
            secondaryTypographyProps={{ fontSize: "0.75rem" }}
          />
        </ListItem>

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
              <PhoneAndroidIcon sx={{ fontSize: 18 }} />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={t("settings.device_theme")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
          />
        </ListItem>
        <Box sx={{ display: "flex", gap: 1, px: 2, pb: 1 }}>
          {(["iphone", "galaxy", "pixel"] as const).map((tema) => {
            const selected = deviceTheme === tema;
            const cfg = DEVICE_THEMES[tema];
            return (
              <Box
                key={tema}
                onClick={() => setDeviceTheme(tema)}
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                  cursor: "pointer",
                  borderRadius: 2,
                  p: 1,
                  border: "2px solid",
                  borderColor: selected ? "primary.main" : "transparent",
                  bgcolor: selected ? "action.selected" : "transparent",
                  transition: "all 0.15s",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 52,
                    borderRadius: 1.5,
                    border: "1.5px solid",
                    borderColor: "grey.500",
                    bgcolor: cfg.shellColor,
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {tema === "iphone" ? (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 20,
                        height: 7,
                        bgcolor: cfg.shellColor,
                        borderBottomLeftRadius: 3,
                        borderBottomRightRadius: 3,
                        zIndex: 1,
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 2,
                        left: tema === "galaxy" ? "50%" : "25%",
                        transform: tema === "galaxy" ? "translateX(-50%)" : "none",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        bgcolor: "#55556a",
                        zIndex: 1,
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, mx: 0.5, my: 0.5, borderRadius: 0.5, bgcolor: "background.paper" }} />
                  <Box sx={{ height: 6, bgcolor: cfg.shellColor }} />
                </Box>
                <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: selected ? 700 : 400, textTransform: "capitalize" }}>
                  {t(`device_theme.${tema}`)}
                </Typography>
              </Box>
            );
          })}
        </Box>
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
            mySIPPhone v{appVersion}
          </Typography>
        </Box>
      </Box>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem", fontWeight: 600 }}>
          {t("settings.help_title")}
        </DialogTitle>
        <DialogContent dividers sx={{ fontSize: "0.85rem", "& p": { mt: 0.5, mb: 1 } }}>
          <Typography variant="body2" component="div" sx={{ "& ul": { pl: 2, mt: 0.5 }, "& li": { mb: 0.5 } }}>
            <p><strong>{t("settings.help_basics")}</strong></p>
            <ul>
              <li>{t("settings.help_basics_1")}</li>
              <li>{t("settings.help_basics_2")}</li>
              <li>{t("settings.help_basics_3")}</li>
            </ul>
            <p><strong>{t("settings.help_calls")}</strong></p>
            <ul>
              <li>{t("settings.help_calls_1")}</li>
              <li>{t("settings.help_calls_2")}</li>
              <li>{t("settings.help_calls_3")}</li>
              <li>{t("settings.help_calls_4")}</li>
            </ul>
            <p><strong>{t("settings.help_shortcuts")}</strong></p>
            <ul>
              <li>{t("settings.help_shortcuts_1")}</li>
              <li>{t("settings.help_shortcuts_2")}</li>
              <li>{t("settings.help_shortcuts_3")}</li>
              <li>{t("settings.help_shortcuts_4")}</li>
            </ul>
            <p><strong>{t("settings.help_contacts")}</strong></p>
            <ul>
              <li>{t("settings.help_contacts_1")}</li>
              <li>{t("settings.help_contacts_2")}</li>
              <li>{t("settings.help_contacts_3")}</li>
              <li>{t("settings.help_contacts_4")}</li>
              <li>{t("settings.help_contacts_5")}</li>
            </ul>
            <p><strong>{t("settings.help_audio")}</strong></p>
            <ul>
              <li>{t("settings.help_audio_1")}</li>
              <li>{t("settings.help_audio_2")}</li>
            </ul>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)} size="small">
            {t("settings.help_close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Settings;
