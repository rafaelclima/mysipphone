import type { DeviceTheme } from "../deviceThemes";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";

function IPhoneSignal() {
  return (
    <svg width={14} height={10} viewBox="0 0 14 10" fill="currentColor">
      <rect x={0.5} y={7} width={2.5} height={3} rx={1.25} opacity={0.35} />
      <rect x={3.5} y={4.5} width={2.5} height={5.5} rx={1.25} opacity={0.55} />
      <rect x={6.5} y={2} width={2.5} height={8} rx={1.25} opacity={0.75} />
      <rect x={9.5} y={0} width={2.5} height={10} rx={1.25} />
    </svg>
  );
}

function GalaxySignal() {
  return (
    <svg width={14} height={10} viewBox="0 0 14 10" fill="currentColor">
      <rect x={0.5} y={6} width={2.5} height={4} rx={0.5} opacity={0.35} />
      <rect x={3.5} y={3.5} width={2.5} height={6.5} rx={0.5} opacity={0.55} />
      <rect x={6.5} y={1.5} width={2.5} height={8.5} rx={0.5} opacity={0.75} />
      <rect x={9.5} y={0} width={2.5} height={10} rx={0.5} />
    </svg>
  );
}

interface SignalIconProps {
  deviceTheme: DeviceTheme;
}

export function SignalIcon({ deviceTheme }: SignalIconProps) {
  switch (deviceTheme) {
    case "iphone":
      return <IPhoneSignal />;
    case "galaxy":
      return <GalaxySignal />;
    case "pixel":
      return <SignalCellularAltIcon sx={{ fontSize: 13 }} />;
  }
}
