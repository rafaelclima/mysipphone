import { createTheme } from "@mui/material/styles";

const commonComponents = {
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: "none",
        fontWeight: 500,
      },
    },
  },

};

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#006492",
      light: "#4a8fc2",
      dark: "#003c5e",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#4f5c62",
      light: "#7c8a91",
      dark: "#273238",
      contrastText: "#ffffff",
    },
    success: {
      main: "#1e8e3e",
    },
    error: {
      main: "#d93025",
    },
    background: {
      default: "#f8f9fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#1f1f1f",
      secondary: "#5f6368",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: commonComponents,
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7cc5ff",
      light: "#b0e0ff",
      dark: "#4a9bd4",
      contrastText: "#003352",
    },
    secondary: {
      main: "#b0c4d0",
      light: "#d2e5f0",
      dark: "#7c939f",
      contrastText: "#1d2b33",
    },
    success: {
      main: "#5bb974",
    },
    error: {
      main: "#f28b82",
    },
    background: {
      default: "#1a1a1c",
      paper: "#252527",
    },
    text: {
      primary: "#e8eaed",
      secondary: "#9aa0a6",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: commonComponents,
});
