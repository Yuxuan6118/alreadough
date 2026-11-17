import type { Metadata, Viewport } from "next";
import InstallTip from "../components/InstallTip";
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
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efea" },
    { media: "(prefers-color-scheme: dark)", color: "#211d1d" },
  ],
};

export default function BetaAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NativeShell />
      <ViewportKeyboardFix />
      <NoPinchZoom />
      <OrientationGuard />
      {process.env.NODE_ENV === "development" && <ViewportDebug />}
      {children}<InstallTip />
    </>
  );
}
