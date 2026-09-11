"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { readStored, writeStored } from "@/lib/safe-storage";

// Front-door gate for the whole site (web + the wrapped mobile shell share this
// same page). Purely a soft "not open to everyone yet" gate, not a security
// boundary: it only hides the UI, it does not stop a direct API call. The real
// cost/abuse backstop is the per-device and global daily limits in beta-guard.
const GATE_KEY = "already-access-gate-v1";
const GATE_CODE = "20260910";

export default function AccessGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage read on mount */
    if (readStored(GATE_KEY) === GATE_CODE) setUnlocked(true);
    setChecked(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.trim() === GATE_CODE) {
      writeStored(GATE_KEY, GATE_CODE);
      setUnlocked(true);
    } else {
      setError(true);
    }
  }

  // Avoid a flash of real content before the localStorage check resolves.
  if (!checked) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="access-gate">
      <form onSubmit={submit}>
        <h1>AlreaDough</h1>
        <p>内测通行码，输入后可继续。<br />Enter the access code to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          value={code}
          onChange={(event) => { setCode(event.target.value); setError(false); }}
          placeholder="通行码 · Access code"
          aria-label="Access code"
        />
        {error && <small>通行码不对，再试一次。· That code didn&apos;t work.</small>}
        <button type="submit">进入 · Enter</button>
      </form>
    </div>
  );
}
