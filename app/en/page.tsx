import type { Metadata } from "next";
import PublicHome from "../components/PublicHome";

export const metadata: Metadata = {
  description: "Explore the life you want through AI conversations, writing, and audio practices in English or Chinese.",
};

export default function EnglishHomePage() {
  return <PublicHome lang="en" />;
}
