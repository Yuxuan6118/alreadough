import type { Metadata, Viewport } from "next";
import InstallTip from "../components/InstallTip";
import LoginGate from "../components/LoginGate";
import NativeShell from "../components/NativeShell";
import NoPinchZoom from "../components/NoPinchZoom";
import OrientationGuard from "../components/OrientationGuard";
import ViewportDebug from "../components/ViewportDebug";
import ViewportKeyboardFix from "../components/ViewportKeyboardFix";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light", // light only; stops phone browsers force-darkening it
  themeColor: "#f4efea",
};

export default function BetaAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NativeShell />
      <ViewportKeyboardFix />
      <NoPinchZoom />
      <OrientationGuard />
      {process.env.NODE_ENV === "development" && <ViewportDebug />}
      <LoginGate>{children}</LoginGate><InstallTip />
    </>
  );
}
