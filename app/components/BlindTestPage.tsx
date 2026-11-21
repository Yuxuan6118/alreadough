"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BLIND_SIDE_NAMES, type BlindChoice, type BlindItem, type BlindSide, type BlindTest } from "@/lib/blind-tests";
import SiteFooter from "./SiteFooter";
import styles from "./blind-test.module.css";

type Tally = Record<BlindChoice, number>;
type Results = { voters: number; items: Record<string, Tally>; totals: Tally };
type Order = Record<string, [BlindSide, BlindSide]>;

const LEFT_RIGHT = ["甲", "乙"] as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: picks just aren't remembered */ }
}
function newVoterId() {
  try { return crypto.randomUUID(); } catch { return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}

export default function BlindTestPage({ test }: { test: BlindTest }) {
  const keys = useMemo(() => ({ voter: "blind-voter", order: `blind-order:${test.id}`, picks: `blind-picks:${test.id}`, done: `blind-done:${test.id}` }), [test.id]);
  const [voter, setVoter] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [picks, setPicks] = useState<Record<string, BlindChoice>>({});
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "busy">("idle");

  const loadResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/test-vote?test=${encodeURIComponent(test.id)}`, { cache: "no-store" });
      if (response.ok) setResults(await response.json() as Results);
    } catch { /* results are a bonus; the test still works without them */ }
  }, [test.id]);

  // Each visitor gets their own random left/right order per question, kept so a reload shows the same page.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of this visitor's saved order and picks from storage on mount */
  useEffect(() => {
    const savedVoter = read<string>(keys.voter);
    const id = typeof savedVoter === "string" && savedVoter.length >= 16 ? savedVoter : newVoterId();
    if (id !== savedVoter) write(keys.voter, id);
    const saved = read<Order>(keys.order) ?? {};
    const next: Order = {};
    for (const item of test.items) {
      const kept = saved[item.id];
      next[item.id] = kept && kept.length === 2 && kept.includes("m1") && kept.includes("m2") ? kept : Math.random() < 0.5 ? ["m1", "m2"] : ["m2", "m1"];
    }
    write(keys.order, next);
    setVoter(id);
    setOrder(next);
    setPicks(read<Record<string, BlindChoice>>(keys.picks) ?? {});
    const finished = read<boolean>(keys.done) === true;
    setDone(finished);
    if (finished || window.location.hash === "#results") void loadResults();
  }, [keys, test.items, loadResults]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function choose(itemId: string, choice: BlindChoice) {
    // Build on the latest picks, so quick taps on several questions all count.
    setPicks((current) => {
      const next = { ...current, [itemId]: choice };
      write(keys.picks, next);
      return next;
    });
  }

  async function submit() {
    if (!voter || !Object.keys(picks).length) return;
    setStatus("sending");
    try {
      const response = await fetch("/api/test-vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId: test.id, voter, picks }) });
      if (response.status === 429) { setStatus("busy"); return; }
      if (!response.ok) { setStatus("error"); return; }
      const data = await response.json() as { results: Results };
      setResults(data.results);
      setDone(true);
      write(keys.done, true);
      setStatus("idle");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("error");
    }
  }

  const answered = test.items.filter((item) => picks[item.id]).length;
  const left = test.items.length - answered;

  return (
    <div className={styles.page}>
      <main className={styles.wrap}>
        <header className={styles.head}>
          <a className={styles.brand} href="/about">AlreaDough</a>
          <p className={styles.eyebrow}>小测试</p>
          <h1>{test.title}</h1>
          <p className={styles.intro}>{"下面每组是一句写给 AlreaDough 的话，两个 AI 各回了一次。这些话都是为了测试写的，不是真实用户的对话。每组选一条你更想收到的回复，选完点「提交」，就能看到大家是怎么选的。匿名，不用登录，大约 10 分钟。"}</p>
        </header>

        {results && <Summary results={results} test={test} picks={done ? picks : null} />}

        {!order ? (
          <p className={styles.loading}>正在准备题目…</p>
        ) : (
          <ol className={styles.items}>
            {test.items.map((item, index) => (
              <li key={item.id} className={styles.card}>
                <Question item={item} index={index} order={order[item.id]} pick={picks[item.id]} revealed={done} onChoose={(choice) => choose(item.id, choice)} />
              </li>
            ))}
          </ol>
        )}
      </main>

      <div className={styles.bar} role="region" aria-label="提交">
        <span className={styles.progress}>{done ? "已提交，可以改选后再提交一次" : `已选 ${answered} / ${test.items.length}`}</span>
        <button className={styles.submit} type="button" disabled={!answered || status === "sending" || !order} onClick={submit}>
          {status === "sending" ? "正在提交…" : done ? "更新我的选择" : left ? `提交（还有 ${left} 组没选）` : "提交"}
        </button>
        {status === "error" && <span className={styles.error}>没有提交成功，请检查网络后再试一次。</span>}
        {status === "busy" && <span className={styles.error}>这一小时提交得有点多，过一会儿再试。</span>}
      </div>
      <SiteFooter lang="zh" />
    </div>
  );
}

function Question({ item, index, order, pick, revealed, onChoose }: { item: BlindItem; index: number; order: [BlindSide, BlindSide]; pick?: BlindChoice; revealed: boolean; onChoose: (choice: BlindChoice) => void }) {
  return (
    <section aria-labelledby={`q-${item.id}`}>
      <h2 id={`q-${item.id}`} className={styles.qTitle}>
        <span className={styles.qNum}>{index + 1}</span>
        {item.title}
        {item.kind === "multi" && <span className={styles.qKind}>5 轮对话</span>}
      </h2>
      {item.note && <p className={styles.note}>{item.note}</p>}
      {item.kind === "single" && (
        <div className={styles.prompt}>
          {item.before && (
            <div className={styles.before}>
              <p className={styles.beforeLabel}>前面的对话</p>
              {item.before.map((line, i) => <p key={i}><b>{line.role === "user" ? "她" : "AI"}：</b>{line.text}</p>)}
            </div>
          )}
          <p className={styles.said}><b>她说：</b>{item.user}</p>
        </div>
      )}
      <div className={styles.pair}>
        {order.map((side, i) => (
          <div key={side} className={`${styles.side} ${pick === side ? styles.picked : ""}`}>
            <p className={styles.sideLabel}>{LEFT_RIGHT[i]}{revealed && <span> · {BLIND_SIDE_NAMES[side]}</span>}</p>
            {item.kind === "single" ? (
              <p className={styles.reply}>{item.replies[side]}</p>
            ) : (
              <div className={styles.thread}>
                {item.turns[side].map((turn, t) => (
                  <div key={t} className={styles.turn}>
                    <p className={styles.turnUser}>她：{turn.user}</p>
                    <p className={styles.reply}>{turn.reply}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.choices} role="group" aria-label={`第 ${index + 1} 组，选一条`}>
        {order.map((side, i) => (
          <button key={side} type="button" aria-pressed={pick === side} className={pick === side ? styles.on : ""} onClick={() => onChoose(side)}>{LEFT_RIGHT[i]}更好</button>
        ))}
        <button type="button" aria-pressed={pick === "tie"} className={pick === "tie" ? styles.on : ""} onClick={() => onChoose("tie")}>差不多</button>
      </div>
    </section>
  );
}

function Bar({ tally }: { tally: Tally }) {
  const total = tally.m1 + tally.m2 + tally.tie;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className={styles.result}>
      <div className={styles.track} aria-hidden="true">
        {total > 0 && <>
          <i className={styles.segM1} style={{ width: `${pct(tally.m1)}%` }} />
          <i className={styles.segTie} style={{ width: `${pct(tally.tie)}%` }} />
          <i className={styles.segM2} style={{ width: `${pct(tally.m2)}%` }} />
        </>}
      </div>
      <p className={styles.counts}>
        {BLIND_SIDE_NAMES.m1} {tally.m1} · 差不多 {tally.tie} · {BLIND_SIDE_NAMES.m2} {tally.m2}
      </p>
    </div>
  );
}

function Summary({ results, test, picks }: { results: Results; test: BlindTest; picks: Record<string, BlindChoice> | null }) {
  const pickName = (choice?: BlindChoice) => (!choice ? "没选" : choice === "tie" ? "差不多" : BLIND_SIDE_NAMES[choice]);
  return (
    <section className={styles.summary} aria-labelledby="summary-title">
      <h2 id="summary-title">{picks ? "谢谢！这是目前大家的选择" : "目前大家的选择"}</h2>
      <p className={styles.summaryLead}>{results.voters} 人参加。两个 AI 只写作「{BLIND_SIDE_NAMES.m1}」和「{BLIND_SIDE_NAMES.m2}」，每个人看到的左右顺序是随机的。</p>
      <Bar tally={results.totals} />
      <details className={styles.perItem}>
        <summary>每一组的选择</summary>
        <ul>
          {test.items.map((item, index) => (
            <li key={item.id}>
              <p>{index + 1}. {item.title}{picks && <span className={styles.yours}>你选了：{pickName(picks[item.id])}</span>}</p>
              <Bar tally={results.items[item.id] ?? { m1: 0, m2: 0, tie: 0 }} />
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
