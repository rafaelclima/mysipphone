export type DeviceTheme = "iphone" | "galaxy" | "pixel";

export interface DeviceThemeConfig {
  cornerRadius: number;
  notchType: "iphone-notch" | "center-hole" | "left-hole";
  cameraSize: number;
  timeAlign: "center" | "left";
  shellColor: string;
  statusBarPt: number;
  homeIndicator: {
    width: number;
    height: number;
    bottom: number;
    borderRadius: number;
  };
}

export const DEVICE_THEMES: Record<DeviceTheme, DeviceThemeConfig> = {
  iphone: {
    cornerRadius: 44,
    notchType: "iphone-notch",
    cameraSize: 18,
    timeAlign: "left",
    shellColor: "#1a1a1c",
    statusBarPt: 3,
    homeIndicator: { width: 128, height: 5, bottom: 6, borderRadius: 2.5 },
  },
  galaxy: {
    cornerRadius: 28,
    notchType: "center-hole",
    cameraSize: 10,
    timeAlign: "left",
    shellColor: "#1c1c1e",
    statusBarPt: 1.5,
    homeIndicator: { width: 80, height: 4, bottom: 5, borderRadius: 2 },
  },
  pixel: {
    cornerRadius: 28,
    notchType: "left-hole",
    cameraSize: 10,
    timeAlign: "center",
    shellColor: "#1f1f1f",
    statusBarPt: 1.5,
    homeIndicator: { width: 64, height: 3, bottom: 4, borderRadius: 1.5 },
  },
};
