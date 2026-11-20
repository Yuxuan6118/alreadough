"use client";

import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { type OnboardingLang, type ProfileSeed } from "@/lib/onboarding-flow";
import { showUndo } from "./ConfirmHost";

type Props = {
  lang: OnboardingLang;
  profile: ProfileSeed;
  onChange: (next: ProfileSeed) => void;
  name: string;
  onNameChange: (name: string) => void;
};

const MAX_PEOPLE = 12;
const MAX_TOPICS = 30;

/** What she told us about herself, editable after the opening. Same soft cards as My desires. Everything is optional. */
export default function ProfilePanel({ lang, profile, onChange, name, onNameChange }: Props) {
  const zh = lang === "zh";
  const [draft, setDraft] = useState({ name: "", relation: "" });
  const [adding, setAdding] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const patch = (next: Partial<ProfileSeed>) => onChange({ ...profile, ...next });

  const updatePerson = (id: string, change: Partial<ProfileSeed["people"][number]>) =>
    patch({ people: profile.people.map((person) => (person.id === id ? { ...person, ...change } : person)) });
  const addPerson = () => {
    const personName = draft.name.trim();
    if (!personName || profile.people.length >= MAX_PEOPLE) return;
    patch({ people: [...profile.people, { id: crypto.randomUUID(), name: personName.slice(0, 40), relation: draft.relation.trim().slice(0, 80) }] });
    setDraft({ name: "", relation: "" });
    setAdding(false);
  };
  const addTopic = () => {
    const topic = topicDraft.trim().slice(0, 80);
    if (!topic || profile.neverInclude.includes(topic) || profile.neverInclude.length >= MAX_TOPICS) return;
    patch({ neverInclude: [...profile.neverInclude, topic] });
    setTopicDraft("");
  };

  return (
    <div className="settings-section profile-panel">
      <div className="profile-cards">
        <section className="profile-card">
          <h3>{zh ? "基本信息" : "The basics"}</h3>
          <div className="profile-pair">
            <label className="wish-field">
              <span>{zh ? "我喜欢的称呼" : "What AlreaDough calls me"}</span>
              <input maxLength={24} value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={zh ? "例如：瑄瑄" : "e.g. Sam"} />
            </label>
            <label className="wish-field">
              <span>{zh ? "我在哪里" : "Where I am"}</span>
              <input maxLength={60} value={profile.country} onChange={(event) => patch({ country: event.target.value })} placeholder={zh ? "国家或城市" : "Country or city"} />
            </label>
          </div>
        </section>

        <section className="profile-card">
          <h3>{zh ? "现在的我" : "Who I am right now"}</h3>
          <label className="wish-field">
            <span className="profile-sub">{zh ? "性格、在意的事、最近的变化" : "Personality, what matters, recent changes"}</span>
            <textarea maxLength={1200} value={profile.about} onChange={(event) => patch({ about: event.target.value })} placeholder={zh ? "比如：慢热，但一旦认定就很投入……" : "For example: slow to warm up, all in once I commit…"} />
          </label>
          <small className="profile-count">{profile.about.length} / 1200</small>
        </section>

        <section className="profile-card">
          <h3>{zh ? "我现在的日子" : "My life right now"}</h3>
          <label className="wish-field">
            <span className="profile-sub">{zh ? "学习、工作和生活节奏" : "Studies, work, and daily rhythm"}</span>
            <textarea maxLength={1200} value={profile.situation} onChange={(event) => patch({ situation: event.target.value })} placeholder={zh ? "细节越具体，回复越贴合你的情况。" : "Details help AlreaDough respond to your situation."} />
          </label>
          <small className="profile-count">{profile.situation.length} / 1200</small>
        </section>

        <section className="profile-card">
          <h3>{zh ? "对我重要的人" : "People who matter to me"}</h3>
          {profile.people.length > 0 && <ul className="profile-people">{profile.people.map((person) => (
            <li key={person.id}>
              <span className="profile-avatar" aria-hidden="true">{person.name.trim().slice(0, 1) || "·"}</span>
              <div>
                <input aria-label={zh ? "名字" : "Name"} maxLength={40} value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} />
                <input aria-label={zh ? "TA 是谁" : "Who they are"} maxLength={80} value={person.relation} onChange={(event) => updatePerson(person.id, { relation: event.target.value })} placeholder={zh ? "TA 是谁" : "Who they are"} />
              </div>
              <button type="button" className="profile-remove" aria-label={zh ? `移除 ${person.name}` : `Remove ${person.name}`} onClick={() => { patch({ people: profile.people.filter((item) => item.id !== person.id) }); showUndo(zh ? `已移除 ${person.name}` : `Removed ${person.name}`, zh ? "撤销" : "Undo", () => onChange({ ...profile })); }}><X size={16} /></button>
            </li>
          ))}</ul>}
          {profile.people.length < MAX_PEOPLE && (adding ? (
            <div className="profile-add">
              <label className="wish-field"><span>{zh ? "名字" : "Name"}</span><input maxLength={40} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={zh ? "例如：小雨" : "e.g. Mia"} /></label>
              <label className="wish-field"><span>{zh ? "TA 是谁" : "Who they are"}</span><input maxLength={80} value={draft.relation} onChange={(event) => setDraft((current) => ({ ...current, relation: event.target.value }))} placeholder={zh ? "例如：大学室友，最懂我的人" : "e.g. college roommate"} onKeyDown={(event) => { if (event.key === "Enter") addPerson(); }} /></label>
              <div className="wish-actions">
                <button type="button" className="wish-primary" disabled={!draft.name.trim()} onClick={addPerson}>{zh ? "添加" : "Add"}</button>
                <button type="button" className="wish-delete" onClick={() => { setAdding(false); setDraft({ name: "", relation: "" }); }}>{zh ? "取消" : "Cancel"}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="wish-add profile-add-button" onClick={() => setAdding(true)}><Plus size={17} /> {zh ? "添加重要的人" : "Add someone"}</button>
          ))}
        </section>

        <section className="profile-card">
          <h3>{zh ? "不想被提的话题" : "Topics to leave alone"}</h3>
          {profile.neverInclude.length > 0 && <div className="profile-topics">{profile.neverInclude.map((topic) => (
            <span key={topic} className="profile-topic">{topic}<button type="button" aria-label={zh ? `移除「${topic}」` : `Remove “${topic}”`} onClick={() => { patch({ neverInclude: profile.neverInclude.filter((item) => item !== topic) }); showUndo(zh ? `已移除「${topic}」` : `Removed “${topic}”`, zh ? "撤销" : "Undo", () => onChange({ ...profile })); }}><X size={13} /></button></span>
          ))}</div>}
          {profile.neverInclude.length < MAX_TOPICS && <div className="profile-topic-add">
            <input maxLength={80} value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTopic(); } }} placeholder={zh ? "例如：我的体重" : "For example: my weight"} />
            <button type="button" className="profile-topic-plus" disabled={!topicDraft.trim()} onClick={addTopic}><Plus size={15} /> {zh ? "添加" : "Add"}</button>
          </div>}
        </section>
      </div>
    </div>
  );
}
