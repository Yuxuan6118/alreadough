// Public blind tests at /test: two AI replies to the same message, shown side by side in random order.
// Visitors pick the one they would rather receive. The two sides are stored only as "m1" and "m2";
// which model is which is written down in reports/陪伴对话模型对比.md, never in the page.
import reply2611 from "./blind-test-data/2611-reply";

export type BlindSide = "m1" | "m2";
export type BlindChoice = BlindSide | "tie";
export const BLIND_SIDES: BlindSide[] = ["m1", "m2"];
export const BLIND_CHOICES: BlindChoice[] = ["m1", "m2", "tie"];

export type BlindLine = { role: "user" | "ai"; text: string };
export type BlindTurn = { user: string; reply: string };

export type BlindItem =
  | { id: string; kind: "single"; title: string; note?: string; before?: BlindLine[]; user: string; replies: Record<BlindSide, string> }
  | { id: string; kind: "multi"; title: string; note?: string; turns: Record<BlindSide, BlindTurn[]> };

export type BlindTest = { id: string; title: string; items: BlindItem[] };

const TESTS: BlindTest[] = [reply2611];

/** The test /test shows now. A new test is a new data file added to TESTS; old votes stay under their own id. */
export const CURRENT_BLIND_TEST_ID = "2611-reply";

export function blindTest(id: string): BlindTest | null {
  return TESTS.find((test) => test.id === id) ?? null;
}

/** What a person may say to each side, for display after they vote. */
export const BLIND_SIDE_NAMES: Record<BlindSide, string> = { m1: "模型一", m2: "模型二" };
