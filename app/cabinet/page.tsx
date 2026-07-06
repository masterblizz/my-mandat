"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { PARTY_MEMBERS, type PartyMember } from "../data/members";
import { MINISTER_POSTS, DPM_POSTS, PM_POST, SECTOR_COLORS, SECTOR_LABEL, SPECIALTY_LABEL, getGrade, scoreAssignment, type CabinetPost } from "../data/cabinet";
import { generateConstituencies, type Constituency } from "../data/constituencies";
import type { StateData } from "../data/states";
import { buildCabinetReaction } from "../data/politicalReactions";
import { usePendingNav } from "../hooks/usePendingNav";

const TOTAL_SEATS = 222;
const MAJORITY = 112;

type AssignmentMap = Record<string, string | null>;

type SeatDetail = {
  result: "WIN" | "LOSS" | "OTHERS";
};

function computeSeatDetails(state: StateData): SeatDetail[] {
  const constituencies = generateConstituencies(state);
  return constituencies.map((constituency: Constituency, index: number) => {
    const seed = constituency.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + index * 13;
    const avgRegistered = Math.max(1, Math.round(state.registeredVoters / Math.max(1, state.seats)));
    const registeredVoters = Math.round(avgRegistered * (0.88 + (seed % 25) / 100));
    const turnoutPct = Math.max(55, Math.min(88, state.turnoutTarget + ((seed % 17) - 8) * 0.55));
    const votesCast = Math.round(registeredVoters * (turnoutPct / 100));
    const mandatVotes = Math.round(votesCast * (constituency.mandat / 100));
    const lawanVotes = Math.round(votesCast * (constituency.lawan / 100));
    const othersVotes = Math.max(0, votesCast - mandatVotes - lawanVotes);
    const winner = [
      { votes: mandatVotes, result: "WIN" as const },
      { votes: lawanVotes, result: "LOSS" as const },
      { votes: othersVotes, result: "OTHERS" as const },
    ].sort((a, b) => b.votes - a.votes)[0];
    return { result: winner.result };
  });
}

function getMandatSeats(states: StateData[]) {
  return states.reduce((sum, state) => sum + computeSeatDetails(state).filter((seat) => seat.result === "WIN").length, 0);
}

function getCabinetCapacity(seatsWon: number) {
  if (seatsWon < MAJORITY) {
    return {
      dpm: 0,
      ministers: 0,
      labelMS: "TIADA KERAJAAN",
      labelEN: "NO GOVERNMENT",
      noteMS: "Menang sekurang-kurangnya 112 kerusi untuk membentuk kabinet.",
      noteEN: "Win at least 112 seats to form cabinet.",
    };
  }
  if (seatsWon < 122) {
    return {
      dpm: 1,
      ministers: 8,
      labelMS: "KABINET MAJORITI TIPIS",
      labelEN: "SLIM MAJORITY CABINET",
      noteMS: "Mandat tipis: lantik PM, 1 TPM dan 8 kementerian teras.",
      noteEN: "Slim mandate: appoint PM, 1 DPM and 8 core ministries.",
    };
  }
  if (seatsWon < 148) {
    return {
      dpm: 2,
      ministers: 12,
      labelMS: "KABINET MAJORITI STABIL",
      labelEN: "STABLE MAJORITY CABINET",
      noteMS: "Mandat stabil: barisan menteri penuh dibuka.",
      noteEN: "Stable mandate: full minister line-up unlocked.",
    };
  }
  return {
    dpm: 2,
    ministers: 12,
    labelMS: "KABINET MAJORITI BESAR",
    labelEN: "SUPER MAJORITY CABINET",
    noteMS: "Mandat kuat: kuasa kabinet penuh dijamin.",
    noteEN: "Strong mandate: full cabinet authority secured.",
  };
}

function memberRank(member: PartyMember) {
  return member.influence + member.credibility + member.charisma + (member.experience === "veteran" ? 18 : member.experience === "rising" ? 10 : 2);
}

