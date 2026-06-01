import type { DeviceTheme } from "../deviceThemes";
import History from "@mui/icons-material/History";
import { DEVICE_THEMES } from "../deviceThemes";

interface Props { deviceTheme: DeviceTheme; sx?: object }

function HistorySvg({ strokeWidth }: { strokeWidth: number }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function HistoryNavIcon({ deviceTheme }: Props) {
  const style = DEVICE_THEMES[deviceTheme].iconStyle;
  if (style === "outline") return <HistorySvg strokeWidth={1.5} />;
  if (style === "bold") return <HistorySvg strokeWidth={3.5} />;
  return <History sx={{ fontSize: 20 }} />;
}
