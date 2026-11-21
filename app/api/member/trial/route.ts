import { memberJson } from "@/lib/member-auth";

// The open 7-day trial is retired: new accounts get Dough Atelier for their first week, and an invitation code adds 30 days.
export function POST() {
  return memberJson({ error: "TRIAL_RETIRED" }, 410);
}
