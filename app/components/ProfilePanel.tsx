"use client";

import { useState, type ReactNode } from "react";
import { splitLines, type OnboardingLang, type ProfileSeed } from "@/lib/onboarding-flow";

type Props = {
  lang: OnboardingLang;
  profile: ProfileSeed;
  onChange: (next: ProfileSeed) => void;
  before?: ReactNode;
};

const MAX_PEOPLE = 12;

/** What she told us about herself, editable after the opening. Everything here is optional and can be emptied. */
export default function ProfilePanel({ lang, profile, onChange, before }: Props) {
  const zh = lang === "zh";
  const [neverDraft, setNeverDraft] = useState(() => profile.neverInclude.join("\n"));
  const [draft, setDraft] = useState({ name: "", relation: "" });
  const patch = (next: Partial<ProfileSeed>) => onChange({ ...profile, ...next });

  const updatePerson = (id: string, change: Partial<ProfileSeed["people"][number]>) =>
    patch({ people: profile.people.map((person) => (person.id === id ? { ...person, ...change } : person)) });
  const addPerson = () => {
    const name = draft.name.trim();
    if (!name || profile.people.length >= MAX_PEOPLE) return;
    patch({ people: [...profile.people, { id: crypto.randomUUID(), name: name.slice(0, 40), relation: draft.relation.trim().slice(0, 80) }] });
    setDraft({ name: "", relation: "" });
  };

  return (
    <div className="settings-section profile-panel">
      {before}
      <div className="setting-card editable-card">
        <label>{zh ? "我在哪里" : "WHERE I AM"}</label>
        <input maxLength={60} value={profile.country} onChange={(event) => patch({ country: event.target.value })} placeholder={zh ? "国家或城市" : "Country or city"} />
      </div>
      <div className="setting-card editable-card">
        <label>{zh ? "现在的我" : "WHO I AM RIGHT NOW"}</label>
        <textarea maxLength={1200} value={profile.about} onChange={(event) => patch({ about: event.target.value })} placeholder={zh ? "可以写你的性格、在意的事和最近的变化" : "Your personality, what matters to you, or what has changed lately"} />
      </div>
      <div className="setting-card editable-card">
        <label>{zh ? "我现在的日子" : "MY LIFE RIGHT NOW"}</label>
        <textarea maxLength={1200} value={profile.situation} onChange={(event) => patch({ situation: event.target.value })} placeholder={zh ? "可以写最近的学习、工作和生活节奏。细节越具体，回复越贴合你的情况。" : "Share your studies, work, or daily routine. Details help AlreaDough respond to your situation."} />
      </div>
      <div className="setting-card editable-card">
        <label>{zh ? "对我重要的人" : "PEOPLE WHO MATTER TO ME"}</label>
        <p className="profile-note">{zh ? "名字加一句 TA 是谁。AlreaDough 只用你写的，不替他们编性格或经历。" : "A name and who they are. AlreaDough uses only what you write and never invents their traits or history."}</p>
        {profile.people.length > 0 && <ul className="profile-people">{profile.people.map((person) => <li key={person.id}>
          <input aria-label={zh ? "名字" : "Name"} maxLength={40} value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} />
          <input aria-label={zh ? "TA 是谁" : "Who they are"} maxLength={80} value={person.relation} onChange={(event) => updatePerson(person.id, { relation: event.target.value })} placeholder={zh ? "TA 是谁" : "Who they are"} />
          <button type="button" aria-label={zh ? "移除" : "Remove"} onClick={() => patch({ people: profile.people.filter((item) => item.id !== person.id) })}>×</button>
        </li>)}</ul>}
        {profile.people.length < MAX_PEOPLE && <div className="profile-add">
          <input maxLength={40} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={zh ? "名字" : "Name"} />
          <input maxLength={80} value={draft.relation} onChange={(event) => setDraft((current) => ({ ...current, relation: event.target.value }))} placeholder={zh ? "TA 是谁，例如：妈妈" : "Who they are, e.g. mom"} onKeyDown={(event) => { if (event.key === "Enter") addPerson(); }} />
          <button type="button" className="outline-button" disabled={!draft.name.trim()} onClick={addPerson}>{zh ? "添加" : "Add"}</button>
        </div>}
      </div>
      <div className="setting-card editable-card">
        <label>{zh ? "不想被提的话题" : "TOPICS TO LEAVE ALONE"}</label>
        <p className="profile-note">{zh ? "AlreaDough 不会主动提起，也不会写进场景和故事。" : "AlreaDough will not bring them up or write them into scenes and stories."}</p>
        <textarea value={neverDraft} onChange={(event) => { setNeverDraft(event.target.value); patch({ neverInclude: splitLines(event.target.value, 30) }); }} placeholder={zh ? "例如：我的体重" : "For example: my weight"} />
      </div>
    </div>
  );
}
