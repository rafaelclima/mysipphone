import { BottomNavigation, BottomNavigationAction, Box } from "@mui/material";
import DialpadIcon from "@mui/icons-material/Dialpad";
import ContactsIcon from "@mui/icons-material/Contacts";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate, useLocation } from "react-router-dom";

function NavigationBar() {
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
        px: 1,
        pb: 1.5,
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
            "&.Mui-selected": {
              color: "primary.main",
            },
          },
          "& .MuiSvgIcon-root": {
            fontSize: 24,
          },
        }}
      >
        <BottomNavigationAction label="Dialer" icon={<DialpadIcon />} />
        <BottomNavigationAction label="Contacts" icon={<ContactsIcon />} />
        <BottomNavigationAction label="History" icon={<HistoryIcon />} />
        <BottomNavigationAction label="Settings" icon={<SettingsIcon />} />
      </BottomNavigation>
    </Box>
  );
}

export default NavigationBar;
