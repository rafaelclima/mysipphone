import type { DeviceTheme } from "../deviceThemes";
import Call from "@mui/icons-material/Call";
import { DEVICE_THEMES } from "../deviceThemes";

interface Props { deviceTheme: DeviceTheme; sx?: object }

function CallSvg({ strokeWidth }: { strokeWidth: number }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function CallIcon({ deviceTheme }: Props) {
  const style = DEVICE_THEMES[deviceTheme].iconStyle;
  if (style === "outline") return <CallSvg strokeWidth={1.5} />;
  if (style === "bold") return <CallSvg strokeWidth={3.5} />;
  return <Call sx={{ fontSize: 32 }} />;
}
