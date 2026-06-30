"use client";
import { useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useHistoryStore, type GameRecord, type Outcome } from "../store/historyStore";
import { useLang, t } from "../i18n/useLang";

function outcomeColor(outcome: Outcome): string {
  if (outcome === "WIN") return "var(--neon-green)";
  if (outcome === "LOSE") return "var(--neon-red)";
  return "var(--gold)";
}

function difficultyColor(d: string): string {
  if (d === "easy") return "var(--neon-green)";
  if (d === "normal") return "var(--cyan)";
  if (d === "hard") return "var(--gold)";
  return "var(--neon-red)";
}

function difficultyLabel(d: string, lang: ReturnType<typeof useLang>): string {
  if (d === "easy")      return t(lang, "MUDAH",       "EASY");
  if (d === "normal")    return t(lang, "NORMAL",      "NORMAL");
  if (d === "hard")      return t(lang, "SUKAR",       "HARD");
  if (d === "nightmare") return t(lang, "MIMPI NGERI", "NIGHTMARE");
  return d.toUpperCase();
}

function outcomeLabel(o: Outcome, lang: ReturnType<typeof useLang>): string {
  if (o === "WIN")        return t(lang, "MENANG",    "WIN");
  if (o === "LOSE")       return t(lang, "KALAH",     "LOSE");
  return t(lang, "TAK SELESAI", "INCOMPLETE");
}

