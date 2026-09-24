"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "../i18n/useLang";
import { useGameStore } from "../store/gameStore";
import type { Issue, LeadershipApproach, PersonalOfficeId } from "../store/journey";

type Copy = { title: string; detail: string; effect: string };
type Choice<T extends string> = { id: T; icon: string; ms: Copy; en: Copy };
const offices: Choice<PersonalOfficeId>[] = [
  { id: "community", icon: "🏘️", ms: { title: "Pusat Khidmat", detail: "Dekat dengan penduduk dan isu harian.", effect: "Kepercayaan +5" }, en: { title: "Service Centre", detail: "Close to residents and daily issues.", effect: "Trust +5" } },
  { id: "city", icon: "🏙️", ms: { title: "Pejabat Bandar", detail: "Berhampiran media dan rangkaian parti.", effect: "Kepercayaan +1 · Jentera +3" }, en: { title: "City Office", detail: "Near media and party networks.", effect: "Trust +1 · Organisation +3" } },
  { id: "digital", icon: "📡", ms: { title: "Studio Digital", detail: "Bina suara dan jentera baharu.", effect: "Jentera +5" }, en: { title: "Digital Studio", detail: "Build a new voice and organisation.", effect: "Organisation +5" } },
];
const issues: Choice<Issue>[] = [
  { id: "flood", icon: "🌊", ms: { title: "Banjir", detail: "Saliran dan keselamatan kawasan.", effect: "Isu asal anda" }, en: { title: "Flooding", detail: "Drainage and neighbourhood safety.", effect: "Your origin issue" } },
  { id: "clinic", icon: "🏥", ms: { title: "Klinik", detail: "Akses rawatan untuk keluarga.", effect: "Isu asal anda" }, en: { title: "Clinic", detail: "Care access for families.", effect: "Your origin issue" } },
  { id: "jobs", icon: "🏪", ms: { title: "Pekerjaan", detail: "Peluang untuk peniaga dan belia.", effect: "Isu asal anda" }, en: { title: "Jobs", detail: "Opportunity for traders and youth.", effect: "Your origin issue" } },
];
const approaches: Choice<LeadershipApproach>[] = [
  { id: "service", icon: "🤝", ms: { title: "Berbakti", detail: "Dengar dahulu, bertindak kemudian.", effect: "Kepercayaan +4" }, en: { title: "Serve", detail: "Listen first, then act.", effect: "Trust +4" } },
  { id: "bridge", icon: "🧭", ms: { title: "Satukan", detail: "Gabungkan ahli lama dan belia.", effect: "Kepercayaan +2 · Jentera +3" }, en: { title: "Bridge", detail: "Bring veterans and youth together.", effect: "Trust +2 · Organisation +3" } },
  { id: "digital", icon: "📣", ms: { title: "Gerakkan", detail: "Bina penyokong melalui suara digital.", effect: "Jentera +5" }, en: { title: "Mobilise", detail: "Build supporters through digital voice.", effect: "Organisation +5" } },
];

export default function CityOnboarding() {
  const router = useRouter(); const lang = useLang();
  const { journey, phase, setPersonalOffice, completeCharacterPrologue } = useGameStore();
  const [step, setStep] = useState<0 | 1 | 2>(journey.personalOffice ? 1 : 0);
  const [office, setOffice] = useState<PersonalOfficeId | null>(journey.personalOffice);
  const [issue, setIssue] = useState<Issue | null>(journey.originIssue);
  const [approach, setApproach] = useState<LeadershipApproach | null>(journey.leadershipApproach);
  if (phase !== "menu" || journey.characterStage !== "member") return null;
  const sets = [offices, issues, approaches] as const;
  const selected = step === 0 ? office : step === 1 ? issue : approach;
  const labels = lang === "ms"
    ? [["BAB 1 · PINTU CAWANGAN", "Pilih pejabat pertama anda", "Di sini karier politik anda bermula."], ["BAB 1 · DENGAR RAKYAT", "Pilih isu akar umbi", "Isu ini akan mengiringi janji dan cerita anda."], ["BAB 2 · NAMA DI LAPANGAN", "Pilih gaya kepimpinan", "Pilihan ini memberi kesan pada kepercayaan dan jentera."]]
    : [["CHAPTER 1 · THE BRANCH DOOR", "Choose your first office", "Your political career starts here."], ["CHAPTER 1 · HEAR THE PEOPLE", "Choose a grassroots issue", "This issue follows your pledges and story."], ["CHAPTER 2 · A NAME ON THE GROUND", "Choose a leadership approach", "This choice affects trust and organisation."]];
  const next = () => {
    if (!selected) return;
    if (step === 0) { setPersonalOffice(office!); setStep(1); return; }
    if (step === 1) { setStep(2); return; }
    completeCharacterPrologue(issue!, approach!); router.push("/setup");
  };
  const pick = (id: string) => { if (step === 0) setOffice(id as PersonalOfficeId); else if (step === 1) setIssue(id as Issue); else setApproach(id as LeadershipApproach); };
  return <section className="fixed bottom-5 left-5 right-5 z-[70] max-w-[760px] border p-4 shadow-2xl md:left-8" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(var(--bg-rgb) / .92)", backdropFilter: "blur(12px)" }}>
    <div className="flex gap-3"><div className="relative hidden h-16 w-16 shrink-0 overflow-hidden border sm:block" style={{ borderColor: "rgb(var(--gold-rgb) / .55)" }}><Image src="/mymandat-avatar.png" alt="Political career guide" fill sizes="64px" className="object-cover" priority /></div><div><div className="text-[9px] font-black tracking-[.22em] text-gold">{labels[step][0]}</div><h2 className="mt-1 text-sm font-black text-white">{labels[step][1]}</h2><p className="mt-1 text-[11px] text-text-muted">{labels[step][2]}</p></div></div>
    <div className="mt-3 grid gap-2 md:grid-cols-3">{sets[step].map((choice) => { const active = selected === choice.id; const text = choice[lang]; return <button key={choice.id} onClick={() => pick(choice.id)} className="border p-3 text-left" style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb) / .22)", background: active ? "rgb(var(--gold-rgb) / .12)" : "rgb(var(--bg-rgb) / .5)" }}><div className="text-lg">{choice.icon}</div><b className="text-[11px]" style={{ color: active ? "var(--gold)" : "var(--text-primary)" }}>{text.title}</b><p className="mt-1 text-[10px] text-text-muted">{text.detail}</p><span className="mt-2 block text-[9px] font-bold text-cyan">{text.effect}</span></button>; })}</div>
    <div className="mt-3 flex justify-end"><button onClick={next} disabled={!selected} className="border px-4 py-2 text-[10px] font-black tracking-widest disabled:opacity-40" style={{ borderColor: "rgb(var(--gold-rgb) / .7)", color: "var(--gold)" }}>{step === 2 ? (lang === "ms" ? "MASUK SETUP CALON" : "ENTER CANDIDATE SETUP") : (lang === "ms" ? "TERUSKAN" : "CONTINUE")} →</button></div>
  </section>;
}
