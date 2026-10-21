"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { formatNumber, formatPercent } from "../utils/format";
import { computeSeatDetails } from "../utils/seatDetails";
import { usePendingNav } from "../hooks/usePendingNav";
import { useLang, t } from "../i18n/useLang";
import { REP_OPENING_ALLOCATION, REP_QUARTER_GRANT, repSide } from "../store/representative";

const LEADER_AVATARS = [
  "/avatars/leader-01.png",
  "/avatars/leader-02.png",
  "/avatars/leader-03.png",
  "/avatars/leader-04.png",
  "/avatars/leader-05.png",
];

function winnerColor(winner: "mandat" | "lawan" | "others", partyColor: string) {
  return winner === "mandat" ? partyColor : winner === "lawan" ? "var(--warn-orange)" : "var(--text-muted)";
}

export default function ElectedPage() {
  const lang = useLang();
  const { isPending, navigate } = usePendingNav();
  const { states, leader, settings, setHasWonElection, journey, careerProgress } = useGameStore();
  // Representative career: this page is the new game's day one.
  const side = repSide(journey);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReveal(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const isPrn = settings.electionScope === "prn";
  const homeState = states.find((s) => s.id === (isPrn ? settings.prnStateId : leader.homeState)) ?? states[0];
  const partyDisplay = leader.partyAbbr || leader.party || "PLAYER";
  const stateSeatDetails = homeState ? computeSeatDetails(homeState, partyDisplay, isPrn ? "dun" : "parliament") : [];
  const ownSeat = stateSeatDetails.find((seat) => seat.constituency.id === leader.homeConstituencyId) ?? stateSeatDetails.find((seat) => seat.result === "WIN");
  const seatKind = isPrn ? "DUN" : t(lang, "elected_page.parliament");
  const officeTitle = isPrn ? "ADUN" : t(lang, "elected_page.memberOfParliament");
  const wonOwnSeat = ownSeat?.constituency.id === leader.homeConstituencyId && ownSeat.result === "WIN";

  // This page only ever renders its win branch when the player's own seat
  // was actually won (see the guard below) — that makes it the single
  // correct place to flip the /kawasan develop-system gate open, instead
  // of duplicating this same win check somewhere else.
  useEffect(() => {
    if (wonOwnSeat) setHasWonElection(true);
  }, [wonOwnSeat, setHasWonElection]);

  // Guard against direct navigation when the leader's own seat wasn't actually won.
  if (!ownSeat || ownSeat.result !== "WIN") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="text-[13px] text-text-muted tracking-widest uppercase">{t(lang, "elected_page.noPersonalSeatResultToDisplay")}</div>
          <button
            onClick={() => navigate("/mandate")}
            disabled={isPending}
            className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
            style={{ background: "rgb(var(--gold-rgb) / 0.13)", border: "1px solid rgb(var(--gold-rgb) / 0.55)", color: "var(--gold)", fontFamily: "Space Mono, monospace" }}
          >
            {isPending ? t(lang, "elected_page.loading") : t(lang, "elected_page.continueMandate")}
          </button>
        </main>
        <StatusBar />
      </div>
    );
  }

  const avatarSrc = LEADER_AVATARS[leader.avatarIndex] ?? LEADER_AVATARS[0];

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(circle at 50% 0%, rgb(var(--gold-rgb)/0.10), transparent 35%), var(--bg)" }}>
      <Header />
      <main
        className="pt-[56px] pb-[52px] px-8 w-full"
        style={{
          opacity: reveal ? 1 : 0,
          transform: reveal ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <div className="mb-5 mt-2">
          <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "elected_page.personalResultSeat", { seatKind: seatKind })}</div>
          <h1 className="text-2xl font-bold tracking-widest" style={{ fontFamily: "Space Mono, monospace", color: "var(--gold)" }}>
            {t(lang, "elected_page.youHaveBeenElected", { officeTitle: officeTitle })}
          </h1>
        </div>

        {side && (
          <section className="mb-4 border p-4" style={{ borderColor: "rgb(var(--gold-rgb) / 0.45)", background: "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.10), rgb(var(--bg-rgb) / 0.85))", fontFamily: "Space Mono, monospace" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black tracking-[0.25em]" style={{ color: "var(--gold)" }}>◆ {t(lang, `HARI PERTAMA · PENGGAL ${careerProgress.term}`, `DAY ONE · TERM ${careerProgress.term}`)}</div>
                <h2 className="mt-1 text-lg font-black text-white">
                  {side === "government"
                    ? t(lang, `Anda kini ${officeTitle} blok kerajaan.`, `You are now a government-bench ${officeTitle}.`)
                    : t(lang, `Anda kini ${officeTitle} blok pembangkang.`, `You are now an opposition-bench ${officeTitle}.`)}
                </h2>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-text-muted">
                  {t(lang,
                    `Rakyat ${ownSeat.constituency.name} menunggu janji anda. Anda ada 20 suku tahun untuk membangunkan kawasan sebelum ${isPrn ? "PRN" : "PRU"} seterusnya — prestasi anda menentukan sama ada kerusi ini kekal milik anda.`,
                    `The people of ${ownSeat.constituency.name} are waiting on your promises. You have 20 quarters to develop the constituency before the next ${isPrn ? "state" : "general"} election — your record decides whether you keep this seat.`)}
                </p>
              </div>
              <span className="border px-3 py-1.5 text-[10px] font-black tracking-widest" style={{ borderColor: side === "government" ? "rgb(var(--cyan-rgb) / 0.6)" : "rgb(255 176 0 / 0.6)", color: side === "government" ? "var(--cyan)" : "var(--warn-orange)" }}>
                {side === "government" ? `🏛️ ${t(lang, "KERAJAAN", "GOVERNMENT")}` : `⚖️ ${t(lang, "PEMBANGKANG", "OPPOSITION")}`}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                [t(lang, "PERUNTUKAN PEMBANGUNAN", "DEVELOPMENT ALLOCATION"), `RM ${formatNumber(REP_OPENING_ALLOCATION[side])}`],
                [t(lang, "GERAN SETIAP SUKU TAHUN", "GRANT EVERY QUARTER"), `RM ${formatNumber(REP_QUARTER_GRANT[side])}`],
                [t(lang, "MATLAMAT", "OBJECTIVE"), t(lang, "Pertahankan kerusi", "Hold the seat")],
              ].map(([label, value]) => (
                <div key={label} className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.2)", background: "rgb(var(--bg-rgb) / 0.6)" }}>
                  <div className="text-[9px] tracking-widest text-text-muted">{label}</div>
                  <div className="mt-1 text-[14px] font-black" style={{ color: "var(--gold)" }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* Certificate */}
          <TacticalPanel title={t(lang, "elected_page.certificateOfVictory")}>
            <div className="flex flex-col items-center text-center py-2">
              <div
                className="relative overflow-hidden rounded-full mb-3"
                style={{ width: "104px", height: "104px", border: "2px solid var(--gold)", boxShadow: "0 0 20px rgb(var(--gold-rgb) / 0.35)" }}
              >
                <Image src={avatarSrc} alt="" fill sizes="104px" style={{ objectFit: "cover" }} />
              </div>
              <div className="text-lg font-black text-white tracking-widest">{leader.name}</div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--gold)" }}>{leader.position} · {leader.partyAbbr}</div>

              <div className="w-full mt-5 pt-4 space-y-2" style={{ borderTop: "1px solid rgb(var(--gold-rgb) / 0.2)" }}>
                <div className="text-[11px] text-text-muted tracking-widest">{t(lang, "elected_page.constituency", { seatKind: seatKind })}</div>
                <div className="text-xl font-black" style={{ color: "var(--cyan)" }}>{ownSeat.constituency.name}</div>
                <div className="text-[11px] text-text-muted">{ownSeat.constituency.code} · {homeState?.name}</div>
              </div>

              <div className="w-full mt-4 grid grid-cols-2 gap-2">
                <div className="px-2 py-2" style={{ border: "1px solid rgb(var(--neon-green-rgb,21 128 61) / 0.3)", background: "rgb(var(--neon-green-rgb,21 128 61) / 0.06)" }}>
                  <div className="text-[9px] text-text-muted tracking-wider">{t(lang, "elected_page.majority")}</div>
                  <div className="text-[15px] font-bold" style={{ color: "var(--neon-green)" }}>{formatNumber(ownSeat.majorityVotes)}</div>
                  <div className="text-[10px]" style={{ color: "var(--neon-green)" }}>{formatPercent(ownSeat.majorityPct)} pts</div>
                </div>
                <div className="px-2 py-2" style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.3)", background: "rgb(var(--cyan-rgb) / 0.06)" }}>
                  <div className="text-[9px] text-text-muted tracking-wider">{t(lang, "elected_page.turnout")}</div>
                  <div className="text-[15px] font-bold" style={{ color: "var(--cyan)" }}>{formatPercent(ownSeat.turnoutPct)}</div>
                  <div className="text-[10px] text-text-muted">{t(lang, "elected_page.votes", { formatNumberOwnSeatVotesCast: formatNumber(ownSeat.votesCast) })}</div>
                </div>
              </div>
            </div>
          </TacticalPanel>

          {/* Vote breakdown + state seat grid */}
          <div className="flex flex-col gap-4">
            <TacticalPanel title={t(lang, "elected_page.voteBreakdown", { ownSeatConstituencyName: ownSeat.constituency.name.toUpperCase() })}>
              <div className="space-y-3 mt-1">
                {[
                  { label: partyDisplay, votes: ownSeat.mandatVotes, pct: ownSeat.constituency.mandat, color: leader.partyColor },
                  { label: t(lang, "elected_page.opposition"), votes: ownSeat.lawanVotes, pct: ownSeat.constituency.lawan, color: "var(--warn-orange)" },
                  { label: t(lang, "elected_page.others"), votes: ownSeat.othersVotes, pct: ownSeat.constituency.others, color: "var(--text-muted)" },
                ].map(({ label, votes, pct, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span style={{ color }}>{label}</span>
                      <span className="font-bold" style={{ color }}>{formatNumber(votes)} · {formatPercent(pct)}</span>
                    </div>
                    <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                      <div className="h-2" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-text-muted tracking-wider">
                {t(lang, "elected_page.registeredVotersSeat", { formatNumberOwnSeatRegisteredVoters: formatNumber(ownSeat.registeredVoters), ownSeatConstituencySafety: ownSeat.constituency.safety.toUpperCase() })}
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "elected_page.seatGrid", { homeStateName: homeState?.name.toUpperCase(), stateSeatDetailsLength: stateSeatDetails.length, seatKind: seatKind })}>
              <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(30px,1fr))] gap-1.5">
                {stateSeatDetails.map((seat) => {
                  const isOwn = seat.constituency.id === leader.homeConstituencyId;
                  const color = winnerColor(seat.constituency.winner, leader.partyColor);
                  return (
                    <div
                      key={seat.constituency.id}
                      title={`${seat.constituency.name} — ${seat.result}`}
                      className="relative aspect-square flex items-center justify-center"
                      style={{
                        // color-mix keeps this valid for CSS-variable party colours too
                        // (`var(--cyan)22` is not a colour).
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        border: isOwn ? "2px solid var(--gold)" : `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                        boxShadow: isOwn ? "0 0 10px rgb(var(--gold-rgb) / 0.5)" : "none",
                      }}
                    >
                      {isOwn && <span className="text-[10px]" style={{ color: "var(--gold)" }}>★</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-text-muted">
                <span><span style={{ color: leader.partyColor }}>■</span> {partyDisplay}</span>
                <span><span style={{ color: "var(--warn-orange)" }}>■</span> {t(lang, "elected_page.opposition")}</span>
                <span><span style={{ color: "var(--text-muted)" }}>■</span> {t(lang, "elected_page.others")}</span>
                <span><span style={{ color: "var(--gold)" }}>★</span> {t(lang, "elected_page.yourSeat")}</span>
              </div>
            </TacticalPanel>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={() => navigate("/kawasan")}
            disabled={isPending}
            className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: "rgb(var(--cyan-rgb) / 0.10)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.48)",
              color: "var(--cyan)",
              fontFamily: "Space Mono, monospace",
              boxShadow: "0 0 18px rgb(var(--cyan-rgb) / 0.14)",
            }}
          >
            {isPending ? t(lang, "elected_page.loading") : side ? t(lang, "MULA BERKHIDMAT DI KAWASAN →", "START SERVING THE KAWASAN →") : t(lang, "elected_page.developConstituency")}
          </button>
          {!side && <button
            onClick={() => navigate("/mandate")}
            disabled={isPending}
            className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: "rgb(var(--gold-rgb) / 0.13)",
              border: "1px solid rgb(var(--gold-rgb) / 0.55)",
              color: "var(--gold)",
              fontFamily: "Space Mono, monospace",
              boxShadow: "0 0 18px rgb(var(--gold-rgb) / 0.16)",
            }}
          >
            {isPending ? t(lang, "elected_page.loading") : t(lang, "elected_page.continueConfirmMandate")}
          </button>}
        </div>
      </main>

      <StatusBar leftText={`${officeTitle} · ${ownSeat.constituency.name}`} rightText={t(lang, "elected_page.majority2", { partyDisplay: partyDisplay, formatNumberOwnSeatMajorityVotes: formatNumber(ownSeat.majorityVotes) })} />
    </div>
  );
}
