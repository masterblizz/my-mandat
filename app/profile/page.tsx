"use client";

// Profil YB: who you are in the game right now. The account side (rank,
// XP, plan access, play time) and the career side as it is played today:
// the seat you hold (real census figures), where you are in the term, and
// your service record (complaints, facilities, trust, organisation,
// budget). Navy city look, like the main menu and the kawasan HUD.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { usePremiumStatus } from "../hooks/usePremiumStatus";
import { createClient } from "../utils/supabase/client";
import { formatPlaytime, getPlayerRank, getRankPerks, playerXp } from "../lib/playerRank";
import { playerPortraitSrc } from "../lib/playerAvatar";
import { generateConstituencies } from "../data/constituencies";
import { TERM_QUARTERS, WEEK_SLOTS, termCalendar } from "../data/ybService";
import { formatNumber } from "../utils/format";
import { useLang, t } from "../i18n/useLang";

// a colour at some opacity; rank colours can be CSS variables, not hex
const fade = (c: string, a: number) => (c.startsWith("#") && c.length === 7 ? `${c}${Math.round(a * 255).toString(16).padStart(2, "0")}` : `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`);

const panel = { background: "rgb(14 26 48 / .82)", border: "1px solid rgb(140 190 255 / .28)", backdropFilter: "blur(12px)" } as const;

