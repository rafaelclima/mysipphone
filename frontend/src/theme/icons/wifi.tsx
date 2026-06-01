import type { DeviceTheme } from "../deviceThemes";
import WifiIcon from "@mui/icons-material/Wifi";

function IPhoneWifi() {
  return (
    <svg width={14} height={10} viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
      <path d="M2 5.5a5.5 5.5 0 0 1 10 0" opacity={0.3} />
      <path d="M4 4.2a3.2 3.2 0 0 1 6 0" opacity={0.55} />
      <path d="M6 2.9a1 1 0 0 1 2 0" />
    </svg>
  );
}

function GalaxyWifi() {
  return (
    <svg width={14} height={10} viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
      <path d="M1.5 5.5a5.5 5.5 0 0 1 11 0" opacity={0.3} />
      <path d="M3.5 4.2a3.2 3.2 0 0 1 7 0" opacity={0.55} />
      <path d="M5.5 2.9a1 1 0 0 1 3 0" />
      <circle cx={13} cy={8.5} r={1} fill="currentColor" stroke="none" opacity={0.5} />
    </svg>
  );
}

interface WifiIconProps {
  deviceTheme: DeviceTheme;
}

export function DeviceWifiIcon({ deviceTheme }: WifiIconProps) {
  switch (deviceTheme) {
    case "iphone":
      return <IPhoneWifi />;
    case "galaxy":
      return <GalaxyWifi />;
    case "pixel":
      return <WifiIcon sx={{ fontSize: 12 }} />;
  }
}
