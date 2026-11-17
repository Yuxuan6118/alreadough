import type { Metadata } from "next";
import ProductPage from "../../components/ProductPage";

export const metadata: Metadata = {
  title: "AlreaDough",
  description: "AlreaDough uses conversation, stories, revision, vision boards and sound to bring you back, every day, to the life where your wish has come true.",
};

export default function EnglishAboutPage() {
  return <ProductPage lang="en" />;
}
