import type { Lang } from "../i18n/useLang";

// Shown when the AI advisor is unreachable (no API key, or the connected
// account is out of credits — see app/api/advisor/route.ts's GET /
// offlineAdvice()). Free text gets disabled in that state — typing an
// arbitrary question would just come back with one of these same canned
// answers anyway (the offline fallback can't read the question), so
// instead the player picks straight from this pool: instant, no network
// round-trip, no wasted "AI is thinking" wait on a connection we already
// know is down.
export interface AdvisorPoolInput {
  day: number;
  totalDays: number;
  funds: number;
  manpower: number;
  projectedSeats: number;
  majorityTarget: number;
  totalSeats: number;
  weakStates: string[];
  support: { mandat: number; lawan: number; others: number };
  mediaSentiment: "positive" | "neutral" | "negative";
  isPrn: boolean;
  opponentThreatLevel: { label: string; labelMS: string };
  recentOpponentActions: { type: string; narrativeEN: string; narrativeMS: string; day: number }[];
}

export interface AdvisorPoolEntry {
  id: string;
  questionMS: string;
  questionEN: string;
  answer: (input: AdvisorPoolInput) => { ms: string; en: string };
}

export const ADVISOR_POOL: AdvisorPoolEntry[] = [
  {
    id: "situation",
    questionMS: "Apa status kempen sekarang?",
    questionEN: "What's the current campaign situation?",
    answer: ({ projectedSeats, majorityTarget, day, totalDays }) => {
      const gap = majorityTarget - projectedSeats;
      const daysLeft = Math.max(0, totalDays - day);
      return gap > 0
        ? {
            ms: `Hari ${day}/${totalDays}. Kita kurang ${gap} kerusi daripada sasaran majoriti ${majorityTarget}, dengan ${daysLeft} hari berbaki. Fokuskan sumber pada kerusi marginal — jangan bazir dana di kubu selamat.`,
            en: `Day ${day}/${totalDays}. We're ${gap} seats short of the ${majorityTarget}-seat majority target, with ${daysLeft} days left. Concentrate resources on marginal seats — don't waste funds on safe strongholds.`,
          }
        : {
            ms: `Hari ${day}/${totalDays}. Unjuran ${projectedSeats} kerusi melepasi sasaran majoriti ${majorityTarget}, dengan ${daysLeft} hari berbaki. Kekalkan momentum — pertahankan kerusi marginal, jangan leka.`,
            en: `Day ${day}/${totalDays}. Projection of ${projectedSeats} seats clears the ${majorityTarget}-seat majority target, with ${daysLeft} days left. Hold the line — defend our marginals, no complacency.`,
          };
    },
  },
  {
    id: "focusStates",
    questionMS: "Negeri/kawasan mana patut saya fokuskan?",
    questionEN: "Which states/areas should I focus on?",
    answer: ({ weakStates }) =>
      weakStates.length
        ? {
            ms: `Kawasan lemah sekarang: ${weakStates.join(", ")}. Hantar jentera dan belanja iklan di sana minggu ini — itu tempat undi paling mudah berubah.`,
            en: `Current weak areas: ${weakStates.join(", ")}. Deploy ground teams and ad spend there this week — those are where votes are most likely to shift.`,
          }
        : {
            ms: `Tiada kawasan lemah ketara buat masa ini — teruskan operasi seimbang merentasi semua kawasan.`,
            en: `No standout weak areas right now — keep operations balanced across the board.`,
          },
  },
  {
    id: "funds",
    questionMS: "Macam mana nak guna baki dana dengan bijak?",
    questionEN: "How should I spend the remaining funds wisely?",
    answer: ({ funds }) =>
      funds < 500_000
        ? {
            ms: `Dana tinggal RM ${funds.toLocaleString()} — tumpukan operasi kos rendah (rumah ke rumah, media sosial) dan elak iklan media mahal buat masa ini.`,
            en: `Only RM ${funds.toLocaleString()} left — pivot to low-cost ops (door-to-door, social media) and avoid expensive media buys for now.`,
          }
        : {
            ms: `Dana masih sihat (RM ${funds.toLocaleString()}). Boleh gandakan operasi di kerusi marginal — itu tempat setiap ringgit beri pulangan paling tinggi.`,
            en: `Funds are still healthy (RM ${funds.toLocaleString()}). Worth doubling down on marginal-seat operations — that's where every ringgit returns the most.`,
          },
  },
  {
    id: "finalDays",
    questionMS: "Strategi untuk hari-hari terakhir kempen?",
    questionEN: "Strategy for the final days of the campaign?",
    answer: ({ day, totalDays }) => {
      const daysLeft = Math.max(0, totalDays - day);
      return daysLeft <= 7
        ? {
            ms: `${daysLeft} hari sebelum mengundi: kunci mesej utama, mobilisasi keluar mengundi, elak kontroversi baharu.`,
            en: `${daysLeft} days to polling: lock the core message, drive turnout, avoid fresh controversy.`,
          }
        : {
            ms: `Masih ${daysLeft} hari lagi — fasa ini untuk bina asas: perluas jentera, kukuhkan kerusi marginal, kumpul dana untuk dorongan akhir.`,
            en: `Still ${daysLeft} days to go — this phase is for building the base: expand ground teams, shore up marginals, bank funds for the final push.`,
          };
    },
  },
  {
    id: "opponent",
    questionMS: "Apa ancaman LAWAN sekarang?",
    questionEN: "What's the LAWAN threat level right now?",
    answer: ({ opponentThreatLevel, recentOpponentActions }) => {
      if (!recentOpponentActions.length) {
        return {
          ms: `Ancaman LAWAN: ${opponentThreatLevel.labelMS}. Tiada aktiviti lawan ketara direkodkan setakat ini — teruskan kempen seperti dirancang.`,
          en: `LAWAN threat: ${opponentThreatLevel.label}. No notable opposition activity recorded yet — proceed with the campaign as planned.`,
        };
      }
      const latest = recentOpponentActions[0];
      return {
        ms: `Ancaman LAWAN: ${opponentThreatLevel.labelMS}. Gerakan terkini (${latest.type}): ${latest.narrativeMS} Sediakan tindak balas.`,
        en: `LAWAN threat: ${opponentThreatLevel.label}. Latest move (${latest.type}): ${latest.narrativeEN} Prepare a response.`,
      };
    },
  },
  {
    id: "media",
    questionMS: "Macam mana nak tingkatkan sentimen media?",
    questionEN: "How do I improve media sentiment?",
    answer: ({ mediaSentiment }) => {
      if (mediaSentiment === "negative") {
        return {
          ms: `Sentimen media NEGATIF sekarang — kurangkan risiko kontroversi, utamakan mesej positif dan kisah rakyat biasa dalam liputan media minggu ini.`,
          en: `Media sentiment is currently NEGATIVE — reduce controversy risk, lead with positive messaging and everyday-voter stories in this week's coverage.`,
        };
      }
      if (mediaSentiment === "positive") {
        return {
          ms: `Sentimen media POSITIF sekarang — ini masa sesuai untuk umumkan janji dasar besar atau acara media berprofil tinggi.`,
          en: `Media sentiment is currently POSITIVE — a good window to announce a major policy pledge or a high-profile media event.`,
        };
      }
      return {
        ms: `Sentimen media NEUTRAL — belum ada kelebihan jelas. Operasi media sosial berterusan boleh tolak sentimen ke arah positif.`,
        en: `Media sentiment is currently NEUTRAL — no clear edge yet. Sustained social media operations can help tip it positive.`,
      };
    },
  },
  {
    id: "support",
    questionMS: "Bagaimana keadaan sokongan (support) sekarang?",
    questionEN: "How's our support standing right now?",
    answer: ({ support }) => {
      const lead = support.mandat - support.lawan;
      if (lead > 5) {
        return {
          ms: `MANDAT ${support.mandat}% berbanding LAWAN ${support.lawan}% — kita mendahului ${lead.toFixed(0)} mata. Kekalkan momentum, jangan bagi ruang untuk LAWAN kejar balik.`,
          en: `MANDAT ${support.mandat}% vs LAWAN ${support.lawan}% — we're leading by ${lead.toFixed(0)} points. Keep the momentum, don't give LAWAN room to catch up.`,
        };
      }
      if (lead < -5) {
        return {
          ms: `MANDAT ${support.mandat}% berbanding LAWAN ${support.lawan}% — kita ketinggalan ${Math.abs(lead).toFixed(0)} mata. Perlukan dorongan besar di kawasan lemah untuk rapatkan jurang.`,
          en: `MANDAT ${support.mandat}% vs LAWAN ${support.lawan}% — we're trailing by ${Math.abs(lead).toFixed(0)} points. Need a big push in weak areas to close the gap.`,
        };
      }
      return {
        ms: `MANDAT ${support.mandat}% berbanding LAWAN ${support.lawan}% — sangat rapat. Setiap operasi minggu ini boleh tentukan hala tuju kempen.`,
        en: `MANDAT ${support.mandat}% vs LAWAN ${support.lawan}% — very close. Every operation this week could decide which way the campaign tips.`,
      };
    },
  },
  {
    id: "manpower",
    questionMS: "Cukupkah tenaga kerja (manpower) kita sekarang?",
    questionEN: "Do we have enough manpower right now?",
    answer: ({ manpower }) =>
      manpower < 300
        ? {
            ms: `Tenaga kerja tinggal ${manpower} orang — agak nipis. Utamakan operasi rumah ke rumah di kerusi marginal sahaja buat masa ini, jangan serak jentera merentasi terlalu banyak kawasan.`,
            en: `Only ${manpower} ground workers left — getting thin. Prioritise door-to-door in marginal seats only for now, don't spread the ground team across too many areas.`,
          }
        : {
            ms: `Tenaga kerja mencukupi (${manpower} orang). Boleh jalankan operasi serentak di beberapa kawasan marginal tanpa risau kehabisan jentera.`,
            en: `Manpower is solid (${manpower} workers). You can run simultaneous operations across several marginal seats without stretching the ground team too thin.`,
          },
  },
  {
    id: "scope",
    questionMS: "Apa nasihat am untuk kempen ini?",
    questionEN: "What's your general advice for this campaign?",
    answer: ({ isPrn, majorityTarget, totalSeats }) =>
      isPrn
        ? {
            ms: `Ini PRN — fokus sepenuhnya pada negeri ini sahaja. Sasaran ${majorityTarget} daripada ${totalSeats} kerusi DUN untuk bentuk kerajaan negeri. Jangan bazir sumber fikirkan negeri lain, ia tidak relevan dalam mod ini.`,
            en: `This is a PRN — stay fully focused on this one state. Target is ${majorityTarget} of ${totalSeats} DUN seats to form the state government. Don't waste resources thinking about other states, they're not relevant in this mode.`,
          }
        : {
            ms: `Ini PRU kebangsaan — sasaran ${majorityTarget} daripada ${totalSeats} kerusi Parlimen. Imbangkan sumber merentasi semua negeri, tapi utamakan kerusi marginal yang paling mudah berubah.`,
            en: `This is a national PRU — target is ${majorityTarget} of ${totalSeats} Parliamentary seats. Balance resources across all states, but prioritise the marginal seats most likely to swing.`,
          },
  },
  {
    id: "crisis",
    questionMS: "Bagaimana nak hadapi skandal atau kontroversi?",
    questionEN: "How do I handle a scandal or controversy?",
    answer: ({ mediaSentiment }) =>
      mediaSentiment === "negative"
        ? {
            ms: `Sentimen media sudah negatif — jangan tunggu, keluarkan kenyataan rasmi segera, akui isu jika benar, dan tukar topik perbualan secepat mungkin dengan berita positif baharu.`,
            en: `Media sentiment is already negative — don't wait, put out an official statement quickly, acknowledge the issue if it's real, and shift the conversation with fresh positive news as soon as possible.`,
          }
        : {
            ms: `Sentimen media belum terjejas — kalau skandal berlaku, respons cepat dan tenang lebih penting daripada respons sempurna. Jangan biar senyap terlalu lama.`,
            en: `Media sentiment isn't damaged yet — if a scandal hits, a fast, calm response matters more than a perfect one. Don't stay silent for too long.`,
          },
  },
  {
    id: "adTiming",
    questionMS: "Bila patut saya lancarkan iklan besar-besaran?",
    questionEN: "When should I launch a big media push?",
    answer: ({ day, totalDays, funds }) => {
      const daysLeft = Math.max(0, totalDays - day);
      if (funds < 500_000) {
        return {
          ms: `Dana belum cukup untuk dorongan media besar-besaran sekarang — kumpul dana dahulu, atau tunggu ${Math.min(daysLeft, 7)} hari terakhir bila kesannya paling ketara.`,
          en: `Funds aren't there yet for a big media push — build up funds first, or wait for the final ${Math.min(daysLeft, 7)} days when the impact lands hardest.`,
        };
      }
      return daysLeft <= 10
        ? {
            ms: `Dana mencukupi dan kita dalam ${daysLeft} hari terakhir — ini masa terbaik untuk lancarkan dorongan media besar-besaran, kesannya tak sempat dilupakan sebelum hari mengundi.`,
            en: `Funds are ready and we're in the final ${daysLeft} days — this is the best window for a big media push, the impact won't have time to fade before polling day.`,
          }
        : {
            ms: `Dana mencukupi tapi masih ${daysLeft} hari lagi — simpan sebahagian dana untuk dorongan akhir, jangan tembak semua peluru terlalu awal.`,
            en: `Funds are ready but there are still ${daysLeft} days to go — hold back some funds for the final push, don't fire all your ammunition too early.`,
          };
    },
  },
];

export function advisorPoolAnswer(entry: AdvisorPoolEntry, input: AdvisorPoolInput, lang: Lang): string {
  const { ms, en } = entry.answer(input);
  return lang === "ms" ? ms : en;
}
