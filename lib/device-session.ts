import { readStored, writeStored } from "./safe-storage";

const key = "already-session-id";
let temporaryId = "";

export function readDeviceSessionId(): string {
  return readStored(key) || temporaryId;
}

export function getDeviceSessionId(): string {
  const existing = readDeviceSessionId();
  if (existing) return existing;

  try {
    temporaryId = crypto.randomUUID();
  } catch {
    temporaryId = `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  writeStored(key, temporaryId);
  return temporaryId;
}
