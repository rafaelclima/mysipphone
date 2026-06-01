import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import App from "./App";
import { useSettingsStore } from "./store/useSettingsStore";
import { lightTheme, darkTheme } from "./theme";
import { I18nProvider } from "./i18n";

function ThemedApp() {
  const mode = useSettingsStore((s) => s.themeMode);

  return (
    <ThemeProvider theme={mode === "dark" ? darkTheme : lightTheme}>
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
