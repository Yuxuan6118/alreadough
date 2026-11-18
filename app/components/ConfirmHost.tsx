"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Two kinds of delete:
 *  - askConfirm(): a calm in-app dialog for things that can't easily come back (a desire, a story, a memory, a conversation).
 *  - showUndo(): a small "Deleted · Undo" bar for light items that are quick to re-add (a topic, a person, a thought).
 * Both render through <ConfirmHost/>, mounted once. Without it, askConfirm falls back to the browser dialog.
 */

type ConfirmRequest = { title: string; body?: string; confirmLabel: string; cancelLabel: string; resolve: (ok: boolean) => void };
type UndoRequest = { id: number; message: string; undoLabel: string; undo: () => void };

let confirmListener: ((request: ConfirmRequest) => void) | null = null;
let undoListener: ((request: UndoRequest) => void) | null = null;
let undoSeq = 0;

export function askConfirm(options: { title: string; body?: string; confirmLabel: string; cancelLabel: string }): Promise<boolean> {
  if (!confirmListener) return Promise.resolve(window.confirm(options.body ? `${options.title}\n\n${options.body}` : options.title));
  return new Promise((resolve) => confirmListener?.({ ...options, resolve }));
}

export function showUndo(message: string, undoLabel: string, undo: () => void) {
  undoListener?.({ id: ++undoSeq, message, undoLabel, undo });
}

export default function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [toast, setToast] = useState<UndoRequest | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  useEffect(() => {
    confirmListener = (next) => setRequest((current) => { current?.resolve(false); return next; });
    undoListener = setToast;
    return () => { confirmListener = null; undoListener = null; };
  }, []);

  useEffect(() => {
    if (!request) return;
    cancelButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      {request && (
        <div className="confirm-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) close(false); }}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={request.body ? "confirm-body" : undefined}>
            <h2 id="confirm-title">{request.title}</h2>
            {request.body && <p id="confirm-body">{request.body}</p>}
            <div className="confirm-actions">
              <button type="button" ref={cancelButton} className="confirm-cancel" onClick={() => close(false)}>{request.cancelLabel}</button>
              <button type="button" className="confirm-ok" onClick={() => close(true)}>{request.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="undo-toast" role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => { toast.undo(); setToast(null); }}>{toast.undoLabel}</button>
        </div>
      )}
    </>
  );
}