function Meter({ icon, label, value, max = 100, color, suffix = "" }: { icon: string; label: string; value: number; max?: number; color: string; suffix?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]"><span className="text-white/80"><span aria-hidden>{icon}</span> {label}</span><b style={{ color }}>{formatNumber(Math.round(value))}{suffix}</b></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: "rgb(255 255 255 / .1)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

function Tile({ icon, label, value, color = "#fff" }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgb(255 255 255 / .05)", border: "1px solid rgb(255 255 255 / .08)" }}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55"><span aria-hidden>{icon}</span> {label}</div>
      <div className="mt-0.5 truncate text-[17px] font-black" style={{ color }}>{value}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={panel}>
      <h2 className="mb-3 text-[12px] font-black uppercase tracking-[.18em]" style={{ color: "#ffcc29" }}><span aria-hidden>{icon}</span> {title}</h2>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const lang = useLang();
  const router = useRouter();
  const { leader, day, careerProgress, journey, settings, states } = useGameStore();
  const { hasPremium, hasUltimate, isLoading } = usePremiumStatus();
  const [operator, setOperator] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
        if (active) setOperator(data?.username || user.user_metadata?.username || user.email?.split("@")[0] || null);
      } catch { /* the local game profile stays useful offline */ }
    })();
    return () => { active = false; };
  }, []);

  const xp = useMemo(() => playerXp({ playedMinutes: careerProgress.playedMinutes, day, term: careerProgress.term, completed: careerProgress.completed, journalEntries: journey.journal.length }), [careerProgress, day, journey.journal.length]);
  const { rank, next, progress } = getPlayerRank(xp);
  const perks = getRankPerks(xp);
  const planName = hasUltimate ? "ULTIMATE" : hasPremium ? "PREMIUM" : "FREE";
  const planColor = hasUltimate ? "#a78bfa" : hasPremium ? "#ffcc29" : "#5ad1ff";

  // the seat you hold, with its real (census) figures
  const scope = settings.electionScope === "prn" ? "dun" : "parliament";
  const homeState = states.find((s) => s.id === leader.homeState);
  const seat = useMemo(() => (homeState ? generateConstituencies(homeState, scope).find((c) => c.id === leader.homeConstituencyId) : undefined), [homeState, scope, leader.homeConstituencyId]);
  const inTerm = !!journey.rank && (journey.chapter === "government" || journey.chapter === "opposition");
  const cal = termCalendar(journey.termDay);
  const zones = journey.cityZones[leader.homeConstituencyId] ?? [];
  const facilities = zones.reduce((n, z) => n + z.projects.length, 0) + journey.construction.filter((w) => w.seat === leader.homeConstituencyId).length;
  const sentiment = zones.length ? Math.round(zones.reduce((n, z) => n + z.sentiment, 0) / zones.length) : null;
  const svc = journey.service;
  const side = journey.chapter === "opposition" ? t(lang, "Pembangkang", "Opposition") : t(lang, "Kerajaan", "Government");
  const office = scope === "dun" ? t(lang, "ADUN", "State assembly member") : t(lang, "Ahli Parlimen", "Member of Parliament");

  return (
    <main className="navy-ui relative min-h-screen overflow-x-hidden pb-16 text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div aria-hidden className="navy-ui__backdrop pointer-events-none fixed inset-0">
        <Image src="/elected-city-bg.webp" alt="" fill priority sizes="100vw" style={{ objectFit: "cover", objectPosition: "center 60%" }} />
      </div>
      <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(inTerm ? "/kawasan" : "/menu")} className="rounded-full px-4 py-2 text-[12px] font-black tracking-wider" style={panel}>
            ← {inTerm ? t(lang, "Kembali ke kawasan", "Back to kawasan") : t(lang, "Menu utama", "Main menu")}
          </button>
          <div className="text-[12px] font-black tracking-[.2em] text-white/70">{t(lang, "PROFIL", "PROFILE")}</div>
        </div>

        {/* who you are */}
        <section className="mb-4 rounded-2xl p-4 sm:p-5" style={{ ...panel, borderColor: fade(rank.color, 0.55) }}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ border: `2px solid ${leader.partyColor}` }}>
              <Image src={playerPortraitSrc(leader.avatarIndex)} alt={leader.name} fill sizes="80px" className="object-cover" />
            </div>
            <div className="min-w-[180px] flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">{operator ?? t(lang, "Pemain", "Player")}</div>
              <h1 className="break-words text-[22px] font-black leading-tight sm:text-[24px]">{inTerm ? "YB " : ""}{leader.name}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-black tracking-widest">
                <span className="rounded-full px-2.5 py-0.5" style={{ border: `1px solid ${rank.color}`, color: rank.color }}>{t(lang, rank.titleMs, rank.titleEn).toUpperCase()}</span>
                <span className="rounded-full px-2.5 py-0.5" style={{ border: `1px solid ${leader.partyColor}`, color: "#fff", background: fade(leader.partyColor, 0.2) }}>{leader.partyAbbr}</span>
                <span className="rounded-full px-2.5 py-0.5" style={{ border: `1px solid ${planColor}`, color: planColor }}>⭐ {isLoading ? t(lang, "MENYEMAK", "CHECKING") : planName}</span>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-center sm:w-auto">
              <div className="rounded-xl px-3 py-2" style={{ background: "rgb(255 255 255 / .05)" }}><div className="text-[10px] uppercase tracking-wider text-white/55">⏱ {t(lang, "Masa main", "Played")}</div><b className="text-[15px] text-[#5ad1ff]">{formatPlaytime(careerProgress.playedMinutes ?? 0)}</b></div>
              <div className="rounded-xl px-3 py-2" style={{ background: "rgb(255 255 255 / .05)" }}><div className="text-[10px] uppercase tracking-wider text-white/55">🏛 {t(lang, "Penggal", "Term")}</div><b className="text-[15px] text-[#ffcc29]">{careerProgress.term}</b></div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px]"><span className="font-black" style={{ color: rank.color }}>⚡ {xp} XP</span><span className="text-white/60">{next ? `→ ${t(lang, next.titleMs, next.titleEn)} · ${next.minXp - xp} XP` : t(lang, "Rank tertinggi", "Top rank")}</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgb(255 255 255 / .1)" }}><div className="h-full rounded-full" style={{ width: `${progress}%`, background: rank.color }} /></div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {/* the seat */}
          <Section icon="📍" title={t(lang, "Kawasan anda", "Your kawasan")}>
            {seat ? (
              <>
                <div className="mb-3"><div className="text-[20px] font-black leading-tight">{seat.code} {seat.name}</div><div className="text-[12px] text-white/65">{homeState?.name} · {inTerm ? `${office} · ${side}` : t(lang, "Calon", "Candidate")}</div></div>
                <div className="grid grid-cols-2 gap-2">
                  <Tile icon="👥" label={t(lang, "Penduduk", "Residents")} value={formatNumber(seat.population)} />
                  <Tile icon="🗳" label={t(lang, "Pengundi", "Voters")} value={formatNumber(seat.voters)} />
                  <Tile icon="🏠" label={t(lang, "Isi rumah", "Households")} value={seat.households ? formatNumber(seat.households) : "—"} />
                  <Tile icon="🗺" label={t(lang, "Keluasan", "Area")} value={`${formatNumber(Math.round(seat.areaKm2))} km²`} />
                </div>
                {seat.households && <p className="mt-2 text-[10px] text-white/45">{t(lang, "Banci 2020, DOSM (data terbuka)", "2020 census, DOSM (open data)")}</p>}
              </>
            ) : <p className="text-[12px] text-white/60">{t(lang, "Tiada kawasan lagi — mulakan permainan baru.", "No kawasan yet — start a new game.")}</p>}
          </Section>

          {/* the term */}
          <Section icon="📅" title={t(lang, "Penggal semasa", "Current term")}>
            {inTerm ? (
              <>
                <div className="mb-3 flex items-baseline justify-between"><div className="text-[20px] font-black">{t(lang, `Suku ${cal.quarter}`, `Quarter ${cal.quarter}`)}<span className="text-[13px] text-white/55"> / {TERM_QUARTERS}</span></div><div className="text-[12px] text-white/65">{t(lang, `Hari ${cal.day} · Minggu ${cal.week}`, `Day ${cal.day} · Week ${cal.week}`)}</div></div>
                <div className="mb-3 h-2 overflow-hidden rounded-full" style={{ background: "rgb(255 255 255 / .1)" }}><div className="h-full rounded-full" style={{ width: `${(cal.quarter / TERM_QUARTERS) * 100}%`, background: "#ffcc29" }} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <Tile icon="💰" label={t(lang, "Bajet awam", "Public budget")} value={`RM ${formatNumber(journey.publicBudget)}`} color="#ffcc29" />
                  <Tile icon="😊" label={t(lang, "Sentimen", "Sentiment")} value={sentiment === null ? "—" : `${sentiment}%`} />
                  <Tile icon="❗" label={t(lang, "Aduan terbuka", "Open complaints")} value={formatNumber(svc.issues.length)} color={svc.issues.length ? "#ff9f43" : "#fff"} />
                  <Tile icon="📋" label={t(lang, "Slot minggu ini", "Slots this week")} value={`${svc.slots}/${WEEK_SLOTS} · ⚡${Math.round(svc.stamina)}`} />
                </div>
              </>
            ) : <p className="text-[12px] text-white/60">{t(lang, "Penggal bermula selepas anda dipilih sebagai wakil rakyat.", "The term starts once you are elected.")}</p>}
          </Section>

          {/* service record */}
          <Section icon="🗂" title={t(lang, "Rekod khidmat", "Service record")}>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Tile icon="✅" label={t(lang, "Aduan selesai", "Resolved")} value={formatNumber(svc.resolved)} color="#3ddc84" />
              <Tile icon="⌛" label={t(lang, "Terlepas", "Missed")} value={formatNumber(svc.missed)} color={svc.missed ? "#ff6b6b" : "#fff"} />
              <Tile icon="🏗" label={t(lang, "Kemudahan", "Facilities")} value={formatNumber(facilities)} />
            </div>
            <div className="space-y-2.5">
              <Meter icon="🤝" label={t(lang, "Kepercayaan", "Trust")} value={journey.trust} color="#a78bfa" />
              <Meter icon="🏗" label={t(lang, "Jentera", "Organisation")} value={journey.organisation} color="#3ddc84" />
              <Meter icon="📍" label={t(lang, "Kehadiran di kawasan", "Presence in the seat")} value={svc.presence} color="#5ad1ff" />
            </div>
          </Section>

          {/* account */}
          <Section icon="🔑" title={t(lang, "Akaun & akses", "Account & access")}>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-black tracking-wider">
              <span className="rounded-full px-3 py-1" style={{ border: "1px solid rgb(61 220 132 / .5)", color: "#3ddc84" }}>✓ PRU · MALAYSIA</span>
              <span className="rounded-full px-3 py-1" style={{ border: `1px solid ${hasPremium ? "rgb(61 220 132 / .5)" : "rgb(255 255 255 / .18)"}`, color: hasPremium ? "#3ddc84" : "rgb(255 255 255 / .55)" }}>{hasPremium ? "✓" : "🔒"} PRN</span>
              <span className="rounded-full px-3 py-1" style={{ border: `1px solid ${hasUltimate ? "rgb(167 139 250 / .6)" : "rgb(255 255 255 / .18)"}`, color: hasUltimate ? "#a78bfa" : "rgb(255 255 255 / .55)" }}>{hasUltimate ? "✓" : "🔒"} {t(lang, "ARKIB SENARIO", "SCENARIO ARCHIVE")}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/60">{hasPremium
              ? t(lang, "Premium membuka kempen PRN di semua negeri, selain PRU nasional.", "Premium unlocks PRN campaigns in every state, on top of the national PRU.")
              : t(lang, "Akaun percuma bermain PRU nasional. Naik taraf untuk PRN di semua negeri.", "Free accounts play the national PRU. Upgrade for PRN in every state.")}</p>
            <div className="mt-3 text-[11px] font-black uppercase tracking-[.16em] text-white/55">🎖 {t(lang, "Kelebihan rank", "Rank abilities")}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {perks.features.map((f) => (
                <span key={f.labelEn} title={t(lang, f.descriptionMs, f.descriptionEn)} className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ border: `1px solid ${fade(rank.color, 0.4)}`, background: "rgb(255 255 255 / .04)" }}>
                  <span aria-hidden>{f.icon}</span> {t(lang, f.labelMs, f.labelEn)}
                </span>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
