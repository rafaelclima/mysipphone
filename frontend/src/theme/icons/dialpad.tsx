import type { DeviceTheme } from "../deviceThemes";
import Dialpad from "@mui/icons-material/Dialpad";
import { DEVICE_THEMES } from "../deviceThemes";

interface Props { deviceTheme: DeviceTheme; sx?: object }

function DialpadSvg({ strokeWidth }: { strokeWidth: number }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="4" r="1.8" />
      <circle cx="12" cy="4" r="1.8" />
      <circle cx="19" cy="4" r="1.8" />
      <circle cx="5" cy="9.5" r="1.8" />
      <circle cx="12" cy="9.5" r="1.8" />
      <circle cx="19" cy="9.5" r="1.8" />
      <circle cx="5" cy="15" r="1.8" />
      <circle cx="12" cy="15" r="1.8" />
      <circle cx="19" cy="15" r="1.8" />
      <circle cx="5" cy="20.5" r="1.8" />
      <circle cx="12" cy="20.5" r="1.8" />
      <circle cx="19" cy="20.5" r="1.8" />
    </svg>
  );
}

export function DialpadIcon({ deviceTheme }: Props) {
  const style = DEVICE_THEMES[deviceTheme].iconStyle;
  if (style === "outline") return <DialpadSvg strokeWidth={1.5} />;
  if (style === "bold") return <DialpadSvg strokeWidth={3.5} />;
  return <Dialpad sx={{ fontSize: 20 }} />;
}
