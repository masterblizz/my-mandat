"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import { useGameStore, type ActivityApproach } from "../store/gameStore";
import { useLang, t, type Lang } from "../i18n/useLang";
import { currentLocalTimeIsNight, homeSeatProfile } from "../lib/seatProfile";
import CampaignTimeline from "../components/campaign/CampaignTimeline";

type Hotspot = {
  icon: string;
  title: string;
  detail: string;
  className: string;
};

function MonthlyFieldCalendar({
  lang,
  scheduleBuilt,
  visitConfirmed,
  stateName,
  campaignDay,
  totalDays,
}: {
  lang: Lang;
  scheduleBuilt: boolean;
  visitConfirmed: boolean;
  stateName: string;
  campaignDay: number;
  totalDays: number;
}) {
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - ((monthStart.getDay() + 6) % 7));
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const moveMonth = (delta: number) => {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1);
    setMonthCursor(next);
    setSelectedDate(next);
  };
  const monthLabel = new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-GB", { month: "long", year: "numeric" }).format(monthCursor);
  const weekday = new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-GB", {
    weekday: "narrow",
  });
  const eventDate = (offset: number) => { const date = new Date(today); date.setDate(today.getDate() + offset); return date; };
  const holidayDate = (month: number, date: number) => new Date(2026, month - 1, date);
  const federalHolidays = [
    { date: holidayDate(2, 17), name: t(lang, "Tahun Baharu Cina", "Chinese New Year") },
    { date: holidayDate(2, 18), name: t(lang, "Tahun Baharu Cina (Hari Kedua)", "Chinese New Year (Second Day)") },
    { date: holidayDate(5, 1), name: t(lang, "Hari Pekerja", "Labour Day") },
    { date: holidayDate(5, 27), name: t(lang, "Hari Raya Haji", "Hari Raya Haji") },
    { date: holidayDate(5, 28), name: t(lang, "Hari Raya Haji (Hari Kedua)", "Hari Raya Haji (Second Day)") },
    { date: holidayDate(8, 31), name: t(lang, "Hari Kebangsaan", "National Day") },
    { date: holidayDate(9, 16), name: t(lang, "Hari Malaysia", "Malaysia Day") },
    { date: holidayDate(11, 8), name: t(lang, "Deepavali", "Deepavali") },
    { date: holidayDate(12, 25), name: t(lang, "Hari Krismas", "Christmas Day") },
  ];
  const stateHolidays: Record<string, { date: Date; name: string }[]> = {
    Selangor: [
      { date: holidayDate(2, 1), name: t(lang, "Thaipusam", "Thaipusam") },
      { date: holidayDate(3, 4), name: t(lang, "Nuzul Al-Quran", "Nuzul Al-Quran") },
      { date: holidayDate(10, 25), name: t(lang, "Jubli Perak Sultan Selangor", "Selangor Sultan's Silver Jubilee") },
      { date: holidayDate(10, 26), name: t(lang, "Cuti gantian Jubli Perak Sultan Selangor", "Selangor Sultan's Silver Jubilee replacement holiday") },
      { date: holidayDate(12, 11), name: t(lang, "Hari Keputeraan Sultan Selangor", "Sultan of Selangor's Birthday") },
    ],
  };
  const holidays = [...federalHolidays, ...(stateHolidays[stateName] ?? [])];
  const events = [
    {
      date: eventDate(1),
      time: "09:30",
      title: t(lang, "Taklimat jentera", "Campaign briefing"),
      location: t(lang, "Pejabat Pandan", "Pandan office"),
      tone: "cyan",
    },
    {
      date: eventDate(3),
      time: "11:00",
      title: t(lang, "Sesi dengar penduduk", "Resident listening session"),
      location: "Pandan Jaya",
      tone: "gold",
    },
    {
      date: eventDate(5),
      time: "15:30",
      title: t(lang, "Lawatan isu saliran", "Drainage site visit"),
      location: "Taman Muda",
      tone: "red",
    },
  ];
  // Election milestones are projected onto the player's real field calendar
  // from campaign day one. This turns abstract "Day 15" language into dates
  // the player can plan around alongside their local visits.
  const electionMilestones = [
    { day: 1, title: t(lang, "PRU bermula", "Election starts"), tone: "cyan" },
    { day: 15, title: t(lang, "Penamaan calon", "Nomination day"), tone: "gold" },
    { day: 16, title: t(lang, "Kempen bermula", "Campaign starts"), tone: "green" },
    { day: 29, title: t(lang, "Hari tenang", "Cooling-off day"), tone: "red" },
    { day: 30, title: t(lang, "Hari mengundi", "Polling day"), tone: "red" },
  ].filter((milestone) => milestone.day <= totalDays).map((milestone) => ({ ...milestone, date: eventDate(milestone.day - campaignDay) }));
  const selectedEvents = events.filter((event) => dateKey(event.date) === dateKey(selectedDate));
  const selectedHolidays = holidays.filter((holiday) => dateKey(holiday.date) === dateKey(selectedDate));
  const selectedMilestones = electionMilestones.filter((milestone) => dateKey(milestone.date) === dateKey(selectedDate));
  return (
    <div className="flex min-h-[430px] flex-col bg-[#06101e] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan/20 pb-3">
        <div>
          <div className="text-[9px] font-black tracking-[.2em] text-cyan">{t(lang, "KALENDAR LAPANGAN", "FIELD CALENDAR")}</div>
          <div className="mt-1 flex items-center gap-2"><button type="button" onClick={() => moveMonth(-1)} aria-label={t(lang, "Bulan sebelumnya", "Previous month")} className="border border-cyan/35 px-2 py-1 text-cyan hover:bg-cyan/10">‹</button><h3 className="min-w-40 text-base font-black capitalize text-white">{monthLabel}</h3><button type="button" onClick={() => moveMonth(1)} aria-label={t(lang, "Bulan seterusnya", "Next month")} className="border border-cyan/35 px-2 py-1 text-cyan hover:bg-cyan/10">›</button></div>
        </div>
        <span
          className={`border px-2 py-1 text-[8px] font-black tracking-widest ${scheduleBuilt ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-white/20 text-text-muted"}`}
        >
          {scheduleBuilt
            ? t(lang, "JADUAL AKTIF", "SCHEDULE ACTIVE")
            : t(lang, "DRAF BELUM SIAP", "DRAFT NOT BUILT")}
        </span>
      </div>
      <div className="mt-3">
        <CampaignTimeline day={campaignDay} totalDays={totalDays} lang={lang} compact />
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">{Array.from({ length: 7 }, (_, index) => <span key={index} className="py-1 text-[8px] font-black text-text-muted">{weekday.format(new Date(2026, 8, 28 + index))}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const eventsForDay = events.filter((event) => dateKey(event.date) === dateKey(date));
          const holidaysForDay = holidays.filter((holiday) => dateKey(holiday.date) === dateKey(date));
          const milestonesForDay = electionMilestones.filter((milestone) => dateKey(milestone.date) === dateKey(date));
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = dateKey(date) === dateKey(selectedDate);
          const inMonth = date.getMonth() === monthCursor.getMonth();
          return (
            <button type="button" onClick={() => setSelectedDate(date)}
              key={date.toISOString()}
              className={`min-h-14 border p-1.5 text-left transition hover:border-cyan ${isSelected ? "border-cyan bg-cyan/10" : isToday ? "border-gold/80 bg-gold/10" : "border-cyan/20 bg-[#020814]/70"} ${inMonth ? "" : "opacity-30"}`}
            >
              <b className={`text-[10px] ${isToday ? "text-gold" : "text-white"}`}>{date.getDate()}</b>
              {milestonesForDay.map((milestone) => <span key={milestone.title} className={`mt-1 block truncate border-l-2 pl-1 text-[7px] font-black ${milestone.tone === "gold" ? "border-gold bg-gold/10 text-gold" : milestone.tone === "red" ? "border-neon-red bg-neon-red/10 text-neon-red" : milestone.tone === "green" ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-cyan bg-cyan/10 text-cyan"}`}>◆ {milestone.title}</span>)}
              {holidaysForDay.map((holiday) => <span key={holiday.name} className="mt-1 block truncate border-l-2 border-gold bg-gold/10 pl-1 text-[7px] font-black text-gold">★ {holiday.name}</span>)}
              {eventsForDay.map((event) => (
                <span key={event.title} className={`mt-1 block truncate border-l-2 pl-1 text-[7px] font-bold ${scheduleBuilt ? event.tone === "gold" ? "border-gold text-gold" : event.tone === "red" ? "border-neon-red text-neon-red" : "border-cyan text-cyan" : "border-white/20 text-text-muted"}`}>{event.time} {event.title}</span>
              ))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-t border-cyan/20 pt-3"><div className="text-[8px] font-black tracking-widest text-gold">{t(lang, "AGENDA TARIKH DIPILIH", "SELECTED DATE AGENDA")}</div>{selectedMilestones.map((milestone) => <div key={milestone.title} className="mt-2 border-l-2 bg-cyan/5 p-2 text-[9px] font-black text-cyan" style={{ borderColor: milestone.tone === "gold" ? "var(--gold)" : milestone.tone === "red" ? "var(--neon-red)" : milestone.tone === "green" ? "var(--neon-green)" : "var(--cyan)" }}>◆ {milestone.title} · {t(lang, `Hari pilihan raya ${milestone.day}`, `Election day ${milestone.day}`)}</div>)}{selectedHolidays.map((holiday) => <div key={holiday.name} className="mt-2 border-l-2 border-gold bg-gold/10 p-2 text-[9px] font-black text-gold">★ {holiday.name} · {t(lang, `Cuti umum ${stateName}`, `${stateName} public holiday`)}</div>)}{selectedEvents.length ? selectedEvents.map((event) => <div key={event.title} className="mt-2 flex items-center justify-between border-l-2 border-cyan bg-cyan/5 p-2 text-[9px]"><span><b className="text-cyan">{event.time}</b> <b className="ml-2 text-white">{event.title}</b><span className="ml-2 text-text-muted">· {event.location}</span></span>{event.tone === "red" && <b className={visitConfirmed ? "text-gold" : "text-text-muted"}>{visitConfirmed ? t(lang, "✓ DISAHKAN", "✓ CONFIRMED") : t(lang, "MENUNGGU SAH", "PENDING")}</b>}</div>) : !selectedHolidays.length && !selectedMilestones.length && <p className="mt-2 text-[9px] text-text-muted">{t(lang, "Tiada acara. Pilih tarikh yang bertanda untuk melihat butiran.", "No events. Select a marked date to view details.")}</p>}</div>
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
  const [newsIndex, setNewsIndex] = useState(0);
  const localProfile = homeSeatProfile(states, leader, settings);
  const isRural = localProfile.isRural;
  const officeVisual = isRural
    ? isNight
      ? "/political-office-rural-night.png"
      : "/political-office-rural.png"
    : "/political-office-realistic.png";
  const homeSupport =
    states.find((state) => state.id === leader.homeState)?.mandatSupport ?? 0;
  const calendarStateName = states.find((state) => state.id === leader.homeState)?.name ?? "Malaysia";
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
  const liveNewsTitle = t(lang, "Berita TV", "Live News");
  const newsBulletins = [
    {
      id: "drainage",
      image: "/office-news-drainage.png",
      tone: "var(--neon-red)",
      tag: t(lang, "LIPUTAN LANGSUNG", "LIVE COVERAGE"),
      headline: t(lang, "Penduduk Pandan desak tindakan isu saliran", "Pandan residents demand action on drainage"),
      summary: t(lang, "Hujan dan saliran tersumbat kembali menjadi isu utama di beberapa zon. Respons pantas boleh meredakan tekanan awam.", "Rain and blocked drainage have returned as the lead concern in several zones. A fast response can ease public pressure."),
      source: t(lang, "LAPORAN LAPANGAN · ZON PERUMAHAN", "FIELD REPORT · RESIDENTIAL ZONES"),
    },
    {
      id: "cost",
      image: "/office-news-cost-of-living.png",
      tone: "var(--gold)",
      tag: t(lang, "PULSE RAKYAT", "PUBLIC PULSE"),
      headline: t(lang, "Kos sara hidup jadi tumpuan pengundi bandar", "Cost of living rises on the urban voter agenda"),
      summary: t(lang, "Peniaga kecil dan keluarga komuter mahu pelan yang jelas tentang harga, gaji dan pengangkutan harian.", "Small traders and commuting families want a clear plan for prices, wages and daily transport."),
      source: t(lang, "TINJAUAN PANTAS · BANDAR", "FLASH POLL · URBAN DESK"),
    },
    {
      id: "housing",
      image: "/office-news-housing.png",
      tone: "var(--cyan)",
      tag: t(lang, "LIPUTAN KOMUNITI", "COMMUNITY DESK"),
      headline: t(lang, "Keluarga muda mahu perumahan mampu milik", "Young families press for affordable homes"),
      summary: t(lang, "Liputan komuniti menunjukkan harga rumah dan kemudahan kejiranan semakin mempengaruhi keputusan pengundi muda.", "Community reporting shows home prices and neighbourhood amenities are increasingly shaping younger voters’ choices."),
      source: t(lang, "SUARA KOMUNITI · PANDAN", "COMMUNITY VOICE · PANDAN"),
    },
  ];
  useEffect(() => {
    if (active !== liveNewsTitle) return;
    setNewsIndex(day % newsBulletins.length);
    const rotation = window.setInterval(() => setNewsIndex((current) => (current + 1) % newsBulletins.length), 9000);
    return () => window.clearInterval(rotation);
  }, [active, day, liveNewsTitle, newsBulletins.length]);
  const officeTicker = newsBulletins[(Math.max(day, 1) - 1) % newsBulletins.length];
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
                      <MonthlyFieldCalendar
                        lang={lang}
                        scheduleBuilt={prepareDone}
                        visitConfirmed={commitDone}
                        stateName={calendarStateName}
                        campaignDay={day}
                        totalDays={totalDays}
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
            const bulletin = isNews ? newsBulletins[newsIndex % newsBulletins.length] : null;
            const visual = isNews
              ? bulletin!.image
              : isStrategy
                ? "/office-strategy-board.png"
                : "/political-office-realistic.png";
            const headline = isNews
              ? bulletin!.headline
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
                  className="w-[min(1420px,calc(100vw-32px))] overflow-hidden border shadow-2xl"
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
                    <div className="grid max-h-[82vh] overflow-y-auto lg:grid-cols-[1.65fr_.65fr]">
                    <div
                      className="relative min-h-[440px] border-b lg:min-h-[590px] lg:border-b-0 lg:border-r"
                      style={{ borderColor: "rgb(var(--cyan-rgb) / .22)" }}
                    >
                      <Image
                        src={visual}
                        alt={headline}
                        fill
                        sizes="(max-width: 1024px) 100vw, 72vw"
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
                            ? bulletin!.tag
                            : t(lang, "PAPARAN AKTIF", "ACTIVE DISPLAY")}
                        </div>
                        <div className="mt-2 text-[8px] font-black tracking-[.16em]" style={{ color: isNews ? bulletin!.tone : "var(--cyan)" }}>{isNews ? bulletin!.source : null}</div>
                        <h3 className="mt-2 max-w-3xl text-2xl font-black leading-tight text-white lg:text-3xl">
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
                          ? bulletin!.summary
                          : spot.detail}
                      </p>
                      {isNews && <div className="mt-4 grid grid-cols-3 gap-1.5" aria-label={t(lang, "Pilih bulletin berita", "Choose news bulletin")}>
                        {newsBulletins.map((item, index) => <button key={item.id} type="button" onClick={() => setNewsIndex(index)} className="overflow-hidden border text-left transition hover:brightness-125" style={{ borderColor: index === newsIndex ? item.tone : "rgb(var(--cyan-rgb) / .22)", background: index === newsIndex ? "rgb(var(--cyan-rgb) / .08)" : "transparent" }}>
                          <div className="relative h-12"><Image src={item.image} alt="" fill sizes="160px" className="object-cover" /></div>
                          <span className="block truncate px-1.5 py-1 text-[7px] font-black" style={{ color: index === newsIndex ? item.tone : "var(--text-muted)" }}>{item.tag}</span>
                        </button>)}
                      </div>}
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
            {officeTicker.headline}{" "}
            <span className="mx-5 text-cyan">◆</span>
            {officeTicker.source}
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
