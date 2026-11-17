import { memberAccount, memberAuthReady, memberJson } from "@/lib/member-auth";

export async function GET(request: Request) {
  return memberJson({ authenticated: Boolean(await memberAccount(request)), emailAvailable: memberAuthReady() });
}
