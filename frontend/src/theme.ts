import { createTheme } from "@mui/material/styles";
import type { DeviceTheme } from "./theme/deviceThemes";
import { DEVICE_THEMES } from "./theme/deviceThemes";

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

export function createAppTheme(mode: "light" | "dark", device: DeviceTheme) {
  const palette = DEVICE_THEMES[device].palette[mode];
  const shapeBorderRadius = DEVICE_THEMES[device].shapeBorderRadius;
  const fontFamily = DEVICE_THEMES[device].fontFamily;

  return createTheme({
    palette: {
      mode,
      ...palette,
    },
    typography: {
      fontFamily,
    },
    shape: {
      borderRadius: shapeBorderRadius,
    },
    components: commonComponents,
  });
}
