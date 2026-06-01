import type { DeviceTheme } from "../deviceThemes";
import Contacts from "@mui/icons-material/Contacts";
import { DEVICE_THEMES } from "../deviceThemes";

interface Props { deviceTheme: DeviceTheme; sx?: object }

function ContactsSvg({ strokeWidth }: { strokeWidth: number }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function ContactsNavIcon({ deviceTheme }: Props) {
  const style = DEVICE_THEMES[deviceTheme].iconStyle;
  if (style === "outline") return <ContactsSvg strokeWidth={1.5} />;
  if (style === "bold") return <ContactsSvg strokeWidth={3.5} />;
  return <Contacts sx={{ fontSize: 20 }} />;
}
