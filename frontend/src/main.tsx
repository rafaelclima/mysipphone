import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import App from "./App";
import { useSettingsStore } from "./store/useSettingsStore";
import type { DeviceTheme } from "./theme/deviceThemes";
import { createAppTheme } from "./theme";
import { I18nProvider } from "./i18n";

function ThemedApp() {
  const mode = useSettingsStore((s) => s.themeMode);
  const storeTheme = useSettingsStore((s) => s.deviceTheme);
  const fromUrl = new URLSearchParams(window.location.search).get("theme") as DeviceTheme | null;
  const deviceTheme = fromUrl ?? storeTheme;
  const theme = createAppTheme(mode, deviceTheme);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ html: { backgroundColor: "transparent" }, body: { backgroundColor: "transparent" }, "#root": { backgroundColor: "transparent" } }} />
      <BrowserRouter>
        <I18nProvider>
          <App />
        </I18nProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>,
);
