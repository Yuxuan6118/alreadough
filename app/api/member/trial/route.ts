import { memberJson } from "@/lib/member-auth";

// The open 7-day trial is retired: a free account gets a 7-day Atelier upgrade only with an invitation code.
export function POST() {
  return memberJson({ error: "TRIAL_RETIRED" }, 410);
}
