import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlindTestPage from "../components/BlindTestPage";
import { CURRENT_BLIND_TEST_ID, blindTest } from "@/lib/blind-tests";

export const metadata: Metadata = {
  title: "AlreaDough 小测试",
  description: "同一句话，两个 AI 各回了一次。选一条你更想收到的回复，再看看大家怎么选。",
};

export default function TestPage() {
  const test = blindTest(CURRENT_BLIND_TEST_ID);
  if (!test) notFound();
  return <BlindTestPage test={test} />;
}