function RecordRow({ record, selected, onSelect, lang }: {
  record: GameRecord;
  selected: boolean;
  onSelect: () => void;
  lang: ReturnType<typeof useLang>;
}) {
  const oc = outcomeColor(record.outcome);
  const surplus = record.seatsWon - record.majorityTarget;

  return (
    <>
      <tr
        onClick={onSelect}
        className="cursor-pointer transition-colors"
        style={{
          borderBottom: selected ? "none" : "1px solid rgb(var(--cyan-rgb) / 0.08)",
          background: selected ? "rgb(var(--gold-rgb) / 0.04)" : "transparent",
          borderLeft: selected ? "2px solid var(--gold)" : "2px solid transparent",
        }}
        onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "rgb(var(--cyan-rgb) / 0.03)"; }}
        onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Date */}
        <td className="px-3 py-2.5 text-[11px]" style={{ color: "var(--text-muted)", minWidth: "90px" }}>
          {record.date}
        </td>
        {/* Election */}
        <td className="px-3 py-2.5 text-[12px] font-bold" style={{ color: "var(--cyan)" }}>
          {record.electionName}
        </td>
        {/* Leader */}
        <td className="px-3 py-2.5 text-[12px] text-white font-bold uppercase">
          {record.leaderName}
        </td>
        {/* Difficulty */}
        <td className="px-3 py-2.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ color: difficultyColor(record.difficulty), border: `1px solid ${difficultyColor(record.difficulty)}44`, background: `${difficultyColor(record.difficulty)}0a` }}>
            {difficultyLabel(record.difficulty, lang)}
          </span>
        </td>
        {/* Seats */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-1.5" style={{ width: `${(record.seatsWon / record.totalSeats) * 100}%`, background: oc }} />
            </div>
            <span className="text-[12px] font-black" style={{ color: oc }}>{record.seatsWon}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ {record.totalSeats}</span>
          </div>
        </td>
        {/* Support */}
        <td className="px-3 py-2.5 text-[12px] font-bold" style={{ color: record.nationalSupport >= 50 ? "var(--neon-green)" : "var(--gold)" }}>
          {record.nationalSupport}%
        </td>
        {/* States */}
        <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          {record.statesWon} / {record.totalStates}
        </td>
        {/* Outcome */}
        <td className="px-3 py-2.5">
          <span className="text-[11px] font-black px-2 py-1 tracking-widest" style={{ color: oc, border: `1px solid ${oc}55`, background: `${oc}11` }}>
            {outcomeLabel(record.outcome, lang)}
            {record.outcome === "WIN" && surplus > 0 && <span className="text-[9px] ml-1">+{surplus}</span>}
          </span>
        </td>
        {/* Expand arrow */}
        <td className="px-3 py-2.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {selected ? "▼" : "▶"}
        </td>
      </tr>

      {/* Expanded detail row */}
      {selected && (
        <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)" }}>
          <td colSpan={9} className="px-4 pb-3 pt-1">
            <div className="flex gap-6 text-[11px]" style={{ background: "rgb(var(--gold-rgb) / 0.03)", border: "1px solid rgb(var(--gold-rgb) / 0.12)", padding: "10px 14px" }}>
              <div className="flex flex-col gap-1 min-w-[140px]">
                <div style={{ color: "var(--text-muted)" }}>{t(lang, "HARI DIMAINKAN", "DAYS PLAYED")}</div>
                <div className="font-bold text-white">{record.daysPlayed} / {record.totalDays} {t(lang, "hari", "days")}</div>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <div style={{ color: "var(--text-muted)" }}>{t(lang, "NEGERI TERBAIK", "TOP STATE")}</div>
                <div className="font-bold" style={{ color: "var(--neon-green)" }}>{record.topState}</div>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <div style={{ color: "var(--text-muted)" }}>{t(lang, "NEGERI TERBURUK", "WORST STATE")}</div>
                <div className="font-bold" style={{ color: "var(--neon-red)" }}>{record.worstState}</div>
              </div>
              {record.notes && (
                <div className="flex flex-col gap-1 flex-1">
                  <div style={{ color: "var(--text-muted)" }}>{t(lang, "CATATAN", "NOTES")}</div>
                  <div className="italic" style={{ color: "#8899aa" }}>{record.notes}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function StatsPage() {
  const lang = useLang();
  const { records, clearHistory } = useHistoryStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const totalGames  = records.length;
  const wins        = records.filter((r) => r.outcome === "WIN").length;
  const winRate     = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const bestSeats   = records.length > 0 ? Math.max(...records.map((r) => r.seatsWon)) : 0;
  const bestRecord  = records.find((r) => r.seatsWon === bestSeats);
  const avgSeats    = totalGames > 0 ? Math.round(records.reduce((s, r) => s + r.seatsWon, 0) / totalGames) : 0;
  const avgSupport  = totalGames > 0 ? Math.round(records.reduce((s, r) => s + r.nationalSupport, 0) / totalGames) : 0;

  const tableHeaders = [
    t(lang, "TARIKH", "DATE"),
    t(lang, "PILRAYA", "ELECTION"),
    t(lang, "PEMIMPIN", "LEADER"),
    t(lang, "KESUKARAN", "DIFFICULTY"),
    t(lang, "KERUSI MENANG", "SEATS WON"),
    t(lang, "SOKONGAN", "SUPPORT"),
    t(lang, "NEGERI", "STATES"),
    t(lang, "KEPUTUSAN", "OUTCOME"),
    "",
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar
        leftText={t(lang, "» SEJARAH PERMAINAN · REKOD KEMPEN LALU", "» GAME HISTORY · PAST CAMPAIGN RECORDS")}
        rightText={t(lang, "KLIK REKOD UNTUK BUTIRAN", "CLICK RECORD FOR DETAILS")}
      />

      <main className="pt-[56px] pb-[52px] px-6 min-h-screen">
        {/* Title */}
        <div className="mb-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
          <h1 className="text-[19px] font-bold tracking-widest uppercase" style={{ color: "var(--cyan)" }}>
            {t(lang, "SEJARAH PERMAINAN", "GAME HISTORY")}
            <span className="text-[14px] font-normal ml-3" style={{ color: "var(--text-muted)" }}>
              — {t(lang, "REKOD KEMPEN LALU", "PAST CAMPAIGN RECORDS")}
            </span>
          </h1>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: "var(--neon-red)" }}>{t(lang, "Pasti nak padam?", "Confirm clear?")}</span>
              <button onClick={() => { clearHistory(); setConfirmClear(false); setSelectedId(null); }} className="text-[11px] px-2 py-1 font-bold" style={{ border: "1px solid var(--neon-red)", color: "var(--neon-red)", background: "none", cursor: "pointer" }}>
                {t(lang, "YA", "YES")}
              </button>
              <button onClick={() => setConfirmClear(false)} className="text-[11px] px-2 py-1" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.3)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}>
                {t(lang, "BATAL", "CANCEL")}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="text-[11px] px-3 py-1.5 transition-colors" style={{ border: "1px solid rgb(var(--neon-red-rgb,255 68 68) / 0.3)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}>
              {t(lang, "PADAM SEJARAH", "CLEAR HISTORY")}
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { labelMS: "JUMLAH PERLAWANAN", labelEN: "TOTAL GAMES",    value: totalGames,              color: "var(--cyan)",       unit: "" },
            { labelMS: "KADAR MENANG",      labelEN: "WIN RATE",       value: `${winRate}%`,           color: "var(--neon-green)", unit: "" },
            { labelMS: "KERUSI TERBANYAK",  labelEN: "BEST SEATS",     value: bestSeats,               color: "var(--gold)",       unit: `/ ${bestRecord?.electionName ?? ""}` },
            { labelMS: "PURATA KERUSI",     labelEN: "AVG SEATS",      value: avgSeats,                color: "var(--cyan)",       unit: "/ 222" },
            { labelMS: "PURATA SOKONGAN",   labelEN: "AVG SUPPORT",    value: `${avgSupport}%`,        color: "var(--gold)",       unit: "" },
          ].map((card) => (
            <div key={card.labelEN} className="border px-4 py-3" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)", background: "rgb(var(--cyan-rgb) / 0.03)" }}>
              <div className="text-[9px] tracking-[0.22em] mb-1" style={{ color: "var(--text-muted)" }}>{t(lang, card.labelMS, card.labelEN)}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[26px] font-black leading-none" style={{ color: card.color }}>{card.value}</span>
                {card.unit && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{card.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Best Run Banner */}
        {bestRecord && (
          <div className="mb-4 px-5 py-3 flex items-center gap-6" style={{ border: "1px solid rgb(var(--gold-rgb) / 0.35)", background: "linear-gradient(90deg, rgb(var(--gold-rgb) / 0.07), rgb(var(--gold-rgb) / 0.02))" }}>
            <span className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>
              ★ {t(lang, "REKOD TERBAIK", "BEST RECORD")}
            </span>
            <span className="text-[12px] font-bold text-white">{bestRecord.leaderName}</span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{bestRecord.electionName} · {bestRecord.date}</span>
            <span className="font-black text-[14px]" style={{ color: "var(--neon-green)" }}>{bestRecord.seatsWon} {t(lang, "KERUSI", "SEATS")}</span>
            <span className="text-[10px]" style={{ color: "var(--gold)" }}>+{bestRecord.seatsWon - bestRecord.majorityTarget} {t(lang, "LEBIHAN MAJORITI", "SURPLUS")}</span>
            {bestRecord.notes && <span className="text-[10px] italic" style={{ color: "#657585" }}>&ldquo;{bestRecord.notes}&rdquo;</span>}
          </div>
        )}

        {/* History Table */}
        {records.length === 0 ? (
          <TacticalPanel>
            <div className="text-center py-16">
              <div className="text-[38px] mb-3" style={{ opacity: 0.3 }}>📜</div>
              <div className="text-[14px] font-bold tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                {t(lang, "TIADA SEJARAH PERMAINAN", "NO GAME HISTORY")}
              </div>
              <div className="text-[12px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                {t(lang, "Selesaikan kempen untuk merekod sejarah di sini.", "Complete a campaign to record history here.")}
              </div>
            </div>
          </TacticalPanel>
        ) : (
          <TacticalPanel title={t(lang, `SEMUA REKOD — ${totalGames} PERLAWANAN`, `ALL RECORDS — ${totalGames} GAMES`)} noPadding>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.25)" }}>
                    {tableHeaders.map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 uppercase tracking-wider" style={{ color: "var(--text-muted)", fontWeight: "normal", fontSize: "10px" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      selected={selectedId === record.id}
                      onSelect={() => setSelectedId(selectedId === record.id ? null : record.id)}
                      lang={lang}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </TacticalPanel>
        )}

        {/* Win/Lose breakdown chart */}
        {records.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <TacticalPanel title={t(lang, "RINGKASAN KEPUTUSAN", "OUTCOME SUMMARY")}>
              <div className="flex flex-col gap-3">
                {[
                  { labelMS: "MENANG",      labelEN: "WIN",        count: wins,                           color: "var(--neon-green)" },
                  { labelMS: "KALAH",       labelEN: "LOSE",       count: records.filter(r => r.outcome === "LOSE").length,       color: "var(--neon-red)" },
                  { labelMS: "TAK SELESAI",  labelEN: "INCOMPLETE", count: records.filter(r => r.outcome === "INCOMPLETE").length, color: "var(--gold)" },
                ].map((row) => (
                  <div key={row.labelEN}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold" style={{ color: row.color }}>{t(lang, row.labelMS, row.labelEN)}</span>
                      <span className="text-[11px] font-black" style={{ color: row.color }}>{row.count}</span>
                    </div>
                    <div className="h-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-2 transition-all" style={{ width: totalGames > 0 ? `${(row.count / totalGames) * 100}%` : "0%", background: row.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "KERUSI MENGIKUT PERMAINAN", "SEATS PER GAME")}>
              <div className="flex flex-col gap-2">
                {records.slice(0, 5).map((r) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{r.date}</span>
                      <span className="text-[10px] font-black" style={{ color: outcomeColor(r.outcome) }}>{r.seatsWon}</span>
                    </div>
                    <div className="h-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-1.5" style={{ width: `${(r.seatsWon / r.totalSeats) * 100}%`, background: outcomeColor(r.outcome) }} />
                    </div>
                  </div>
                ))}
                <div className="mt-1 flex items-center gap-2 text-[9px]" style={{ color: "var(--text-muted)" }}>
                  <div className="w-2 h-2" style={{ background: "rgb(var(--cyan-rgb)/0.35)" }} />
                  {t(lang, "Garisan majoriti:", "Majority line:")} 112 {t(lang, "kerusi", "seats")}
                </div>
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "KESUKARAN TERPILIH", "DIFFICULTY BREAKDOWN")}>
              <div className="flex flex-col gap-3">
                {(["easy", "normal", "hard", "nightmare"] as const).map((d) => {
                  const cnt = records.filter((r) => r.difficulty === d).length;
                  if (cnt === 0) return null;
                  return (
                    <div key={d}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold" style={{ color: difficultyColor(d) }}>{difficultyLabel(d, lang)}</span>
                        <span className="text-[11px]" style={{ color: difficultyColor(d) }}>{cnt}×</span>
                      </div>
                      <div className="h-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-1.5" style={{ width: `${(cnt / totalGames) * 100}%`, background: difficultyColor(d) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TacticalPanel>
          </div>
        )}
      </main>
    </div>
  );
}
