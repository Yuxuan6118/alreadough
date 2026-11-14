import PublicHome from "./components/PublicHome";
import InstalledAppRedirect from "./components/InstalledAppRedirect";

export default function HomePage() {
  return <><InstalledAppRedirect /><PublicHome lang="zh" /></>;
}
