"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import { useGameStore, type ActivityApproach } from "../store/gameStore";
import { useLang, t, type Lang } from "../i18n/useLang";
import { currentLocalTimeIsNight, homeSeatProfile } from "../lib/seatProfile";

type Hotspot = {
  icon: string;
  title: string;
  detail: string;
  className: string;
};

function WeeklyFieldCalendar({
  lang,
  scheduleBuilt,
  visitConfirmed,
}: {
  lang: Lang;
  scheduleBuilt: boolean;
  visitConfirmed: boolean;
}) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  const dateLabel = new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(days[0]);
  const endLabel = new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(days[6]);
  const weekday = new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-GB", {
    weekday: "short",
  });
  const events = [
    {
      day: 1,
      time: "09:30",
      title: t(lang, "Taklimat jentera", "Campaign briefing"),
      location: t(lang, "Pejabat Pandan", "Pandan office"),
      tone: "cyan",
    },
    {
      day: 3,
      time: "11:00",
      title: t(lang, "Sesi dengar penduduk", "Resident listening session"),
      location: "Pandan Jaya",
      tone: "gold",
    },
    {
      day: 5,
      time: "15:30",
      title: t(lang, "Lawatan isu saliran", "Drainage site visit"),
      location: "Taman Muda",
      tone: "red",
    },
  ];
  return (
    <div className="flex min-h-[300px] flex-col bg-[#06101e] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan/20 pb-3">
        <div>
          <div className="text-[9px] font-black tracking-[.2em] text-cyan">
            {t(lang, "KALENDAR LAPANGAN", "FIELD CALENDAR")}
          </div>
          <h3 className="mt-1 text-base font-black text-white">
            {dateLabel} — {endLabel}
          </h3>
        </div>
        <span
          className={`border px-2 py-1 text-[8px] font-black tracking-widest ${scheduleBuilt ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-white/20 text-text-muted"}`}
        >
          {scheduleBuilt
            ? t(lang, "JADUAL AKTIF", "SCHEDULE ACTIVE")
            : t(lang, "DRAF BELUM SIAP", "DRAFT NOT BUILT")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map((date, index) => {
          const eventsForDay = events.filter((event) => event.day === index);
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div
              key={date.toISOString()}
              className={`min-h-28 border p-1.5 ${isToday ? "border-gold/80 bg-gold/10" : "border-cyan/20 bg-[#020814]/70"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[7px] font-black uppercase text-text-muted">
                  {weekday.format(date)}
                </span>
                <b
                  className={`text-[10px] ${isToday ? "text-gold" : "text-white"}`}
                >
                  {date.getDate()}
                </b>
              </div>
              {eventsForDay.map((event) => (
                <div
                  key={event.title}
                  className={`mt-2 border-l-2 pl-1 text-[7px] leading-tight ${scheduleBuilt ? (event.tone === "gold" ? "border-gold text-gold" : event.tone === "red" ? "border-neon-red text-neon-red" : "border-cyan text-cyan") : "border-white/20 text-text-muted"}`}
                >
                  <b className="block">{event.time}</b>
                  <span className="block font-bold">{event.title}</span>
                  <span className="block opacity-75">{event.location}</span>
                  {event.day === 5 && (
                    <span className="mt-1 block text-[6px] font-black uppercase">
                      {visitConfirmed
                        ? t(lang, "✓ disahkan", "✓ confirmed")
                        : t(lang, "menunggu sah", "awaiting approval")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2 border-t border-cyan/20 pt-3 text-[9px] sm:grid-cols-2">
        <div className="text-text-muted">
          {scheduleBuilt
            ? t(
                lang,
                "✓ Jentera dan sesi penduduk telah dimasukkan ke kalendar.",
                "✓ Team briefing and resident session are now on the calendar.",
              )
            : t(
                lang,
                "Tekan SUSUN JADUAL untuk masukkan aktiviti ke kalendar.",
                "Press BUILD SCHEDULE to add activities to the calendar.",
              )}
        </div>
        <div className={visitConfirmed ? "text-gold" : "text-text-muted"}>
          {visitConfirmed
            ? t(
                lang,
                "✓ Lawatan Taman Muda disahkan pada Jumaat, 15:30.",
                "✓ Taman Muda visit confirmed for Friday, 15:30.",
              )
            : t(
                lang,
                "Sahkan lawatan untuk mengunci slot Jumaat, 15:30.",
                "Confirm the visit to lock Friday's 15:30 slot.",
              )}
        </div>
      </div>
    </div>
  );
}

export default function PoliticalOfficePage() {
  const router = useRouter();
  const lang = useLang();
  const {
    leader,
    journey,
    states,
    settings,
    resources,
    day,
    totalDays,
    advanceDay,
    runLocationActivity,
    markOfficeMailRead,
  } = useGameStore();
  const [active, setActive] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [openedMail, setOpenedMail] = useState<number | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [officeFeedback, setOfficeFeedback] = useState<string | null>(null);
  const [officeApproach, setOfficeApproach] = useState<ActivityApproach>("balanced");
  const [isNight, setIsNight] = useState(false);
  const localProfile = homeSeatProfile(states, leader, settings);
  const isRural = localProfile.isRural;
  const officeVisual = isRural
    ? isNight
      ? "/political-office-rural-night.png"
      : "/political-office-rural.png"
    : "/political-office-realistic.png";
  const homeSupport =
    states.find((state) => state.id === leader.homeState)?.mandatSupport ?? 0;
  const objectiveDone = journey.locationObjectives.includes(
    "campaign:home-support-60",
  );
  const objectiveDay = Math.min(10, totalDays);
  const officeCampaignActive =
    journey.chapter === "campaign" && day < totalDays;
  const officeTermActive = ["government", "opposition", "rebuilding"].includes(
    journey.chapter,
  );
  const officeFunds =
    journey.chapter === "government" ? journey.publicBudget : resources.funds;
  const officeLocationActions = journey.actionsToday.filter((entry) =>
    entry.startsWith("location:office:"),
  ).length;
  const officeTitle =
    journey.chapter === "government"
      ? t(lang, "Pejabat Wakil Rakyat", "Representative Office")
      : t(lang, "Pejabat Politik Anda", "Your Political Office");
  const hotspots: Hotspot[] = [
    {
      icon: "🖥️",
      title: t(lang, "Meja Strategi", "Strategy Desk"),
      detail: t(
        lang,
        "Rancang kempen, agih dana dan tetapkan mesej utama untuk minggu ini.",
        "Plan campaign moves, allocate funds and set the week's core message.",
      ),
      className: "left-[36%] top-[51%]",
    },
    {
      icon: "📅",
      title: t(lang, "Jadual Politik", "Political Schedule"),
      detail: t(
        lang,
        "Rancang hari kempen dan lawatan tanpa meninggalkan pejabat.",
        "Plan campaign days and visits without leaving the office.",
      ),
      className: "left-[52%] top-[25%]",
    },
    {
      icon: "📰",
      title: t(lang, "Berita TV", "Live News"),
      detail: t(
        lang,
        "Semak mesej dan respons awam daripada bilik kawalan ini.",
        "Review messaging and public response from this control room.",
      ),
      className: "left-[70%] top-[16%]",
    },
    {
      icon: "🗂️",
      title: t(lang, "Fail Kawasan", "Constituency Files"),
      detail: t(
        lang,
        "Semak isu zon dan rekod penduduk di dalam pejabat.",
        "Review zone issues and resident records inside the office.",
      ),
      className: "left-[12%] top-[32%]",
    },
  ];
  const mails =
    lang === "ms"
      ? [
          {
            from: "Ketua Jentera Pandan",
            subject: "Laporan isu penduduk — tindakan hari ini",
            preview:
              "Tiga kawasan meminta lawatan segera berhubung kos sara hidup dan saliran.",
          },
          {
            from: "Personal Assistant",
            subject: "Jadual politik dikemas kini",
            preview:
              "Mesyuarat jentera dianjak ke 11:30. Saya sudah tandakan jadual di papan pejabat.",
          },
          {
            from: "Pasukan Media",
            subject: "Respons media menunggu kelulusan",
            preview:
              "Draf kenyataan awam tersedia untuk semakan di skrin berita.",
          },
        ]
      : [
          {
            from: "Pandan Campaign Chief",
            subject: "Resident issue report — action today",
            preview:
              "Three local areas request an immediate visit about living costs and drainage.",
          },
          {
            from: "Personal Assistant",
            subject: "Political schedule updated",
            preview:
              "The organiser meeting has moved to 11:30. I marked the schedule on the office board.",
          },
          {
            from: "Media Team",
            subject: "Media response awaiting approval",
            preview:
              "A public statement draft is ready to review on the news screen.",
          },
        ];
  const unreadMailIndices = mails.flatMap((_, index) =>
    journey.readOfficeMail.includes(index) ? [] : [index],
  );
  const unreadMailCount = unreadMailIndices.length;
  const officeActionDone = (action: "prepare" | "commit") => {
    const key = `location:office:${action}`;
    return (
      journey.actionsToday.includes(key) || journey.termActions.includes(key)
    );
  };
  const officeApproaches: { id: ActivityApproach; title: string; detail: string }[] = [
    { id: "community", title: t(lang, "DENGAR PENDUDUK", "LISTEN TO RESIDENTS"), detail: t(lang, "+2 kepercayaan · +0.4 sokongan", "+2 trust · +0.4 support") },
    { id: "balanced", title: t(lang, "SEIMBANG", "BALANCED"), detail: t(lang, "Kesan asas, risiko rendah", "Base effect, low risk") },
    { id: "assertive", title: t(lang, "TEGAS & PANTAS", "DECISIVE"), detail: t(lang, "−1 kepercayaan · +0.7 sokongan", "−1 trust · +0.7 support") },
  ];
  const officeActionReason = (action: "prepare" | "commit") => {
    if (officeActionDone(action)) return t(lang, "Tindakan ini sudah dibuat hari ini. Tamatkan hari untuk membuka tindakan baharu.", "This action is already complete today. End the day to unlock new actions.");
    if (officeCampaignActive && journey.decisions < 1) return t(lang, "Tenaga habis. Tekan TAMAT HARI untuk meneruskan aktiviti esok.", "No energy left. Press END DAY to continue with activities tomorrow.");
    if (officeCampaignActive && resources.funds < (action === "commit" ? 25000 : 10000)) return t(lang, "Dana tidak mencukupi untuk tindakan ini. Pilih aktiviti yang lebih murah atau tamatkan hari.", "Insufficient funds. Choose a lower-cost activity or end the day.");
    if (officeCampaignActive && action === "commit" && resources.manpower < 5) return t(lang, "Jentera tidak mencukupi. Gunakan persediaan atau tamatkan hari.", "Not enough organisers. Prepare first or end the day.");
    if (officeTermActive && journey.termActions.length >= 2) return t(lang, "Had dua tindakan penggal telah digunakan.", "The two-action term limit has been used.");
    return null;
  };
  const runOfficeActivity = (action: "prepare" | "commit", title: string) => {
    const before = useGameStore.getState();
    const beforeJournal = before.journey.journal[0]?.id;
    runLocationActivity("office", action, officeApproach);
    const after = useGameStore.getState();
    const completed = after.journey.journal[0]?.id !== beforeJournal;
    const energySpent = before.journey.decisions - after.journey.decisions;
    const fundsChange = after.resources.funds - before.resources.funds;
    const trustChange = after.journey.trust - before.journey.trust;
    setOfficeFeedback(
      completed
        ? t(
            lang,
            `${action === "prepare" ? "Persediaan selesai" : "Tindakan disahkan"}: −${energySpent} tenaga · Dana ${fundsChange >= 0 ? "+" : "−"}RM${Math.abs(fundsChange).toLocaleString("ms-MY")} · Kepercayaan ${trustChange >= 0 ? "+" : ""}${trustChange}.`,
            `${action === "prepare" ? "Preparation complete" : "Action confirmed"}: −${energySpent} energy · Funds ${fundsChange >= 0 ? "+" : "−"}RM${Math.abs(fundsChange).toLocaleString("en-US")} · Trust ${trustChange >= 0 ? "+" : ""}${trustChange}.`,
          )
        : t(
            lang,
            "Tindakan belum tersedia: tenaga, dana atau had aktiviti hari ini tidak mencukupi. Tamatkan hari untuk pulihkan tenaga.",
            "Action unavailable: check energy, funds or today's activity limit. End the day to restore energy.",
          ),
    );
    setNotice(
      completed
        ? `${title}: ${t(lang, action === "prepare" ? "persediaan memberi kesan kepada kempen anda" : "tindakan direkod dengan kesan sebenar", action === "prepare" ? "preparation now affects your campaign" : "action recorded with real consequences")}`
        : t(
            lang,
            "Tindakan tidak tersedia — semak tenaga, dana atau had aktiviti hari ini.",
            "Action unavailable — check energy, funds or today’s activity limit.",
          ),
    );
  };
  useEffect(() => {
    if (!active) setOfficeFeedback(null);
  }, [active]);
  useEffect(() => {
    const updateTime = () => setIsNight(currentLocalTimeIsNight());
    updateTime();
    const timer = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{ background: "#020814" }}
    >
      <Header />
      <main
        className="relative h-[calc(100vh-30px)] min-h-[650px] pt-[40px]"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        <Image
          src={officeVisual}
          alt={officeTitle}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {isNight && !isRural && (
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[#030818]/35 mix-blend-multiply" />
        )}
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          aria-label={t(
            lang,
            "Buka panduan Personal Assistant",
            "Open Personal Assistant guidance",
          )}
          className="absolute bottom-7 left-[13%] z-[15] h-[min(78vh,820px)] w-[min(37vw,470px)] min-w-[275px] overflow-visible text-left transition-transform hover:scale-[1.015] focus:outline-none"
          title={t(
            lang,
            "Personal Assistant · klik untuk berbincang",
            "Personal Assistant · click to talk",
          )}
        >
          <Image
            src="/personal-assistant-standing.png"
            alt="Personal Assistant standing beside the desk"
            fill
            sizes="(max-width: 768px) 275px, 470px"
            className="origin-bottom scale-[1.18] object-contain object-bottom drop-shadow-[0_20px_22px_rgba(0,0,0,.62)]"
          />
          <span
            className="absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap border px-3 py-2 text-[9px] font-black tracking-widest text-gold shadow-xl"
            style={{
              borderColor: "rgb(var(--gold-rgb) / .65)",
              background: "rgb(2 8 20 / .9)",
            }}
          >
            ✦ PERSONAL ASSISTANT ·{" "}
            {t(lang, "KLIK UNTUK BERBINCANG", "CLICK TO TALK")}
          </span>
        </button>
        {active &&
          (active === hotspots[1].title || active === hotspots[3].title) &&
          (() => {
            const schedule = active === hotspots[1].title;
            const spot = hotspots.find((item) => item.title === active)!;
            const visual = schedule
              ? "/office-political-schedule.png"
              : "/office-constituency-files.png";
            const title = schedule
              ? t(
                  lang,
                  "Jadual lapangan minggu ini",
                  "This week's field schedule",
                )
              : t(
                  lang,
                  "Fail isu kawasan Pandan",
                  "Pandan constituency case files",
                );
            const prepareDone = officeActionDone("prepare");
            const commitDone = officeActionDone("commit");
            const prepareReason = officeActionReason("prepare");
            const commitReason = officeActionReason("commit");
            return (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#020814]/85 p-4 backdrop-blur-sm">
                <section
                  className="w-[min(1080px,100%)] overflow-hidden border shadow-2xl"
                  style={{
                    borderColor: "rgb(var(--cyan-rgb) / .7)",
                    background: "rgb(2 8 20 / .98)",
                  }}
                >
                  <div
                    className="flex items-center justify-between border-b px-5 py-4"
                    style={{ borderColor: "rgb(var(--cyan-rgb) / .25)" }}
                  >
                    <div>
                      <div className="text-[9px] font-black tracking-[.22em] text-cyan">
                        ●{" "}
                        {schedule
                          ? t(lang, "JADUAL POLITIK", "POLITICAL SCHEDULE")
                          : t(lang, "FAIL KAWASAN", "CONSTITUENCY FILES")}
                      </div>
                      <h2 className="mt-1 text-lg font-black text-white">
                        {spot.icon} {title}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActive(null)}
                      className="border px-3 py-2 text-[10px] font-black text-text-muted"
                      style={{ borderColor: "rgb(var(--cyan-rgb) / .32)" }}
                    >
                      × {t(lang, "TUTUP", "CLOSE")}
                    </button>
                  </div>
                  <div className="grid max-h-[72vh] overflow-y-auto lg:grid-cols-[1.35fr_.65fr]">
                    {schedule ? (
                      <WeeklyFieldCalendar
                        lang={lang}
                        scheduleBuilt={prepareDone}
                        visitConfirmed={commitDone}
                      />
                    ) : (
                      <div
                        className="relative min-h-[300px] border-b lg:border-b-0 lg:border-r"
                        style={{ borderColor: "rgb(var(--cyan-rgb) / .22)" }}
                      >
                        <Image
                          src={visual}
                          alt={title}
                          fill
                          sizes="(max-width: 1024px) 100vw, 65vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020814] via-[#020814]/75 to-transparent p-5 pt-20">
                          <h3 className="text-xl font-black text-white">
                            {title}
                          </h3>
                          <p className="mt-2 text-[10px] text-cyan">
                            {t(
                              lang,
                              "Tiga isu penduduk memerlukan keputusan",
                              "Three resident issues need a decision",
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                    <aside className="p-5">
                      <div className="text-[9px] font-black tracking-[.2em] text-gold">
                        {t(lang, "KEPUTUSAN PEJABAT", "OFFICE DECISION")}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
                        {spot.detail}
                      </p>
                      <div className="mt-4 border border-cyan/35 bg-cyan/5 p-2 text-[9px] leading-relaxed text-cyan">
                        {schedule
                          ? t(
                              lang,
                              "Susun jadual untuk masukkan program; sahkan lawatan untuk mengunci slot kalendar.",
                              "Build the schedule to add events; confirm the visit to lock its calendar slot.",
                            )
                          : t(
                              lang,
                              "Pilih satu tindakan. Perubahan akan terus ditunjukkan di sini dan pada meter anda.",
                              "Choose an action. Its result will appear here and update your meters immediately.",
                          )}
                      </div>
                      <div className="mt-3">
                        <b className="text-[9px] tracking-widest text-gold">{t(lang, "PILIH PENDEKATAN", "CHOOSE AN APPROACH")}</b>
                        <div className="mt-2 grid gap-1.5">
                          {officeApproaches.map((approach) => <button key={approach.id} type="button" onClick={() => setOfficeApproach(approach.id)} className={`border p-2 text-left ${officeApproach === approach.id ? "border-cyan bg-cyan/10" : "border-cyan/20 opacity-60"}`}><b className="block text-[8px] text-cyan">{officeApproach === approach.id ? "✓ " : ""}{approach.title}</b><span className="mt-1 block text-[8px] text-text-muted">{approach.detail}</span></button>)}
                        </div>
                      </div>
                      {officeFeedback && (
                        <div
                          role="status"
                          className="mt-3 border border-cyan/60 bg-cyan/10 p-2 text-[10px] font-bold leading-relaxed text-cyan"
                        >
                          ✓ {officeFeedback}
                        </div>
                      )}
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div
                          className="border p-3"
                          style={{ borderColor: "rgb(var(--cyan-rgb) / .3)" }}
                        >
                          <span className="text-[8px] text-text-muted">
                            {t(lang, "TENAGA", "ENERGY")}
                          </span>
                          <b className="mt-1 block text-lg text-gold">
                            {journey.decisions}/3
                          </b>
                        </div>
                        <div
                          className="border p-3"
                          style={{ borderColor: "rgb(var(--cyan-rgb) / .3)" }}
                        >
                          <span className="text-[8px] text-text-muted">
                            {t(lang, "KEPERCAYAAN", "TRUST")}
                          </span>
                          <b className="mt-1 block text-lg text-cyan">
                            {journey.trust}
                          </b>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-2">
                        <button
                          type="button"
                          disabled={Boolean(prepareReason)}
                          onClick={() =>
                            runOfficeActivity("prepare", spot.title)
                          }
                          className="border px-4 py-3 text-[10px] font-black tracking-widest text-cyan disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ borderColor: "rgb(var(--cyan-rgb) / .6)" }}
                        >
                          {prepareReason
                            ? t(lang, "✓ SUDAH DIBUAT", "✓ COMPLETED")
                            : schedule
                              ? t(
                                  lang,
                                  "SUSUN JADUAL · −1 TENAGA",
                                  "BUILD SCHEDULE · −1 ENERGY",
                                )
                              : t(
                                  lang,
                                  "SEMAK FAIL · −1 TENAGA",
                                  "REVIEW FILES · −1 ENERGY",
                                )}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(commitReason)}
                          onClick={() =>
                            runOfficeActivity("commit", spot.title)
                          }
                          className="px-4 py-3 text-[10px] font-black tracking-widest text-[#07111c] disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ background: "var(--gold)" }}
                        >
                          {commitReason
                            ? t(lang, "✓ SUDAH DISAHKAN", "✓ CONFIRMED")
                            : schedule
                              ? t(
                                  lang,
                                  "SAHKAN LAWATAN · −1 TENAGA",
                                  "CONFIRM VISIT · −1 ENERGY",
                                )
                              : t(
                                  lang,
                                  "LULUSKAN TINDAKAN · −1 TENAGA",
                                  "AUTHORIZE ACTION · −1 ENERGY",
                                )}
                        </button>
                        {(prepareReason || commitReason) && <p className="text-[9px] leading-relaxed text-gold">{prepareReason ?? commitReason}</p>}
                      </div>
                    </aside>
                  </div>
                </section>
              </div>
            );
          })()}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,20,.68),transparent_36%,transparent_68%,rgba(2,8,20,.46))]" />
        <div
          className="absolute left-4 top-14 z-10 border px-4 py-3 shadow-2xl"
          style={{
            borderColor: "rgb(var(--cyan-rgb) / .5)",
            background: "rgb(2 8 20 / .86)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="text-[9px] font-black tracking-[.22em] text-cyan">
            🏢 {t(lang, "LOKASI BANDAR · INTERIOR", "CITY LOCATION · INTERIOR")}
          </div>
          <h1 className="mt-1 text-lg font-black tracking-wider text-white">
            {officeTitle}
          </h1>
          <p className="mt-1 text-[9px] text-text-muted">
            {leader.partyAbbr || leader.party} ·{" "}
            {isRural
              ? t(
                  lang,
                  `Pejabat khidmat ${localProfile.seatName} · luar bandar`,
                  `${localProfile.seatName} service office · rural`,
                )
              : t(lang, "Ruang kerja aktif", "Active workspace")}
          </p>
        </div>
        <div
          className="absolute right-40 top-14 z-10 hidden items-center gap-5 border px-4 py-2.5 text-[9px] font-black tracking-widest xl:flex"
          style={{
            borderColor: "rgb(var(--cyan-rgb) / .28)",
            background: "rgb(2 8 20 / .84)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div>
            <span className="block text-text-muted">
              {t(lang, "KEPERCAYAAN", "TRUST")}
            </span>
            <b className="mt-1 block text-sm text-cyan">{journey.trust}</b>
          </div>
          <div className="h-8 w-px bg-cyan/20" />
          <div>
            <span className="block text-text-muted">
              {t(lang, "TENAGA", "ENERGY")}
            </span>
            <b className="mt-1 block text-sm text-gold">
              {journey.decisions}/3
            </b>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/kawasan")}
          className="absolute right-4 top-14 z-10 border px-3 py-2 text-[9px] font-black tracking-widest text-cyan shadow-xl"
          style={{
            borderColor: "rgb(var(--cyan-rgb) / .48)",
            background: "rgb(2 8 20 / .86)",
          }}
        >
          ← {t(lang, "KEMBALI KE BANDAR", "RETURN TO CITY")}
        </button>
        {notice && (
          <div
            role="status"
            className="absolute left-1/2 top-14 z-30 -translate-x-1/2 border px-4 py-2 text-[9px] font-black tracking-widest text-gold shadow-2xl"
            style={{
              borderColor: "rgb(var(--gold-rgb) / .55)",
              background: "rgb(2 8 20 / .94)",
            }}
          >
            {notice}
          </div>
        )}

        {hotspots.map((spot) => (
          <div
            key={spot.title}
            className={`absolute z-[5] flex items-center gap-2 ${spot.className}`}
          >
            <span className="relative flex h-3 w-3">
              <i className="absolute inset-0 animate-ping rounded-full bg-cyan/70" />
              <i className="relative m-auto h-2 w-2 rounded-full bg-cyan ring-2 ring-[#07111c]" />
            </span>
            <button
              type="button"
              onClick={() => setActive(spot.title)}
              className="border px-3 py-2 text-[10px] font-black tracking-wide text-white shadow-xl transition hover:border-gold hover:bg-cyan/15"
              style={{
                borderColor: "rgb(var(--cyan-rgb) / .58)",
                background: "rgb(2 8 20 / .88)",
              }}
            >
              {spot.icon} {spot.title}
            </button>
          </div>
        ))}
        {unreadMailCount > 0 && (
          <button
            type="button"
            onClick={() => {
              const nextUnreadMail = unreadMailIndices[0]!;
              setInboxOpen(true);
              setOpenedMail(nextUnreadMail);
              markOfficeMailRead(nextUnreadMail);
            }}
            className="absolute left-[55%] top-[53%] z-20 flex items-center gap-1.5 border px-2 py-1.5 text-[9px] font-black tracking-widest text-cyan shadow-xl transition hover:scale-105 hover:border-gold"
            style={{
              borderColor: "rgb(var(--cyan-rgb) / .75)",
              background: "rgb(2 8 20 / .94)",
            }}
            title={t(lang, "Buka e-mel baharu", "Open new email")}
          >
            <span className="relative text-base">
              ✉️
              <i className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-neon-red" />
            </span>
            {t(lang, "E-MEL BAHARU", "NEW EMAIL")}{" "}
            <b className="rounded-full bg-neon-red px-1.5 py-0.5 text-[8px] text-white">
              {unreadMailCount}
            </b>
          </button>
        )}

        {assistantOpen && (
          <section
            className="absolute bottom-12 left-4 z-20 w-[min(390px,calc(100%-32px))] border p-3 shadow-2xl"
            style={{
              borderColor: "rgb(var(--gold-rgb) / .54)",
              background: "rgb(2 8 20 / .94)",
              backdropFilter: "blur(14px)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-black tracking-[.2em] text-gold">
                  PEMBANTU PERIBADI
                </div>
                <h2 className="mt-1 text-[13px] font-black text-white">
                  {objectiveDone
                    ? t(
                        lang,
                        "Objektif pertama berjaya dicapai.",
                        "Your first objective is complete.",
                      )
                    : t(
                        lang,
                        "Naikkan sokongan kawasan ke 60% sebelum hari ke-10.",
                        "Raise constituency support to 60% before day 10.",
                      )}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="text-text-muted"
              >
                ×
              </button>
            </div>
            <div
              className="mt-2 border px-2 py-1.5 text-[9px]"
              style={{
                borderColor: "rgb(var(--cyan-rgb) / .35)",
                background: "rgb(var(--cyan-rgb) / .06)",
              }}
            >
              <b className="text-cyan">{homeSupport.toFixed(1)}% / 60%</b>
              <span className="ml-2 text-text-muted">
                {t(
                  lang,
                  `Hari ${day}/${objectiveDay} · ganjaran RM75,000`,
                  `Day ${day}/${objectiveDay} · RM75,000 reward`,
                )}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
              {t(
                lang,
                "Gunakan jadual, media atau meja strategi. Setiap tindakan kini memberi kesan kepada objektif ini.",
                "Use the schedule, media or strategy desk. Every action now contributes to this objective.",
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setActive(hotspots[1].title)}
                className="flex-1 border px-2 py-2 text-[9px] font-black text-cyan"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .55)" }}
              >
                {t(lang, "ATUR LAWATAN", "SCHEDULE VISIT")}
              </button>
              <button
                type="button"
                onClick={() => setActive(hotspots[2].title)}
                className="flex-1 border px-2 py-2 text-[9px] font-black text-cyan"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .55)" }}
              >
                {t(lang, "KENYATAAN MEDIA", "MEDIA STATEMENT")}
              </button>
            </div>
          </section>
        )}

        {active &&
          (() => {
            const spot = hotspots.find((item) => item.title === active)!;
            const isNews = spot.title === hotspots[2].title;
            const isStrategy = spot.title === hotspots[0].title;
            const visual = isNews
              ? "/office-news-drainage.png"
              : isStrategy
                ? "/office-strategy-board.png"
                : "/political-office-realistic.png";
            const headline = isNews
              ? t(
                  lang,
                  "Penduduk Pandan desak tindakan isu saliran",
                  "Pandan residents demand action on drainage",
                )
              : isStrategy
                ? t(
                    lang,
                    "Peta strategi kempen dan sasaran minggu ini",
                    "Campaign strategy map and this week's targets",
                  )
                : spot.detail;
            const prepareReason = officeActionReason("prepare");
            const commitReason = officeActionReason("commit");
            return (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020814]/80 p-4 backdrop-blur-sm">
                <section
                  className="w-[min(1080px,100%)] overflow-hidden border shadow-2xl"
                  style={{
                    borderColor: isNews
                      ? "rgb(var(--neon-red-rgb) / .75)"
                      : "rgb(var(--cyan-rgb) / .7)",
                    background: "rgb(2 8 20 / .98)",
                    boxShadow: "0 0 60px rgb(var(--cyan-rgb) / .2)",
                  }}
                >
                  <div
                    className="flex items-center justify-between border-b px-5 py-4"
                    style={{ borderColor: "rgb(var(--cyan-rgb) / .25)" }}
                  >
                    <div>
                      <div className="text-[9px] font-black tracking-[.22em] text-cyan">
                        {isNews
                          ? "● LIVE TV NEWS"
                          : `● ${t(lang, "STESEN INTERAKTIF PEJABAT", "OFFICE INTERACTION STATION")}`}
                      </div>
                      <h2 className="mt-1 text-lg font-black text-white">
                        {spot.icon} {spot.title}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActive(null)}
                      className="border px-3 py-2 text-[10px] font-black text-text-muted"
                      style={{ borderColor: "rgb(var(--cyan-rgb) / .32)" }}
                    >
                      × {t(lang, "TUTUP", "CLOSE")}
                    </button>
                  </div>
                  <div className="grid max-h-[72vh] overflow-y-auto lg:grid-cols-[1.35fr_.65fr]">
                    <div
                      className="relative min-h-[300px] border-b lg:border-b-0 lg:border-r"
                      style={{ borderColor: "rgb(var(--cyan-rgb) / .22)" }}
                    >
                      <Image
                        src={visual}
                        alt={headline}
                        fill
                        sizes="(max-width: 1024px) 100vw, 65vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020814] via-[#020814]/80 to-transparent p-5 pt-20">
                        <div
                          className="inline-block border px-2 py-1 text-[8px] font-black tracking-widest text-neon-red"
                          style={{
                            borderColor: "rgb(var(--neon-red-rgb) / .55)",
                            background: "rgb(2 8 20 / .82)",
                          }}
                        >
                          {isNews
                            ? t(lang, "LIPUTAN LANGSUNG", "LIVE COVERAGE")
                            : t(lang, "PAPARAN AKTIF", "ACTIVE DISPLAY")}
                        </div>
                        <h3 className="mt-2 max-w-xl text-xl font-black text-white">
                          {headline}
                        </h3>
                      </div>
                    </div>
                    <aside className="p-5">
                      <div className="text-[9px] font-black tracking-[.2em] text-gold">
                        {t(lang, "BILIK KAWALAN", "CONTROL ROOM")}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
                        {isNews
                          ? t(
                              lang,
                              "Laporan lapangan menunjukkan isu saliran dan kos sara hidup sedang menaikkan tekanan awam. Pilih respons anda dari dalam pejabat ini.",
                              "Field reporting shows drainage and cost-of-living concerns are increasing public pressure. Choose your response from inside this office.",
                            )
                          : spot.detail}
                      </p>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div
                          className="border p-3"
                          style={{ borderColor: "rgb(var(--cyan-rgb) / .3)" }}
                        >
                          <div className="text-[8px] text-text-muted">
                            {t(lang, "KEPERCAYAAN", "TRUST")}
                          </div>
                          <b className="mt-1 block text-lg text-cyan">
                            {journey.trust}
                          </b>
                        </div>
                        <div
                          className="border p-3"
                          style={{ borderColor: "rgb(var(--gold-rgb) / .3)" }}
                        >
                          <div className="text-[8px] text-text-muted">
                            {t(lang, "TENAGA", "ENERGY")}
                          </div>
                          <b className="mt-1 block text-lg text-gold">
                            {journey.decisions}/3
                          </b>
                        </div>
                      </div>
                      <p className="mt-4 text-[9px] leading-relaxed text-cyan">
                        {t(
                          lang,
                          "Pilihan ini menggunakan 1 tenaga dan memberi kesan kepada jurnal karier, sumber serta sokongan kawasan.",
                          "This choice uses 1 energy and affects your career journal, resources and constituency support.",
                        )}
                      </p>
                      <div className="mt-3 grid gap-1.5">
                        {officeApproaches.map((approach) => <button key={approach.id} type="button" onClick={() => setOfficeApproach(approach.id)} className={`border p-2 text-left ${officeApproach === approach.id ? "border-cyan bg-cyan/10" : "border-cyan/20 opacity-60"}`}><b className="block text-[8px] text-cyan">{officeApproach === approach.id ? "✓ " : ""}{approach.title}</b><span className="mt-1 block text-[8px] text-text-muted">{approach.detail}</span></button>)}
                      </div>
                      {officeFeedback && <div role="status" className="mt-3 border border-cyan/60 bg-cyan/10 p-2 text-[10px] font-bold leading-relaxed text-cyan">✓ {officeFeedback}</div>}
                      <div className="mt-5 grid gap-2">
                        <button
                          type="button"
                          disabled={Boolean(prepareReason)}
                          onClick={() =>
                            runOfficeActivity("prepare", spot.title)
                          }
                          className="border px-4 py-3 text-[10px] font-black tracking-widest text-cyan disabled:cursor-not-allowed disabled:opacity-45"
                          style={{
                            borderColor: "rgb(var(--cyan-rgb) / .6)",
                            background: "rgb(var(--cyan-rgb) / .08)",
                          }}
                        >
                          {isNews
                            ? t(
                                lang,
                                "SEMAK DRAF RESPONS",
                                "REVIEW RESPONSE DRAFT",
                              )
                            : t(lang, "SEDIAKAN PILIHAN", "PREPARE OPTION")}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(commitReason)}
                          onClick={() =>
                            runOfficeActivity("commit", spot.title)
                          }
                          className="border px-4 py-3 text-[10px] font-black tracking-widest text-[#07111c] disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ background: "var(--gold)" }}
                        >
                          {isNews
                            ? t(lang, "SIARKAN RESPONS", "PUBLISH RESPONSE")
                            : t(
                                lang,
                                "LAKSANAKAN KEPUTUSAN",
                                "EXECUTE DECISION",
                              )}
                        </button>
                        {(prepareReason || commitReason) && <p className="text-[9px] leading-relaxed text-gold">{prepareReason ?? commitReason}</p>}
                      </div>
                    </aside>
                  </div>
                </section>
              </div>
            );
          })()}
        {!active && (
          <section
            className="fixed top-[62%] z-[21] w-[min(360px,calc(100%-32px))] -translate-y-1/2 border p-3 shadow-2xl"
            style={{
              right: "max(20px, calc((100vw - 1480px) / 2 + 20px))",
              borderColor: "rgb(var(--cyan-rgb) / .68)",
              background: "rgb(2 8 20 / .97)",
              backdropFilter: "blur(14px)",
            }}
          >
            <b className="text-[9px] tracking-[.18em] text-cyan">
              {t(lang, "SUMBER & HAD TINDAKAN", "RESOURCES & ACTION LIMITS")}
            </b>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
              <div
                className="border p-2"
                style={{ borderColor: "rgb(var(--gold-rgb) / .35)" }}
              >
                <span className="text-text-muted">
                  {t(lang, "TENAGA", "ENERGY")}
                </span>
                <b className="mt-1 block text-gold">{journey.decisions}/3</b>
              </div>
              <div
                className="border p-2"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .42)" }}
              >
                <span className="text-text-muted">
                  {journey.chapter === "government"
                    ? t(lang, "BAJET", "BUDGET")
                    : t(lang, "DANA", "FUNDS")}
                </span>
                <b className="mt-1 block text-cyan">
                  RM {officeFunds.toLocaleString("ms-MY")}
                </b>
              </div>
              <div
                className="border p-2"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .42)" }}
              >
                <span className="text-text-muted">
                  {t(lang, "JENTERA", "ORGANISERS")}
                </span>
                <b className="mt-1 block text-cyan">{resources.manpower}</b>
              </div>
              <div
                className="border p-2"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .42)" }}
              >
                <span className="text-text-muted">
                  {officeTermActive
                    ? t(lang, "HAD PENGGAL", "TERM LIMIT")
                    : t(lang, "HAD HARI INI", "TODAY'S LIMIT")}
                </span>
                <b className="mt-1 block text-cyan">
                  {officeTermActive
                    ? `${journey.termActions.length}/2`
                    : `${journey.decisions}/3`}
                </b>
                <span className="mt-1 block text-[8px] text-text-muted">
                  {officeTermActive
                    ? t(lang, "tindakan penggal", "term actions")
                    : `${officeLocationActions} ${t(lang, "aktiviti pejabat", "office actions")}`}
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
              <div
                className="border p-2"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .42)" }}
              >
                <b className="text-cyan">{t(lang, "SEDIAKAN", "PREPARE")}</b>
                <span className="mt-1 block text-text-muted">
                  {officeCampaignActive
                    ? `RM 10,000 · 1 ${t(lang, "tenaga", "energy")}`
                    : officeTermActive
                      ? journey.chapter === "government"
                        ? "RM 20,000 · 1 had"
                        : "1 had tindakan"
                      : t(lang, "Tidak tersedia", "Unavailable")}
                </span>
              </div>
              <div
                className="border p-2"
                style={{ borderColor: "rgb(var(--gold-rgb) / .4)" }}
              >
                <b className="text-gold">{t(lang, "LAKSANAKAN", "EXECUTE")}</b>
                <span className="mt-1 block text-text-muted">
                  {officeCampaignActive
                    ? `RM 25,000 · 5 ${t(lang, "jentera", "organisers")} · 1 ${t(lang, "tenaga", "energy")}`
                    : officeTermActive
                      ? journey.chapter === "government"
                        ? "RM 50,000 · 1 had"
                        : "1 had tindakan"
                      : t(lang, "Tidak tersedia", "Unavailable")}
                </span>
              </div>
            </div>
          </section>
        )}
        {inboxOpen && (
          <section
            className="absolute right-4 top-40 z-30 w-[min(320px,calc(100%-32px))] border border-t-2 shadow-2xl"
            style={{
              borderColor: "rgb(var(--cyan-rgb) / .42)",
              borderTopColor: "var(--neon-red)",
              background: "rgb(2 8 20 / .96)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "rgb(var(--cyan-rgb) / .22)" }}
            >
              <div>
                <div className="text-[9px] font-black tracking-[.2em] text-cyan">
                  ✉️ {t(lang, "E-MEL MASUK", "INBOX")}
                </div>
                <h2 className="mt-1 text-sm font-black text-white">
                  {t(lang, "Peti masuk pejabat", "Office inbox")}
                </h2>
              </div>
              <div className="flex gap-2">
                <b className="bg-neon-red px-1.5 py-1 text-[8px] text-white">
                  {unreadMailCount} {t(lang, "BARU", "NEW")}
                </b>
                <button
                  type="button"
                  onClick={() => setInboxOpen(false)}
                  className="text-text-muted"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="max-h-[48vh] overflow-y-auto">
              {mails.map((mail, index) => (
                <button
                  key={mail.subject}
                  type="button"
                  onClick={() => {
                    setOpenedMail(index);
                    markOfficeMailRead(index);
                  }}
                  className="w-full border-b px-4 py-3 text-left transition hover:bg-cyan/10"
                  style={{
                    borderColor: "rgb(var(--cyan-rgb) / .14)",
                    background:
                      openedMail === index
                        ? "rgb(var(--cyan-rgb) / .08)"
                        : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <b className="text-[9px] text-gold">{mail.from}</b>
                    {!journey.readOfficeMail.includes(index) && (
                      <i className="h-2 w-2 rounded-full bg-neon-red" />
                    )}
                  </div>
                  <div className="mt-1 text-[10px] font-black text-white">
                    {mail.subject}
                  </div>
                  {openedMail === index && (
                    <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
                      {mail.preview}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
        <section
          className="absolute bottom-12 right-4 z-20 w-72 border p-3 shadow-2xl"
          style={{
            borderColor: "rgb(var(--cyan-rgb) / .35)",
            background: "rgb(2 8 20 / .92)",
          }}
        >
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[8px] font-black tracking-widest text-text-muted">
                {t(lang, "TENAGA HARI INI", "TODAY'S ENERGY")}
              </div>
              <div className="mt-2 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <i
                    key={i}
                    className="h-2 w-7"
                    style={{
                      background:
                        i < journey.decisions
                          ? "var(--cyan)"
                          : "rgb(255 255 255 / .12)",
                    }}
                  />
                ))}
              </div>
            </div>
            <b className="text-xl text-white">
              {journey.decisions}
              <span className="text-sm text-text-muted">/3</span>
            </b>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/kawasan")}
              className="border px-3 py-2 text-[9px] font-black text-cyan"
              style={{ borderColor: "rgb(var(--cyan-rgb) / .45)" }}
            >
              ← {t(lang, "BANDAR", "CITY")}
            </button>
            <button
              type="button"
              onClick={advanceDay}
              className="flex-1 bg-gold px-3 py-2 text-[9px] font-black tracking-widest text-[#07111c]"
            >
              {t(lang, "TAMAT HARI", "END DAY")} {day}/{totalDays} →
            </button>
          </div>
        </section>
        <footer
          className="absolute bottom-0 left-0 right-0 z-20 flex h-8 items-center overflow-hidden border-t bg-[#07111c]"
          style={{ borderColor: "rgb(var(--cyan-rgb) / .3)" }}
        >
          <b className="flex h-full items-center bg-gold px-3 text-[9px] tracking-widest text-[#07111c]">
            ● {t(lang, "BERITA", "NEWS")}
          </b>
          <div className="whitespace-nowrap px-5 text-[10px] text-text-muted animate-[pulse_5s_ease-in-out_infinite]">
            {t(
              lang,
              "Penduduk Pandan desak tindakan segera isu saliran",
              "Pandan residents demand immediate drainage action",
            )}{" "}
            <span className="mx-5 text-cyan">◆</span>
            {t(
              lang,
              "Tinjauan: sokongan pengundi muda naik 2 mata minggu ini",
              "Poll: youth support rises 2 points this week",
            )}
          </div>
        </footer>
      </main>
      <StatusBar
        leftText={t(
          lang,
          "PEJABAT POLITIK · RUANG KERJA",
          "POLITICAL OFFICE · WORKSPACE",
        )}
        rightText={t(
          lang,
          "Klik perabot atau paparan untuk berinteraksi",
          "Click furniture or displays to interact",
        )}
      />
    </div>
  );
}
