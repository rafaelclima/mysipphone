import type { DeviceTheme } from "../deviceThemes";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";

function IPhoneBattery() {
  return (
    <svg width={15} height={10} viewBox="0 0 15 10" fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x={0.5} y={1} width={11.5} height={8} rx={2.5} fill="currentColor" opacity={0.85} stroke="none" />
      <rect x={12.5} y={3.5} width={1.5} height={3} rx={0.75} fill="currentColor" stroke="none" />
    </svg>
  );
}

function GalaxyBattery() {
  return (
    <svg width={15} height={10} viewBox="0 0 15 10" fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x={0.5} y={1} width={11.5} height={8} rx={1.5} stroke="currentColor" fill="none" />
      <rect x={12.5} y={3} width={1.5} height={4} rx={0.5} fill="currentColor" stroke="none" />
      <rect x={1.5} y={2} width={9.5} height={6} rx={0.5} fill="currentColor" opacity={0.8} stroke="none" />
    </svg>
  );
}

interface BatteryIconProps {
  deviceTheme: DeviceTheme;
}

export function BatteryIcon({ deviceTheme }: BatteryIconProps) {
  switch (deviceTheme) {
    case "iphone":
      return <IPhoneBattery />;
    case "galaxy":
      return <GalaxyBattery />;
    case "pixel":
      return <BatteryFullIcon sx={{ fontSize: 14 }} />;
  }
}
