import { memberCookie, memberJson, revokeMemberSession, sameOrigin } from "@/lib/member-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return memberJson({ error: "INVALID_ORIGIN" }, 403);
  await revokeMemberSession(request);
  return memberJson({ signedOut: true }, 200, memberCookie("", 0));
}
