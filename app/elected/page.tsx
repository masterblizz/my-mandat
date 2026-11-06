"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import { useGameStore } from "../store/gameStore";
import { formatNumber, formatPercent } from "../utils/format";
import { computeSeatDetails } from "../utils/seatDetails";
import { usePendingNav } from "../hooks/usePendingNav";
import { useLang, t } from "../i18n/useLang";
import { REP_OPENING_ALLOCATION, REP_QUARTER_GRANT, repSide } from "../store/representative";
import { TERM_QUARTERS } from "../data/ybService";
import Fold from "../components/results/Fold";
import { playerPortraitSrc } from "../lib/playerAvatar";


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
  // Only the player's own seat: another seat the party won is not "your"
  // win, so a lost own seat falls through to the lost-seat state below.
  const ownSeat = stateSeatDetails.find((seat) => seat.constituency.id === leader.homeConstituencyId);
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
          {ownSeat ? (
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[18px] font-black tracking-widest" style={{ color: "var(--warn-orange)" }}>
                {t(lang, `${ownSeat.constituency.code} ${ownSeat.constituency.name} TEWAS`, `${ownSeat.constituency.code} ${ownSeat.constituency.name} LOST`)}
              </div>
              <div className="text-[12px] tracking-wider text-text-muted">
                {t(lang, `Anda tidak memenangi kerusi sendiri di ${homeState?.name ?? ""}. Parti masih boleh membentuk atau menentang kerajaan.`, `You did not win your own seat in ${homeState?.name ?? ""}. The party can still form or oppose the government.`)}
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-text-muted tracking-widest uppercase">{t(lang, "elected_page.noPersonalSeatResultToDisplay")}</div>
          )}
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

  const avatarSrc = playerPortraitSrc(leader.avatarIndex);
  const seatsWonInState = stateSeatDetails.filter((seat) => seat.result === "WIN").length;
  const btnBase = "min-h-[44px] rounded-full px-6 py-3 text-[12px] font-black tracking-widest uppercase transition-all active:scale-[.97] hover:opacity-90 disabled:opacity-50 disabled:cursor-wait";

  // Three headline numbers. On the representative career the money is what
  // the player spends next; otherwise show the margin of the win itself.
  const stats: { icon: string; value: string; sub: string; color: string }[] = side
    ? [
        { icon: "🗳️", value: `+${formatNumber(ownSeat.majorityVotes)}`, sub: t(lang, "MAJORITI", "MAJORITY"), color: "var(--neon-green)" },
        { icon: "💰", value: `RM ${formatNumber(REP_OPENING_ALLOCATION[side])}`, sub: t(lang, "PERUNTUKAN", "ALLOCATION"), color: "var(--gold)" },
        { icon: "⏳", value: `${TERM_QUARTERS} ${t(lang, "SUKU", "QTRS")}`, sub: `+RM ${formatNumber(REP_QUARTER_GRANT[side])} / ${t(lang, "SUKU", "QTR")}`, color: "var(--cyan)" },
      ]
    : [
        { icon: "🗳️", value: `+${formatNumber(ownSeat.majorityVotes)}`, sub: t(lang, "MAJORITI", "MAJORITY"), color: "var(--neon-green)" },
        { icon: "👥", value: formatPercent(ownSeat.turnoutPct), sub: t(lang, "KELUAR MENGUNDI", "TURNOUT"), color: "var(--cyan)" },
        { icon: "🏛️", value: `${seatsWonInState}/${stateSeatDetails.length}`, sub: `${seatKind} · ${homeState?.name ?? ""}`, color: "var(--gold)" },
      ];

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg)", fontFamily: "Space Mono, monospace" }}>
      {/* the player's 3D city behind the result: same daylight, hills and
          skyline as the kawasan they are about to enter */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <Image src="/elected-city-bg.webp" alt="" fill priority sizes="100vw" style={{ objectFit: "cover", objectPosition: "center 62%" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(6 14 26 / .55) 0%, rgb(6 14 26 / .15) 30%, rgb(6 14 26 / .05) 55%, rgb(6 14 26 / .55) 100%)" }} />
      </div>
      <Header />
      <main
        className="relative w-full px-4 pb-[60px] pt-[52px] sm:px-8"
        style={{
          opacity: reveal ? 1 : 0,
          transform: reveal ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <div className="mx-auto w-full max-w-[760px]">
        {/* Hero: portrait + the result in one glance */}
        <section className="mt-2 flex items-center gap-4 rounded-2xl p-3 sm:gap-6 sm:p-4" style={{ background: "rgb(var(--bg-rgb) / 0.72)", border: "1px solid rgb(var(--cyan-rgb) / 0.35)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "0 12px 40px rgb(0 0 0 / 0.35)" }}>
          <div
            className="relative shrink-0 overflow-hidden rounded-full"
            style={{ width: "92px", height: "92px", border: "2px solid var(--gold)", boxShadow: "0 0 26px rgb(var(--gold-rgb) / 0.45)" }}
          >
            <Image src={avatarSrc} alt="" fill sizes="92px" style={{ objectFit: "cover" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black tracking-widest">
              <span className="rounded-full border px-2.5 py-1" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.5)", color: "var(--cyan)" }}>{isPrn ? "PRN" : "PRU"} · {ownSeat.constituency.code}</span>
              {side && (
                <span className="rounded-full border px-2.5 py-1" style={{ borderColor: side === "government" ? "rgb(var(--cyan-rgb) / 0.6)" : "rgb(255 176 0 / 0.6)", color: side === "government" ? "var(--cyan)" : "var(--warn-orange)" }}>
                  {side === "government" ? `🏛️ ${t(lang, "KERAJAAN", "GOVERNMENT")}` : `⚖️ ${t(lang, "PEMBANGKANG", "OPPOSITION")}`}
                </span>
              )}
              {side && <span className="rounded-full border px-2.5 py-1 text-gold" style={{ borderColor: "rgb(var(--gold-rgb) / 0.45)" }}>{t(lang, `PENGGAL ${careerProgress.term}`, `TERM ${careerProgress.term}`)}</span>}
            </div>
            <h1 className="mt-1.5 text-[26px] font-black leading-tight tracking-widest sm:text-[34px]" style={{ color: "var(--gold)", textShadow: "0 0 22px rgb(var(--gold-rgb) / 0.35)" }}>
              🏆 {t(lang, `ANDA ${officeTitle}!`, `YOU'RE ${officeTitle}!`)}
            </h1>
            <div className="truncate text-[15px] font-black tracking-wider sm:text-lg" style={{ color: "var(--cyan)" }}>
              {ownSeat.constituency.name} <span className="text-[11px] font-bold text-text-muted">· {homeState?.name}</span>
            </div>
          </div>
        </section>

        {/* Three icon stats */}
        <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map((stat) => (
            <div key={stat.icon} className="flex flex-col items-center rounded-2xl border px-2 py-2.5 text-center" style={{ borderColor: `color-mix(in srgb, ${stat.color} 45%, transparent)`, background: `linear-gradient(160deg, color-mix(in srgb, ${stat.color} 14%, rgb(var(--bg-rgb) / .78)), rgb(var(--bg-rgb) / .78))`, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "0 10px 30px rgb(0 0 0 / .3)" }}>
              <div className="text-[18px] leading-none" aria-hidden>{stat.icon}</div>
              <div className="mt-1 text-[16px] font-black leading-tight sm:text-[20px]" style={{ color: stat.color }}>{stat.value}</div>
              <div className="mt-0.5 max-w-full truncate text-[9px] font-bold tracking-widest text-text-muted">{stat.sub}</div>
            </div>
          ))}
        </section>

        {/* Actions: one primary, kept above the fold */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {side ? (
            <button
              onClick={() => navigate("/kawasan")}
              disabled={isPending}
              className={`${btnBase} min-w-[220px]`}
              style={{ background: "var(--gold)", color: "#05080e", boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.35)" }}
            >
              {isPending ? t(lang, "elected_page.loading") : t(lang, "MASUK KAWASAN →", "ENTER KAWASAN →")}
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/kawasan")}
                disabled={isPending}
                className={btnBase}
                style={{ background: "rgb(var(--cyan-rgb) / 0.08)", border: "1px solid rgb(var(--cyan-rgb) / 0.45)", color: "var(--cyan)" }}
              >
                {isPending ? t(lang, "elected_page.loading") : `🏘 ${t(lang, "KAWASAN", "KAWASAN")}`}
              </button>
              <button
                onClick={() => navigate("/mandate")}
                disabled={isPending}
                className={`${btnBase} min-w-[220px]`}
                style={{ background: "var(--gold)", color: "#05080e", boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.35)" }}
              >
                {isPending ? t(lang, "elected_page.loading") : t(lang, "SAHKAN MANDAT →", "CONFIRM MANDATE →")}
              </button>
            </>
          )}
        </div>

        {/* Optional detail: the full count in the player's seat */}
        <Fold className="mt-5 rounded-2xl border" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.3)", background: "rgb(var(--bg-rgb) / 0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }} summaryClassName="px-3 py-2.5 text-text-muted" summary={<>ⓘ {t(lang, "BUTIRAN UNDI", "VOTE DETAILS")}</>}>
          <div className="px-3 pb-3">
            <div className="space-y-2.5">
              {[
                { label: partyDisplay, votes: ownSeat.mandatVotes, pct: ownSeat.constituency.mandat, color: leader.partyColor },
                { label: t(lang, "elected_page.opposition"), votes: ownSeat.lawanVotes, pct: ownSeat.constituency.lawan, color: "var(--warn-orange)" },
                { label: t(lang, "elected_page.others"), votes: ownSeat.othersVotes, pct: ownSeat.constituency.others, color: "var(--text-muted)" },
              ].map(({ label, votes, pct, color }) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span style={{ color }}>{label}</span>
                    <span className="font-bold" style={{ color }}>{formatNumber(votes)} · {formatPercent(pct)}</span>
                  </div>
                  <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                    <div className="h-2" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10px] text-text-muted">
                <span>👥 {formatNumber(ownSeat.votesCast)} / {formatNumber(ownSeat.registeredVoters)}</span>
                <span>📊 {formatPercent(ownSeat.majorityPct)} {t(lang, "mata", "pts")}</span>
                <span>🛡 {ownSeat.constituency.safety.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </Fold>
        </div>
      </main>

      <StatusBar leftText={`${officeTitle} · ${ownSeat.constituency.name}`} rightText={t(lang, "elected_page.majority2", { partyDisplay: partyDisplay, formatNumberOwnSeatMajorityVotes: formatNumber(ownSeat.majorityVotes) })} />
    </div>
  );
}
