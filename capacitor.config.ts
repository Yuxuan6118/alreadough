import type { CapacitorConfig } from "@capacitor/cli";

const hostedAppUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "ai.already.mobile",
  appName: "Already",
  webDir: "mobile-web",
  ...(hostedAppUrl
    ? {
        server: {
          url: hostedAppUrl,
          cleartext: hostedAppUrl.startsWith("http://"),
        },
      }
    : {}),
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#F3F1ED",
      showSpinner: false,
      fadeOutDuration: 280,
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: true,
    },
  },
};

export default config;
