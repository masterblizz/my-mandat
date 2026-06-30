"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { PARTY_MEMBERS, type PartyMember } from "../data/members";
import { MINISTER_POSTS, DPM_POSTS, PM_POST, SECTOR_COLORS, SECTOR_LABEL, SPECIALTY_LABEL, getGrade, scoreAssignment, type CabinetPost } from "../data/cabinet";
import { generateConstituencies, type Constituency } from "../data/constituencies";
import type { StateData } from "../data/states";
import { buildCabinetReaction } from "../data/politicalReactions";

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
    return { dpm: 0, ministers: 0, label: "NO GOVERNMENT", note: "Win at least 112 seats to form cabinet." };
  }
  if (seatsWon < 122) {
    return { dpm: 1, ministers: 8, label: "SLIM MAJORITY CABINET", note: "Slim mandate: appoint PM, 1 DPM and 8 core ministries." };
  }
  if (seatsWon < 148) {
    return { dpm: 2, ministers: 12, label: "STABLE MAJORITY CABINET", note: "Stable mandate: full minister line-up unlocked." };
  }
  return { dpm: 2, ministers: 12, label: "SUPER MAJORITY CABINET", note: "Strong mandate: full cabinet authority secured." };
}

function memberRank(member: PartyMember) {
  return member.influence + member.credibility + member.charisma + (member.experience === "veteran" ? 18 : member.experience === "rising" ? 10 : 2);
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
        ministryTitle: post.titleEN,
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
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ POST-ELECTION GOVERNMENT FORMATION</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>BENTUK KABINET</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>
              {leader.partyAbbr} · {seatsWon}/{TOTAL_SEATS} SEATS · {capacity.label}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/results")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← RESULTS</button>
            <button onClick={autoFillCabinet} disabled={!canFormGovernment} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-40" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>AI ADVISOR AUTO-FILL</button>
          </div>
        </div>

        {!canFormGovernment ? (
          <TacticalPanel title="CABINET LOCKED">
            <div className="py-8 text-center">
              <div className="text-4xl font-black" style={{ color: "var(--neon-red)" }}>{seatsWon}/{MAJORITY}</div>
              <div className="mt-3 text-sm text-text-muted tracking-wider">Player did not reach the 112-seat threshold, so cabinet formation is locked.</div>
            </div>
          </TacticalPanel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <TacticalPanel title="MANDATE SIZE">
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-text-muted tracking-widest">WINNING SEATS</div>
                      <div className="text-5xl font-black" style={{ color: leader.partyColor, fontFamily: "Space Mono, monospace" }}>{seatsWon}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-text-muted tracking-widest">MAJORITY</div>
                      <div className="text-2xl font-black text-white">112</div>
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.2)", background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full" style={{ width: `${Math.min(100, (seatsWon / TOTAL_SEATS) * 100)}%`, background: `linear-gradient(90deg, ${leader.partyColor}, var(--gold))` }} />
                  </div>
                  <div className="text-[12px] text-text-muted leading-relaxed">{capacity.note}</div>
                </div>
              </TacticalPanel>

              <TacticalPanel title="PRIME MINISTER">
                <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.32)", background: "rgb(var(--gold-rgb)/0.07)" }}>
                  <div className="text-[10px] font-bold tracking-[0.24em]" style={{ color: "var(--gold)" }}>{PM_POST.titleEN}</div>
                  <div className="mt-2 text-lg font-black text-white tracking-wider">{leader.name}</div>
                  <div className="text-[11px] text-text-muted tracking-wider">{leader.position} · {leader.partyAbbr}</div>
                </div>
              </TacticalPanel>

              <TacticalPanel title="CABINET SCORE">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-text-muted tracking-widest">FILLED POSTS</div>
                    <div className="text-xl font-black text-white">{filledPosts}/{activePosts.length}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-text-muted tracking-widest">GRADE</div>
                    <div className="text-4xl font-black" style={{ color: grade.color }}>{grade.grade}</div>
                  </div>
                </div>
                <div className="mt-3 text-[12px] font-bold tracking-wider" style={{ color: grade.color }}>{grade.labelEN}</div>
              </TacticalPanel>
            </div>

            <TacticalPanel title="MINISTRY SLOTS — SELECT A POST" noPadding>
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-3 space-y-2">
                {activePosts.map((post) => {
                  const member = candidatePool.find((candidate) => candidate.id === assignments[post.id]);
                  const active = selectedPost?.id === post.id;
                  const sectorColor = SECTOR_COLORS[post.sector];
                  const score = member ? scoreAssignment(member, post) : 0;
                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPostId(post.id)}
                      className="w-full border p-3 text-left transition hover:scale-[1.005]"
                      style={{
                        borderColor: active ? sectorColor : "rgb(var(--cyan-rgb)/0.16)",
                        background: active ? `${sectorColor}14` : "rgba(255,255,255,0.025)",
                        boxShadow: active ? `0 0 18px ${sectorColor}22` : "none",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ color: sectorColor }}>{SECTOR_LABEL[post.sector][1]}</div>
                          <div className="mt-1 text-[15px] font-black text-white tracking-wider">{post.titleEN}</div>
                          <div className="mt-1 text-[11px] text-text-muted">Need: {SPECIALTY_LABEL[post.requiredSpecialty][1]}</div>
                          <div className="mt-2 text-[12px]" style={{ color: member ? "var(--cyan)" : "var(--neon-red)" }}>{member ? member.name : "VACANT"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-text-muted">FIT</div>
                          <div className="text-xl font-black" style={{ color: score >= 80 ? "var(--neon-green)" : score >= 65 ? "var(--gold)" : "var(--warn-orange)" }}>{score || "--"}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TacticalPanel>

            <TacticalPanel title={selectedPost ? `APPOINTMENT PANEL · ${selectedPost.titleEN}` : "APPOINTMENT PANEL"} noPadding>
              {selectedPost && (
                <div className="flex h-[calc(100vh-190px)] flex-col">
                  <div className="border-b p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.14)" }}>
                    <div className="text-[11px] text-text-muted tracking-widest">REQUIRED SPECIALTY</div>
                    <div className="mt-1 font-black tracking-wider" style={{ color: SECTOR_COLORS[selectedPost.sector] }}>{SPECIALTY_LABEL[selectedPost.requiredSpecialty][1]}</div>
                    <button onClick={() => clearPost(selectedPost.id)} className="mt-3 px-3 py-1.5 text-[10px] font-bold tracking-widest" style={{ border: "1px solid rgb(255 68 68 / 0.32)", color: "var(--neon-red)", background: "rgb(255 68 68 / 0.06)" }}>CLEAR POST</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {candidatePool.map((member) => {
                      const alreadyAssigned = assignedMembers.has(member.id) && assignments[selectedPost.id] !== member.id;
                      const appointedHere = assignments[selectedPost.id] === member.id;
                      const score = scoreAssignment(member, selectedPost);
                      const specialtyMatch = member.specialty === selectedPost.requiredSpecialty;
                      return (
                        <button
                          key={member.id}
                          onClick={() => assignMember(selectedPost.id, member.id)}
                          className="w-full border p-3 text-left transition hover:scale-[1.006]"
                          style={{
                            borderColor: appointedHere ? "rgb(var(--gold-rgb)/0.72)" : alreadyAssigned ? "rgba(255,255,255,0.08)" : "rgb(var(--cyan-rgb)/0.16)",
                            background: appointedHere ? "rgb(var(--gold-rgb)/0.12)" : alreadyAssigned ? "rgba(255,255,255,0.025)" : "rgba(3,8,15,0.72)",
                            opacity: alreadyAssigned ? 0.58 : 1,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[14px] font-black text-white">{member.name}</div>
                              <div className="text-[11px]" style={{ color: appointedHere ? "var(--gold)" : "var(--cyan)" }}>{member.role}</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: specialtyMatch ? "var(--neon-green)" : "var(--text-muted)", border: `1px solid ${specialtyMatch ? "rgb(0 255 136 / 0.32)" : "rgba(255,255,255,0.1)"}` }}>{SPECIALTY_LABEL[member.specialty][1]}</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>{member.experience.toUpperCase()}</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>{member.homeState.toUpperCase()}</span>
                                {electedMemberIds.has(member.id) && <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider" style={{ color: "var(--gold)", border: "1px solid rgb(var(--gold-rgb)/0.3)" }}>ELECTED MP</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-text-muted">FIT</div>
                              <div className="text-2xl font-black" style={{ color: score >= 80 ? "var(--neon-green)" : score >= 65 ? "var(--gold)" : "var(--warn-orange)" }}>{score}</div>
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
      <StatusBar leftText={`POST-ELECTION · CABINET FORMATION · ${difficulty.toUpperCase()}`} rightText={`${leader.partyAbbr} ${seatsWon} SEATS · DAY ${day}/${totalDays}`} />
    </div>
  );
}
