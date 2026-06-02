import type { ThemeOptions } from "@mui/material/styles";

export type DeviceTheme = "iphone" | "galaxy" | "pixel";

export interface DeviceThemeConfig {
  cornerRadius: number;
  notchType: "iphone-notch" | "center-hole" | "left-hole";
  cameraSize: number;
  timeAlign: "center" | "left";
  shellColor: string;
  shellColorLight: string;
  statusBarPt: number;
  homeIndicator: {
    width: number;
    height: number;
    bottom: number;
    borderRadius: number;
  };
  palette: {
    dark: ThemeOptions["palette"];
    light: ThemeOptions["palette"];
  };
  fontFamily: string;
  shapeBorderRadius: number;
  navBgColor: string;
  navBgColorLight: string;
  contentBgColor: string;
  contentBgColorLight: string;
  iconStyle: "outline" | "bold" | "mui";
}

export const DEVICE_THEMES: Record<DeviceTheme, DeviceThemeConfig> = {
  iphone: {
    cornerRadius: 44,
    notchType: "iphone-notch",
    cameraSize: 18,
    timeAlign: "left",
    shellColor: "#000000",
    shellColorLight: "#1C1C1E",
    statusBarPt: 3,
    homeIndicator: { width: 128, height: 5, bottom: 6, borderRadius: 2.5 },
    palette: {
      dark: {
        primary: { main: "#0A84FF", light: "#66BBFF", dark: "#0066CC", contrastText: "#FFFFFF" },
        secondary: { main: "#8E8E93", light: "#AEAEB2", dark: "#636366", contrastText: "#FFFFFF" },
        success: { main: "#30D158" },
        error: { main: "#FF453A" },
        background: { default: "#000000", paper: "#1C1C1E" },
        text: { primary: "#FFFFFF", secondary: "#AEAEB2" },
      },
      light: {
        primary: { main: "#007AFF", light: "#409CFF", dark: "#0062CC", contrastText: "#FFFFFF" },
        secondary: { main: "#8E8E93", light: "#AEAEB2", dark: "#636366", contrastText: "#FFFFFF" },
        success: { main: "#34C759" },
        error: { main: "#FF3B30" },
        background: { default: "#F2F2F7", paper: "#FFFFFF" },
        text: { primary: "#1C1C1E", secondary: "#AEAEB2" },
      },
    },
    fontFamily: `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`,
    shapeBorderRadius: 12,
    navBgColor: "#1C1C1E",
    navBgColorLight: "#F2F2F7",
    contentBgColor: "#1C1C1E",
    contentBgColorLight: "#F2F2F7",
    iconStyle: "outline",
  },
  galaxy: {
    cornerRadius: 28,
    notchType: "center-hole",
    cameraSize: 16,
    timeAlign: "left",
    shellColor: "#0D0D1A",
    shellColorLight: "#2D2D2D",
    statusBarPt: 1.5,
    homeIndicator: { width: 80, height: 4, bottom: 5, borderRadius: 2 },
    palette: {
      dark: {
        primary: { main: "#2B7BE4", light: "#5A9CF0", dark: "#1A5FC0", contrastText: "#FFFFFF" },
        secondary: { main: "#3A3B3C", light: "#5C5D5E", dark: "#2A2B2C", contrastText: "#FFFFFF" },
        success: { main: "#4CAF50" },
        error: { main: "#EF5350" },
        background: { default: "#0D0D1A", paper: "#1A1A2E" },
        text: { primary: "#F5F5F5", secondary: "#9E9E9E" },
      },
      light: {
        primary: { main: "#1259A0", light: "#3182CE", dark: "#0D4A85", contrastText: "#FFFFFF" },
        secondary: { main: "#767676", light: "#9E9E9E", dark: "#5C5C5C", contrastText: "#FFFFFF" },
        success: { main: "#2E7D32" },
        error: { main: "#D32F2F" },
        background: { default: "#E8EDF2", paper: "#FFFFFF" },
        text: { primary: "#1F1F1F", secondary: "#767676" },
      },
    },
    fontFamily: `"Roboto Condensed", "Roboto", "Noto Sans", sans-serif`,
    shapeBorderRadius: 10,
    navBgColor: "#0D0D1A",
    navBgColorLight: "#E8EDF2",
    contentBgColor: "#1A1A2E",
    contentBgColorLight: "#E8EDF2",
    iconStyle: "bold",
  },
  pixel: {
    cornerRadius: 28,
    notchType: "left-hole",
    cameraSize: 16,
    timeAlign: "center",
    shellColor: "#1A1A1A",
    shellColorLight: "#2D2D2D",
    statusBarPt: 1.5,
    homeIndicator: { width: 64, height: 3, bottom: 4, borderRadius: 1.5 },
    palette: {
      dark: {
        primary: { main: "#BB86FC", light: "#D4B8FF", dark: "#9C5CFF", contrastText: "#1F1F1F" },
        secondary: { main: "#03DAC6", light: "#66FFF8", dark: "#00A896", contrastText: "#1F1F1F" },
        success: { main: "#5BB974" },
        error: { main: "#CF6679" },
        background: { default: "#121212", paper: "#2D2D2D" },
        text: { primary: "#E8EAED", secondary: "#9AA0A6" },
      },
      light: {
        primary: { main: "#6750A4", light: "#9570D6", dark: "#4F378B", contrastText: "#FFFFFF" },
        secondary: { main: "#625B71", light: "#958DA5", dark: "#4A4458", contrastText: "#FFFFFF" },
        success: { main: "#1E8E3E" },
        error: { main: "#B3261E" },
        background: { default: "#FFFBFE", paper: "#F5F0FF" },
        text: { primary: "#1C1B1F", secondary: "#49454F" },
      },
    },
    fontFamily: `"Nunito", "Google Sans", "Product Sans", sans-serif`,
    shapeBorderRadius: 14,
    navBgColor: "#2D2D2D",
    navBgColorLight: "#FFFBFE",
    contentBgColor: "#2D2D2D",
    contentBgColorLight: "#FFFBFE",
    iconStyle: "mui",
  },
};
