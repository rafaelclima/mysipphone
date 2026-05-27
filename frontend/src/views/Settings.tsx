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
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SpeakerIcon from "@mui/icons-material/Speaker";
import MicIcon from "@mui/icons-material/Mic";
import RingVolumeIcon from "@mui/icons-material/RingVolume";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAuthStore } from "../store/useAuthStore";
import { useAudioDevicesStore } from "../store/useAudioDevicesStore";

function Settings() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const account = useAuthStore((s) => s.account);
  const authState = useAuthStore((s) => s.state);
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
    registered: { label: "Registered", color: "success" },
    registering: { label: "Registering...", color: "warning" },
    unregistered: { label: "Unregistered", color: "default" },
    failed: { label: "Failed", color: "error" },
  };

  const status = stateLabel[authState] || stateLabel.unregistered;

  const speakers = devices.filter((d) => d.device_type === "Speaker");
  const microphones = devices.filter((d) => d.device_type === "Microphone");
  const ringtoneDevices = devices.filter((d) => d.device_type === "Ringtone");

  return (
    <Box>
      <Typography variant="h6" sx={{ px: 2, py: 1 }}>
        Settings
      </Typography>

      <List>
        <ListItem
          onClick={() => navigate("/account-setup")}
          sx={{
            borderRadius: 2,
            mx: 1,
            mb: 0.5,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ListItemIcon>
            <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main" }}>
              <AccountCircleIcon />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={account ? account.displayName : "SIP Account"}
            secondary={account ? account.sipUri : "Not configured"}
          />
          <Chip
            label={status.label}
            size="small"
            color={status.color}
            variant="outlined"
          />
        </ListItem>

        <ListItem
          onClick={() => setAudioOpen(!audioOpen)}
          sx={{
            borderRadius: 2,
            mx: 1,
            mb: 0.5,
            "&:hover": { bgcolor: "action.hover" },
            cursor: "pointer",
          }}
        >
          <ListItemIcon>
            <Avatar sx={{ width: 40, height: 40, bgcolor: "secondary.main" }}>
              <VolumeUpIcon />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary="Audio Devices"
            secondary="Speaker, mic & ringtone"
          />
          {audioOpen ? <ExpandLess /> : <ExpandMore />}
        </ListItem>

        <Collapse in={audioOpen} timeout="auto" unmountOnExit>
          <Box sx={{ px: 4, py: 1 }}>
            {devicesLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!devicesLoading && devices.length === 0 && (
              <Alert severity="info" sx={{ mb: 1 }}>
                No audio devices detected
              </Alert>
            )}

            {speakers.length > 0 && (
              <FormControl component="fieldset" size="small" sx={{ mb: 2, width: "100%" }}>
                <FormLabel component="legend" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <SpeakerIcon fontSize="small" /> Speaker
                </FormLabel>
                <RadioGroup
                  value={outputDeviceId || ""}
                  onChange={(e) => setOutputDevice(e.target.value)}
                >
                  {speakers.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      value={d.id}
                      control={<Radio size="small" />}
                      label={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {d.name}
                        </Typography>
                      }
                      sx={{ "& .MuiTypography-root": { fontSize: "0.85rem" } }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}

            {microphones.length > 0 && (
              <FormControl component="fieldset" size="small" sx={{ mb: 2, width: "100%" }}>
                <FormLabel component="legend" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <MicIcon fontSize="small" /> Microphone
                </FormLabel>
                <RadioGroup
                  value={inputDeviceId || ""}
                  onChange={(e) => setInputDevice(e.target.value)}
                >
                  {microphones.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      value={d.id}
                      control={<Radio size="small" />}
                      label={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {d.name}
                        </Typography>
                      }
                      sx={{ "& .MuiTypography-root": { fontSize: "0.85rem" } }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}

            {ringtoneDevices.length > 0 && (
              <FormControl component="fieldset" size="small" sx={{ mb: 1, width: "100%" }}>
                <FormLabel component="legend" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <RingVolumeIcon fontSize="small" /> Ringtone
                </FormLabel>
                <RadioGroup
                  value={ringtoneDeviceId || ""}
                  onChange={(e) => setRingtoneDevice(e.target.value)}
                >
                  {ringtoneDevices.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      value={d.id}
                      control={<Radio size="small" />}
                      label={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {d.name}
                        </Typography>
                      }
                      sx={{ "& .MuiTypography-root": { fontSize: "0.85rem" } }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          </Box>
        </Collapse>

        <Divider sx={{ my: 1 }} />

        <ListItem
          sx={{
            borderRadius: 2,
            mx: 1,
            mb: 0.5,
          }}
        >
          <ListItemIcon>
            <Avatar sx={{ width: 40, height: 40, bgcolor: "grey.500" }}>
              <DarkModeIcon />
            </Avatar>
          </ListItemIcon>
          <ListItemText primary="Dark Mode" />
          <Switch
            checked={themeMode === "dark"}
            onChange={(_, checked) => setThemeMode(checked ? "dark" : "light")}
          />
        </ListItem>
      </List>

      <Box sx={{ px: 3, mt: 4, textAlign: "center" }}>
        <Typography variant="caption" color="text.secondary">
          mySIPPhone v0.1.0
        </Typography>
      </Box>
    </Box>
  );
}

export default Settings;
