"use client";

import { useCallback, useEffect, useState } from "react";
import { clearVoiceCache } from "@/lib/voice-cache";

type Props = { lang: "zh" | "en"; sessionId: string; onRecord: () => void };

/** Her recorded voice: whether it exists, record it again, delete it. */
export default function VoiceSettings({ lang, sessionId, onRecord }: Props) {
  const zh = lang === "zh";
  const [state, setState] = useState<{ loaded: boolean; has: boolean; left: number }>({ loaded: false, has: false, left: 0 });
  const [note, setNote] = useState("");
  const headers = { "x-already-session-id": sessionId, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/voice", { headers: { "x-already-session-id": sessionId } });
      const data = await response.json() as { hasVoice?: boolean; charsLeftToday?: number };
      setState({ loaded: true, has: Boolean(data.hasVoice), left: Number(data.charsLeftToday) || 0 });
    } catch {
      setState({ loaded: true, has: false, left: 0 });
    }
  }, [sessionId]);
  /* eslint-disable react-hooks/set-state-in-effect -- fetch the voice status when this page opens */
  useEffect(() => { void load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const remove = async () => {
    if (!window.confirm(zh ? "要删除你录下的声音吗？删除后会回到默认声音，之后可以重新录。" : "Delete your recorded voice? You will go back to the default voice and can record again.")) return;
    try {
      const response = await fetch("/api/voice", { method: "DELETE", headers });
      if (!response.ok) throw new Error("failed");
      clearVoiceCache();
      setNote(zh ? "你的声音已删除。" : "Your voice is deleted.");
      await load();
    } catch {
      setNote(zh ? "没有删除成功，请稍后再试。" : "Couldn't delete it. Please try again shortly.");
    }
  };

  return (
    <div className="settings-section voice-settings">
      <div className="setting-card">
        <label>{zh ? "我的声音" : "MY VOICE"}</label>
        <p>{!state.loaded ? (zh ? "正在查看……" : "Checking…") : state.has ? (zh ? "你已经录下了自己的声音，入梦声场会用它念给你听。" : "Your voice is recorded. The Dreamscape reads to you in it.") : (zh ? "还没有录。录一次约 45 秒，之后的肯定语和故事都能用你自己的声音念出来。" : "Not recorded yet. It takes about 45 seconds, and then your affirmations and stories can be read in your own voice.")}</p>
        <div className="voice-actions">
          <button type="button" className="outline-button" onClick={onRecord}>{state.has ? (zh ? "重新录我的声音" : "Record again") : (zh ? "录下我的声音" : "Record my voice")}</button>
          {state.has && <button type="button" className="outline-button danger-button" onClick={() => void remove()}>{zh ? "删除我的声音" : "Delete my voice"}</button>}
        </div>
        {note && <p className="voice-note" role="status">{note}</p>}
      </div>
      <div className="setting-card">
        <label>{zh ? "今天还能听" : "LEFT TODAY"}</label>
        <p>{state.loaded ? (zh ? `约 ${Math.floor(state.left / 2)} 个汉字。额度每天重新计算。` : `About ${Math.floor(state.left / 2)} Chinese characters. The allowance resets every day.`) : "…"}</p>
        <p className="voice-note">{zh ? "录音只用来生成声音，不会被保存。声音由语音服务商（阿里云）托管，删除后会一并从那边删除。" : "The recording is only used to create the voice and is not kept. The voice is held by the voice provider (Alibaba Cloud) and is deleted there too."}</p>
      </div>
    </div>
  );
}
