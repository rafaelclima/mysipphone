import { BottomNavigation, BottomNavigationAction, Box } from "@mui/material";
import DialpadIcon from "@mui/icons-material/Dialpad";
import ContactsIcon from "@mui/icons-material/Contacts";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "../i18n";

function NavigationBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

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
        bgcolor: "grey.900",
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
        <BottomNavigationAction label={t("nav.dial")} icon={<DialpadIcon />} />
        <BottomNavigationAction label={t("nav.contacts")} icon={<ContactsIcon />} />
        <BottomNavigationAction label={t("nav.history")} icon={<HistoryIcon />} />
        <BottomNavigationAction label={t("nav.settings")} icon={<SettingsIcon />} />
      </BottomNavigation>
    </Box>
  );
}

export default NavigationBar;
