import type { Metadata } from "next";
import ProductPage from "../components/ProductPage";

export const metadata: Metadata = {
  title: "AlreaDough",
  description: "AlreaDough 用对话、故事、重写、愿景板和声音，陪你每天回到愿望已经实现的样子。",
};

export default function AboutPage() {
  return <ProductPage lang="zh" />;
}
