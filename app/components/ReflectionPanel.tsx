"use client";

import { useMemo, useState } from "react";
import { clipReflection, mentionsSelfHarm, reflectionQuestions, repeatedWords, type ReflectionGoal, type ReflectionQuestionId } from "@/lib/reflection";

type Lang = "zh" | "en";

export default function ReflectionPanel({ lang, goals, currentGoalId, onChange }: { lang: Lang; goals: ReflectionGoal[]; currentGoalId: string; onChange: (goalId: string, question: ReflectionQuestionId, text: string) => void }) {
  const zh = lang === "zh";
  const [picked, setPicked] = useState<string | null>(null);
  const repeated = useMemo(() => repeatedWords(goals), [goals]);
  const written = goals.reduce((total, goal) => total + reflectionQuestions.filter((question) => (goal.reflection[question.id] || "").trim()).length, 0);
  const needsCare = goals.some((goal) => reflectionQuestions.some((question) => mentionsSelfHarm(goal.reflection[question.id] || "")));
  const questionText = (id: ReflectionQuestionId) => { const question = reflectionQuestions.find((item) => item.id === id); return zh ? question?.zh : question?.en; };
  const active = repeated.find((row) => row.word === picked);

  return <div className="settings-section reflect-panel">
    <div className="setting-card reflect-intro">
      <span>{zh ? "自我觉察" : "SELF-REFLECTION"}</span>
      <p>{zh ? "想要的东西，背后常常连着更深的东西。这里不替你下结论，只给你几个问题，写不写、写多少都由你。" : "What we want is often tied to something deeper. Nothing here draws a conclusion for you. These are only a few questions, and whether and how much you write is up to you."}</p>
      <small>{zh ? "你写的内容和愿望卡一样保存在你的空间里。它不会发给 AI，也不会出现在创始人查看的对话页里。任何问题都可以空着，哪个让你难受就跳过。" : "What you write is kept in your space like your desire cards. It is not sent to the AI and does not appear in the founder's conversation viewer. Any question can stay empty; skip whatever feels hard."}</small>
    </div>

    {needsCare && <div className="setting-card reflect-care" role="note">
      <p>{zh ? "你写下的这些我看到了。你的价值不取决于现实里发生的任何事，再糟的 3D 也不值得你伤害自己。如果现在有伤害自己的念头，请马上联系身边信任的人，或当地的急救和危机支持。" : "I saw what you wrote. Your worth does not depend on anything that happens in reality, and no 3D, however bad, is worth hurting yourself over. If you have thoughts of harming yourself right now, please reach someone you trust nearby, or local emergency or crisis support."}</p>
    </div>}

    {goals.map((goal) => {
      const filled = reflectionQuestions.filter((question) => (goal.reflection[question.id] || "").trim()).length;
      return <details className="setting-card reflect-goal" key={goal.id}>
        <summary><strong>{goal.title}</strong><small>{filled ? (zh ? `已写 ${filled} 处` : `${filled} written`) : (zh ? "还没写" : "Nothing yet")}{goal.id === currentGoalId ? (zh ? " · 当前" : " · Current") : ""}</small></summary>
        {reflectionQuestions.map((question) => <label key={question.id} className="reflect-question">
          <span>{zh ? question.zh : question.en}</span>
          <small>{zh ? question.zhHint : question.enHint}</small>
          <textarea rows={3} value={goal.reflection[question.id] || ""} onChange={(event) => onChange(goal.id, question.id, clipReflection(event.target.value))} />
        </label>)}
      </details>;
    })}

    <div className="setting-card reflect-words">
      <span>{zh ? "你反复写下的词" : "WORDS YOU KEEP WRITING"}</span>
      <p>{zh ? "这些是你自己写下的、出现在不止一处的词。它们意味着什么，由你来读。" : "These are words you wrote in more than one place. What they mean is yours to read."}</p>
      {repeated.length ? <>
        <div className="reflect-chips">{repeated.map((row) => <button type="button" key={row.word} className={picked === row.word ? "selected" : ""} onClick={() => setPicked((current) => current === row.word ? null : row.word)}>{row.word}<small>×{row.count}</small></button>)}</div>
        {active && <ul className="reflect-where">{active.where.map((place, index) => <li key={`${place.goalTitle}-${place.question}-${index}`}><strong>{place.goalTitle}</strong><span>{questionText(place.question)}</span></li>)}</ul>}
      </> : <small className="reflect-empty">{written < 2 ? (zh ? "多写几处之后，这里会列出你反复用到的词。" : "After you write a few answers, the words you repeat will appear here.") : (zh ? "目前没有在不同地方重复出现的词。" : "No word appears in more than one place yet.")}</small>}
    </div>
  </div>;
}