function scoreBreakdown(member: PartyMember, post: CabinetPost) {
  const total = scoreAssignment(member, post);
  const specialty = member.specialty === post.requiredSpecialty ? 30 : 0;
  const experience = member.experience === "veteran" ? 25 : member.experience === "rising" ? 15 : 5;
  const influence = Math.round((member.influence / 100) * 20);
  const credibility = Math.round((member.credibility / 100) * 15);
  const charisma = Math.max(0, total - specialty - experience - influence - credibility);
  return { total, specialty, experience, influence, credibility, charisma };
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function getCabinetGameplayEffects(posts: CabinetPost[], assignments: AssignmentMap, members: PartyMember[]) {
  const scoreFor = (postId: string) => {
    const post = posts.find((item) => item.id === postId);
    const member = members.find((candidate) => candidate.id === assignments[postId]);
    return post && member ? scoreAssignment(member, post) : 0;
  };
  const appointedScores = posts.map((post) => scoreFor(post.id)).filter((score) => score > 0);
  const economyScore = average([scoreFor("min-fin"), scoreFor("min-trade")].filter(Boolean));
  const mediaScore = scoreFor("min-comm");
  const stabilityScore = average([scoreFor("dpm1"), scoreFor("dpm2"), scoreFor("min-home"), scoreFor("min-def")].filter(Boolean));
  const trustScore = average([scoreFor("min-edu"), scoreFor("min-health"), scoreFor("min-women"), scoreFor("min-youth")].filter(Boolean));
  const weakAppointments = appointedScores.filter((score) => score > 0 && score < 65).length;
  const averageScore = average(appointedScores);
  return {
    funds: clampValue(Math.round((economyScore - 60) * 2.2), -45, 85),
    media: clampValue(Math.round((mediaScore - 60) * 1.6), -35, 65),
    stability: clampValue(Math.round((stabilityScore - 60) * 1.8), -40, 75),
    trust: clampValue(Math.round((trustScore - 60) * 1.7), -35, 70),
    scandalRisk: clampValue(Math.round(42 - averageScore * 0.35 + weakAppointments * 9), 3, 70),
    weakAppointments,
  };
}

const LEADER_AVATARS = [
  "/avatars/leader-01.png",
  "/avatars/leader-02.png",
  "/avatars/leader-03.png",
  "/avatars/leader-04.png",
  "/avatars/leader-05.png",
];

const CABINET_PORTRAIT_MAP: Map<string, string> = new Map([
  ["pm-001", "/candidate-portraits/v1/v1-001.png"],
  ["pm-002", "/candidate-portraits/v1/v1-005.png"],
  ["pm-003", "/candidate-portraits/v3/v3-001.png"],
  ["pm-004", "/candidate-portraits/v3/v3-010.png"],
  ["pm-005", "/candidate-portraits/v2/v2-001.png"],
  ["pm-006", "/candidate-portraits/v1/v1-002.png"],
  ["pm-007", "/candidate-portraits/v1/v1-014.png"],
  ["pm-008", "/candidate-portraits/v3/v3-002.png"],
  ["pm-009", "/candidate-portraits/v2/v2-002.png"],
  ["pm-010", "/candidate-portraits/v1/v1-003.png"],
  ["pm-011", "/candidate-portraits/v3/v3-003.png"],
  ["pm-012", "/candidate-portraits/v3/v3-013.png"],
  ["pm-013", "/candidate-portraits/v2/v2-003.png"],
  ["pm-014", "/candidate-portraits/v1/v1-025.png"],
  ["pm-015", "/candidate-portraits/v1/v1-004.png"],
  ["pm-016", "/candidate-portraits/v3/v3-014.png"],
  ["pm-017", "/candidate-portraits/v3/v3-004.png"],
  ["pm-018", "/candidate-portraits/v1/v1-006.png"],
  ["pm-019", "/candidate-portraits/v1/v1-028.png"],
  ["pm-020", "/candidate-portraits/v3/v3-005.png"],
  ["pm-021", "/candidate-portraits/v1/v1-007.png"],
  ["pm-022", "/candidate-portraits/v3/v3-006.png"],
  ["pm-023", "/candidate-portraits/v3/v3-018.png"],
  ["pm-024", "/candidate-portraits/v1/v1-008.png"],
  ["pm-025", "/candidate-portraits/v1/v1-031.png"],
]);

function memberPortrait(member?: PartyMember | null) {
  return member ? CABINET_PORTRAIT_MAP.get(member.id) ?? `/candidates/${member.id}.png` : "";
}

function CabinetPortrait({
  src,
  alt,
  size = "md",
  tone = "var(--cyan)",
  partyColor = "var(--gold)",
  label,
}: {
  src: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  tone?: string;
  partyColor?: string;
  label?: string;
}) {
  const dims = size === "lg" ? "h-[92px] w-[76px]" : size === "sm" ? "h-[58px] w-[48px]" : "h-[74px] w-[60px]";
  const labelText = label ?? (size === "lg" ? "OFFICIAL" : "MIN");
  return (
    <div
      className={`${dims} group relative shrink-0 overflow-hidden rounded-[2px]`}
      style={{
        border: `1px solid ${tone}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(3,8,15,0.88)), radial-gradient(circle at 50% 18%, rgb(var(--cyan-rgb)/0.22), transparent 48%)",
        boxShadow: `0 0 18px ${tone}28, inset 0 0 18px rgba(255,255,255,0.035)`,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-[4px]" style={{ background: partyColor, boxShadow: `0 0 10px ${partyColor}` }} />
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${partyColor}, ${tone})` }} />
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain object-center"
        style={{ padding: size === "sm" ? "5px 4px 10px 7px" : "6px 5px 13px 9px", filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.45))" }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5" style={{ background: "linear-gradient(180deg, transparent, rgb(3 8 15 / 0.88))" }} />
      <div className="absolute bottom-[2px] left-[7px] right-[3px] truncate text-center text-[6px] font-black tracking-[0.18em]" style={{ color: tone }}>{labelText}</div>
    </div>
  );
}

function useAutoCabinet(posts: CabinetPost[], selectedMembers: PartyMember[]) {
  return useMemo(() => {
    const used = new Set<string>();
    const next: AssignmentMap = {};
    posts.forEach((post) => {
      const pick = [...selectedMembers]
        .filter((member) => !used.has(member.id))
        .sort((a, b) => scoreAssignment(b, post) - scoreAssignment(a, post) || memberRank(b) - memberRank(a))[0];
      next[post.id] = pick?.id ?? null;
      if (pick) used.add(pick.id);
    });
    return next;
  }, [posts, selectedMembers]);
}

export default function CabinetPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, difficulty, day, totalDays, nominations, addPoliticalReaction } = useGameStore();
  const seatsWon = useMemo(() => getMandatSeats(states), [states]);
  const capacity = getCabinetCapacity(seatsWon);
  const canFormGovernment = seatsWon >= MAJORITY;

  const electedMemberIds = useMemo(() => new Set(Object.values(nominations).flatMap((nom) => nom?.type === "member" ? [nom.memberId] : [])), [nominations]);
  const candidatePool = useMemo(() => {
    const elected = PARTY_MEMBERS.filter((member) => electedMemberIds.has(member.id));
    const fallback = PARTY_MEMBERS.filter((member) => !electedMemberIds.has(member.id));
    return [...elected, ...fallback].sort((a, b) => memberRank(b) - memberRank(a));
  }, [electedMemberIds]);

  const activePosts = useMemo<CabinetPost[]>(() => {
    if (!canFormGovernment) return [];
    return [
      ...DPM_POSTS.slice(0, capacity.dpm),
      ...MINISTER_POSTS.slice(0, capacity.ministers),
    ];
  }, [canFormGovernment, capacity.dpm, capacity.ministers]);

  const autoCabinet = useAutoCabinet(activePosts, candidatePool);
  const [assignments, setAssignments] = useState<AssignmentMap>(autoCabinet);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(activePosts[0]?.id ?? null);

  const assignedMembers = useMemo(() => {
    return new Set(Object.values(assignments).filter(Boolean) as string[]);
  }, [assignments]);

  const selectedPost = activePosts.find((post) => post.id === selectedPostId) ?? activePosts[0] ?? null;
  const filledPosts = activePosts.filter((post) => assignments[post.id]).length;
  const cabinetScores = activePosts.map((post) => {
    const member = candidatePool.find((candidate) => candidate.id === assignments[post.id]);
    return member ? scoreAssignment(member, post) : 0;
  });
  const cabinetScore = activePosts.length ? Math.round(cabinetScores.reduce((sum, value) => sum + value, 0) / activePosts.length) : 0;
  const grade = getGrade(cabinetScore);
  const gameplayEffects = getCabinetGameplayEffects(activePosts, assignments, candidatePool);
  const capacityLabel = t(lang, capacity.labelMS, capacity.labelEN);
  const capacityNote = t(lang, capacity.noteMS, capacity.noteEN);
  const postTitle = (post: CabinetPost) => t(lang, post.titleMS, post.titleEN);
  const sectorLabel = (sector: CabinetPost["sector"]) => t(lang, SECTOR_LABEL[sector][0], SECTOR_LABEL[sector][1]);
  const specialtyLabel = (specialty: PartyMember["specialty"]) => t(lang, SPECIALTY_LABEL[specialty][0], SPECIALTY_LABEL[specialty][1]);
  const experienceLabel = (experience: PartyMember["experience"]) => t(lang,
    experience === "veteran" ? "VETERAN" : experience === "rising" ? "SEDANG MENINGKAT" : "BAHARU",
    experience.toUpperCase(),
  );
  const difficultyLabel = t(lang,
    difficulty === "easy" ? "MUDAH" : difficulty === "normal" ? "BIASA" : difficulty === "hard" ? "SUKAR" : "MIMPI NGERI",
    difficulty.toUpperCase(),
  );
  const dpmPosts = activePosts.filter((post) => post.level === "dpm");
  const ministrySectors = useMemo(() => {
    return ["economy", "security", "social", "infrastructure"].map((sector) => ({
      sector: sector as CabinetPost["sector"],
      posts: activePosts.filter((post) => post.level === "minister" && post.sector === sector),
    })).filter((group) => group.posts.length > 0);
  }, [activePosts]);

  function assignMember(postId: string, memberId: string) {
    const member = candidatePool.find((candidate) => candidate.id === memberId);
    const post = activePosts.find((cabinetPost) => cabinetPost.id === postId);
    setAssignments((current) => {
      const next: AssignmentMap = { ...current };
      for (const [slot, assignedMemberId] of Object.entries(next)) {
        if (assignedMemberId === memberId && slot !== postId) next[slot] = null;
      }
      next[postId] = memberId;
      return next;
    });
    if (member && post) {
      addPoliticalReaction(buildCabinetReaction({
        day,
        ministerName: member.name,
        ministryTitle: postTitle(post),
        score: scoreAssignment(member, post),
        partyAbbr: leader.partyAbbr,
      }));
    }
  }

  function clearPost(postId: string) {
    setAssignments((current) => ({ ...current, [postId]: null }));
  }

  function autoFillCabinet() {
    setAssignments(autoCabinet);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "PEMBENTUKAN KERAJAAN SELEPAS PILIHAN RAYA", "POST-ELECTION GOVERNMENT FORMATION")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "BENTUK KABINET", "FORM CABINET")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>
              {leader.partyAbbr} · {seatsWon}/{TOTAL_SEATS} {t(lang, "KERUSI", "SEATS")} · {capacityLabel}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/formation")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "RUNDING KUASA", "FORMATION")}</button>
            <button onClick={() => navigate("/swearing-in")} disabled={!canFormGovernment || isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-40 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--neon-green-rgb,0 255 136)/0.42)", color: "var(--neon-green)", background: "rgb(0 255 136 / 0.06)" }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, "ANGKAT SUMPAH", "SWEARING-IN")}</button>
            <button onClick={autoFillCabinet} disabled={!canFormGovernment} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-40" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{t(lang, "PENASIHAT AI ISI AUTOMATIK", "AI ADVISOR AUTO-FILL")}</button>
          </div>
        </div>

        {!canFormGovernment ? (
          <TacticalPanel title={t(lang, "KABINET DIKUNCI", "CABINET LOCKED")}>
            <div className="py-8 text-center">
              <div className="text-4xl font-black" style={{ color: "var(--neon-red)" }}>{seatsWon}/{MAJORITY}</div>
              <div className="mt-3 text-sm text-text-muted tracking-wider">{t(lang, "Pemain belum mencapai ambang 112 kerusi, jadi pembentukan kabinet dikunci.", "Player did not reach the 112-seat threshold, so cabinet formation is locked.")}</div>
            </div>
          </TacticalPanel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <TacticalPanel title={t(lang, "SAIZ MANDAT", "MANDATE SIZE")}>
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-text-muted tracking-widest">{t(lang, "KERUSI DIMENANGI", "WINNING SEATS")}</div>
                      <div className="text-5xl font-black" style={{ color: leader.partyColor, fontFamily: "Space Mono, monospace" }}>{seatsWon}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-text-muted tracking-widest">{t(lang, "MAJORITI", "MAJORITY")}</div>
                      <div className="text-2xl font-black text-white">112</div>
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.2)", background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full" style={{ width: `${Math.min(100, (seatsWon / TOTAL_SEATS) * 100)}%`, background: `linear-gradient(90deg, ${leader.partyColor}, var(--gold))` }} />
                  </div>
                  <div className="text-[12px] text-text-muted leading-relaxed">{capacityNote}</div>
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "PERDANA MENTERI", "PRIME MINISTER")}>
                <div className="flex items-center gap-3 border p-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.32)", background: "rgb(var(--gold-rgb)/0.07)" }}>
                  <CabinetPortrait src={LEADER_AVATARS[leader.avatarIndex] ?? LEADER_AVATARS[0]} alt={`${leader.name} avatar`} size="md" tone="var(--gold)" partyColor={leader.partyColor} label="PM" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-[0.24em]" style={{ color: "var(--gold)" }}>{postTitle(PM_POST)}</div>
                    <div className="mt-2 text-lg font-black text-white tracking-wider">{leader.name}</div>
                    <div className="text-[11px] text-text-muted tracking-wider">{leader.position} · {leader.partyAbbr}</div>
                  </div>
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "SKOR KABINET", "CABINET SCORE")}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-text-muted tracking-widest">{t(lang, "JAWATAN DIISI", "FILLED POSTS")}</div>
                    <div className="text-xl font-black text-white">{filledPosts}/{activePosts.length}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-text-muted tracking-widest">{t(lang, "GRED", "GRADE")}</div>
                    <div className="text-4xl font-black" style={{ color: grade.color }}>{grade.grade}</div>
                  </div>
                </div>
                <div className="mt-3 text-[12px] font-bold tracking-wider" style={{ color: grade.color }}>{t(lang, grade.labelMS, grade.labelEN)}</div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "KESAN KABINET", "CABINET EFFECTS")}>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { labelMS: "Dana", labelEN: "Funds", value: gameplayEffects.funds, suffix: "%", good: true },
                    { labelMS: "Media", labelEN: "Media", value: gameplayEffects.media, suffix: "%", good: true },
                    { labelMS: "Stabil", labelEN: "Stability", value: gameplayEffects.stability, suffix: "%", good: true },
                    { labelMS: "Trust", labelEN: "Trust", value: gameplayEffects.trust, suffix: "%", good: true },
                    { labelMS: "Risiko skandal", labelEN: "Scandal risk", value: gameplayEffects.scandalRisk, suffix: "%", good: false, wide: true },
                  ].map((effect) => {
                    const positive = effect.good ? effect.value >= 0 : effect.value <= 25;
                    const color = positive ? "var(--neon-green)" : effect.value === 0 ? "var(--text-muted)" : "var(--warn-orange)";
                    const display = effect.good && effect.value > 0 ? `+${effect.value}${effect.suffix}` : `${effect.value}${effect.suffix}`;
                    return (
                      <div key={effect.labelEN} className={`${effect.wide ? "col-span-2" : ""} flex items-center justify-between gap-2 border px-2 py-1.5`} style={{ borderColor: "rgb(var(--cyan-rgb)/0.12)", background: "rgba(255,255,255,0.025)" }}>
                        <span className="text-[9px] font-bold tracking-wider text-text-muted">{t(lang, effect.labelMS, effect.labelEN)}</span>
                        <span className="text-[12px] font-black" style={{ color }}>{display}</span>
                      </div>
                    );
                  })}
                </div>
              </TacticalPanel>
            </div>

            <TacticalPanel title={t(lang, "HIRARKI KABINET — PILIH JAWATAN", "CABINET HIERARCHY — SELECT A POST")} noPadding>
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-4">
                <div className="relative mx-auto max-w-[980px]">
                  <div className="flex justify-center">
                    <div className="relative flex min-w-[280px] items-center gap-3 border p-4 text-left" style={{ borderColor: "rgb(var(--gold-rgb)/0.58)", background: "linear-gradient(135deg, rgb(var(--gold-rgb)/0.13), rgba(3,8,15,0.88))", boxShadow: "0 0 24px rgb(var(--gold-rgb)/0.13)" }}>
                      <CabinetPortrait src={LEADER_AVATARS[leader.avatarIndex] ?? LEADER_AVATARS[0]} alt={`${leader.name} avatar`} size="lg" tone="var(--gold)" partyColor={leader.partyColor} label="PM" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--gold)" }}>{postTitle(PM_POST)}</div>
                        <div className="mt-2 text-xl font-black tracking-wider text-white">{leader.name}</div>
                        <div className="mt-1 text-[11px] tracking-wider text-text-muted">{leader.position} · {leader.partyAbbr}</div>
                      </div>
                    </div>
                  </div>

                  {dpmPosts.length > 0 && (
                    <>
                      <div className="mx-auto h-8 w-px" style={{ background: "linear-gradient(180deg, rgb(var(--gold-rgb)/0.75), rgb(var(--cyan-rgb)/0.45))" }} />
                      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${dpmPosts.length}, minmax(0, 1fr))` }}>
                        {dpmPosts.map((post) => {
                          const member = candidatePool.find((candidate) => candidate.id === assignments[post.id]);
                          const active = selectedPost?.id === post.id;
                          const sectorColor = SECTOR_COLORS[post.sector];
                          const score = member ? scoreAssignment(member, post) : 0;
                          return (
                            <button
                              key={post.id}
                              onClick={() => setSelectedPostId(post.id)}
                              className="relative border p-3 text-left transition hover:scale-[1.01]"
                              style={{
                                borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.28)",
                                background: active ? "linear-gradient(135deg, rgb(var(--gold-rgb)/0.13), rgb(var(--cyan-rgb)/0.055))" : "rgba(3,8,15,0.72)",
                                boxShadow: active ? "0 0 22px rgb(var(--gold-rgb)/0.18)" : "inset 0 0 16px rgb(var(--cyan-rgb)/0.035)",
                              }}
                            >
                              <div className="text-[9px] font-bold tracking-[0.24em]" style={{ color: sectorColor }}>{t(lang, "EKSEKUTIF", "EXECUTIVE")}</div>
                              <div className="mt-1 flex items-start justify-between gap-3">
                                {member && <CabinetPortrait src={memberPortrait(member)} alt={`${member.name} profile photo`} size="md" tone={sectorColor} partyColor={leader.partyColor} label="DPM" />}
                                <div className="min-w-0 flex-1">
                                  <div className="text-[15px] font-black tracking-wider text-white">{postTitle(post)}</div>
                                  <div className="mt-1 text-[10px] text-text-muted">{t(lang, "Perlu", "Need")}: {specialtyLabel(post.requiredSpecialty)}</div>
                                  <div className="mt-2 truncate text-[12px]" style={{ color: member ? "var(--cyan)" : "var(--neon-red)" }}>{member ? member.name : t(lang, "KOSONG", "VACANT")}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-black leading-none" style={{ color: score >= 80 ? "var(--neon-green)" : score >= 65 ? "var(--gold)" : "var(--warn-orange)" }}>{score || "--"}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="mx-auto h-8 w-px" style={{ background: "linear-gradient(180deg, rgb(var(--cyan-rgb)/0.45), rgb(var(--cyan-rgb)/0.16))" }} />

                  <div className="grid gap-4 2xl:grid-cols-4 xl:grid-cols-2">
                    {ministrySectors.map(({ sector, posts }) => {
                      const sectorColor = SECTOR_COLORS[sector];
                      return (
                        <div key={sector} className="border p-3" style={{ borderColor: `${sectorColor}55`, background: "linear-gradient(180deg, rgba(255,255,255,0.026), rgba(3,8,15,0.64))" }}>
                          <div className="mb-3 flex items-center justify-between border-b pb-2" style={{ borderColor: `${sectorColor}33` }}>
                            <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: sectorColor }}>{sectorLabel(sector)}</div>
                            <div className="text-[9px] text-text-muted">{posts.length} {t(lang, "PORTFOLIO", "PORTFOLIO")}</div>
                          </div>
                          <div className="space-y-2">
                            {posts.map((post) => {
                              const member = candidatePool.find((candidate) => candidate.id === assignments[post.id]);
                              const active = selectedPost?.id === post.id;
                              const score = member ? scoreAssignment(member, post) : 0;
                              return (
                                <button
                                  key={post.id}
                                  onClick={() => setSelectedPostId(post.id)}
                                  className="relative w-full overflow-hidden border p-3 text-left transition hover:scale-[1.01]"
                                  style={{
                                    borderColor: active ? sectorColor : "rgb(var(--cyan-rgb)/0.13)",
                                    background: active ? `${sectorColor}18` : "rgba(3,8,15,0.62)",
                                    boxShadow: active ? `0 0 18px ${sectorColor}20` : "none",
                                  }}
                                >
                                  <div className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: leader.partyColor, boxShadow: `0 0 10px ${leader.partyColor}` }} />
                                  <div className="absolute right-2 top-1 text-[7px] font-black tracking-[0.22em] opacity-40" style={{ color: sectorColor }}>{t(lang, "RASMI", "OFFICIAL")}</div>
                                  <div className="flex items-start justify-between gap-2">
                                    {member && <CabinetPortrait src={memberPortrait(member)} alt={`${member.name} profile photo`} size="md" tone={sectorColor} partyColor={leader.partyColor} label="MIN" />}
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[11px] font-black leading-tight tracking-wide text-white">{postTitle(post)}</div>
                                      <div className="mt-1 text-[9px] text-text-muted">{t(lang, "Perlu", "Need")}: {specialtyLabel(post.requiredSpecialty)}</div>
                                      <div className="mt-1 truncate text-[11px]" style={{ color: member ? "var(--cyan)" : "var(--neon-red)" }}>{member ? member.name : t(lang, "KOSONG", "VACANT")}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-base font-black leading-none" style={{ color: score >= 80 ? "var(--neon-green)" : score >= 65 ? "var(--gold)" : "var(--warn-orange)" }}>{score || "--"}</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TacticalPanel>

            <TacticalPanel title={selectedPost ? `${t(lang, "PANEL PELANTIKAN", "APPOINTMENT PANEL")} · ${postTitle(selectedPost)}` : t(lang, "PANEL PELANTIKAN", "APPOINTMENT PANEL")} noPadding>
              {selectedPost && (
                <div className="flex h-[calc(100vh-190px)] flex-col">
                  <div className="border-b p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.14)" }}>
                    <div className="text-[11px] text-text-muted tracking-widest">{t(lang, "KEPAKARAN DIPERLUKAN", "REQUIRED SPECIALTY")}</div>
                    <div className="mt-1 font-black tracking-wider" style={{ color: SECTOR_COLORS[selectedPost.sector] }}>{specialtyLabel(selectedPost.requiredSpecialty)}</div>
                    <button onClick={() => clearPost(selectedPost.id)} className="mt-3 px-3 py-1.5 text-[10px] font-bold tracking-widest" style={{ border: "1px solid rgb(255 68 68 / 0.32)", color: "var(--neon-red)", background: "rgb(255 68 68 / 0.06)" }}>{t(lang, "KOSONGKAN JAWATAN", "CLEAR POST")}</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {candidatePool.map((member) => {
                      const alreadyAssigned = assignedMembers.has(member.id) && assignments[selectedPost.id] !== member.id;
                      const appointedHere = assignments[selectedPost.id] === member.id;
                      const score = scoreAssignment(member, selectedPost);
                      const breakdown = scoreBreakdown(member, selectedPost);
                      const specialtyMatch = member.specialty === selectedPost.requiredSpecialty;
                      return (
                        <button
                          key={member.id}
                          onClick={() => assignMember(selectedPost.id, member.id)}
                          className="relative w-full overflow-hidden border p-3 text-left transition hover:scale-[1.006]"
                          style={{
                            borderColor: appointedHere ? "rgb(var(--gold-rgb)/0.72)" : alreadyAssigned ? "rgba(255,255,255,0.08)" : "rgb(var(--cyan-rgb)/0.16)",
                            background: appointedHere ? "rgb(var(--gold-rgb)/0.12)" : alreadyAssigned ? "rgba(255,255,255,0.025)" : "rgba(3,8,15,0.72)",
                            opacity: alreadyAssigned ? 0.58 : 1,
                          }}
                        >
                          <div className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: leader.partyColor, opacity: appointedHere ? 1 : 0.55 }} />
                          <div className="flex items-start justify-between gap-3">
                            <CabinetPortrait src={memberPortrait(member)} alt={`${member.name} profile photo`} size="sm" tone={appointedHere ? "var(--gold)" : "var(--cyan)"} partyColor={leader.partyColor} label="MP" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-black text-white">{member.name}</div>
                              <div className="truncate text-[11px]" style={{ color: appointedHere ? "var(--gold)" : "var(--cyan)" }}>{member.role}</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: specialtyMatch ? "var(--neon-green)" : "var(--text-muted)", border: `1px solid ${specialtyMatch ? "rgb(0 255 136 / 0.32)" : "rgba(255,255,255,0.1)"}` }}>{specialtyLabel(member.specialty)}</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>{experienceLabel(member.experience)}</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>{member.homeState.toUpperCase()}</span>
                                {electedMemberIds.has(member.id) && <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: "var(--gold)", border: "1px solid rgb(var(--gold-rgb)/0.3)" }}>{t(lang, "AHLI PARLIMEN DIPILIH", "ELECTED MP")}</span>}
                              </div>
                              <div className="mt-2 grid grid-cols-5 gap-1 text-[8px] font-bold tracking-wider text-text-muted">
                                <span>{t(lang, "Kep", "Spc")} +{breakdown.specialty}</span>
                                <span>{t(lang, "Exp", "Exp")} +{breakdown.experience}</span>
                                <span>{t(lang, "Pgrh", "Inf")} +{breakdown.influence}</span>
                                <span>{t(lang, "Kred", "Cred")} +{breakdown.credibility}</span>
                                <span>{t(lang, "Kar", "Cha")} +{breakdown.charisma}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-black leading-none" style={{ color: score >= 80 ? "var(--neon-green)" : score >= 65 ? "var(--gold)" : "var(--warn-orange)" }}>{score}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </TacticalPanel>
          </div>
        )}
      </main>
      <StatusBar leftText={`${t(lang, "SELEPAS PILIHAN RAYA · PEMBENTUKAN KABINET", "POST-ELECTION · CABINET FORMATION")} · ${difficultyLabel}`} rightText={`${leader.partyAbbr} ${seatsWon} ${t(lang, "KERUSI", "SEATS")} · ${t(lang, "HARI", "DAY")} ${day}/${totalDays}`} />
    </div>
  );
}
