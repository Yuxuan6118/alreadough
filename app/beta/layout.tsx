import AccessGate from "../components/AccessGate";

export default function FounderBetaLayout({ children }: { children: React.ReactNode }) {
  return <AccessGate>{children}</AccessGate>;
}
