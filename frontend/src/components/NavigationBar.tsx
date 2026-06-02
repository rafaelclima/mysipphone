import { BottomNavigation, BottomNavigationAction, Box } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "../i18n";
import { DEVICE_THEMES } from "../theme/deviceThemes";
import type { DeviceTheme } from "../theme/deviceThemes";
import { DialpadIcon, ContactsNavIcon, HistoryNavIcon, SettingsNavIcon } from "../theme/icons";

interface NavigationBarProps {
  deviceTheme: DeviceTheme;
  navBgColor: string;
}

function NavigationBar({ deviceTheme, navBgColor }: NavigationBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const cfg = DEVICE_THEMES[deviceTheme];

  const currentValue =
    {
      "/": 0,
      "/contacts": 1,
      "/history": 2,
      "/settings": 3,
    }[location.pathname] ?? 0;

  return (
    <Box
      sx={{
        bgcolor: navBgColor,
        "& .MuiBottomNavigation-root": {
          bgcolor: "transparent",
        },
      }}
    >
      <BottomNavigation
        value={currentValue}
        onChange={(_, newValue) => {
          const paths = ["/", "/contacts", "/history", "/settings"];
          navigate(paths[newValue]);
        }}
        showLabels
        sx={{
          "& .MuiBottomNavigationAction-root": {
            color: "grey.500",
            minWidth: 0,
            py: 0.25,
            "&.Mui-selected": {
              color: "primary.main",
            },
          },
          "& .MuiSvgIcon-root": {
            fontSize: 20,
          },
          "& .MuiBottomNavigationAction-label": {
            fontSize: 10,
            mt: 0.25,
          },
        }}
      >
        <BottomNavigationAction label={t("nav.dial")} icon={<DialpadIcon deviceTheme={deviceTheme} />} />
        <BottomNavigationAction label={t("nav.contacts")} icon={<ContactsNavIcon deviceTheme={deviceTheme} />} />
        <BottomNavigationAction label={t("nav.history")} icon={<HistoryNavIcon deviceTheme={deviceTheme} />} />
        <BottomNavigationAction label={t("nav.settings")} icon={<SettingsNavIcon deviceTheme={deviceTheme} />} />
      </BottomNavigation>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          pb: cfg.homeIndicator.bottom,
          pt: 0.5,
        }}
      >
        <Box
          sx={{
            width: cfg.homeIndicator.width,
            height: cfg.homeIndicator.height,
            borderRadius: cfg.homeIndicator.borderRadius,
            bgcolor: "grey.600",
          }}
        />
      </Box>
    </Box>
  );
}

export default NavigationBar;
