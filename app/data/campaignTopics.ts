import type { StateData } from "./states";
import type { MiniGameType } from "../store/campaignMath";

export interface CampaignTopic {
  id: string;
  labelMS: string;
  labelEN: string;
  blurbMS: string;
  blurbEN: string;
}

// Ceramah pool: live rally speech, so blurbs read as a crowd's physical reaction.
const CERAMAH_POOL: CampaignTopic[] = [
  {
    id: "economy",
    labelMS: "Ekonomi & Kos Hidup",
    labelEN: "Economy & Cost of Living",
    blurbMS: "Orang ramai anggukkan kepala apabila angka kos sara hidup disebut.",
    blurbEN: "The crowd nods along as cost-of-living figures are cited.",
  },
  {
    id: "safety",
    labelMS: "Keselamatan Awam",
    labelEN: "Public Safety",
    blurbMS: "Barisan hadapan bertepuk tangan — isu keselamatan kawasan disambut baik.",
    blurbEN: "The front rows applaud — local safety concerns land well.",
  },
  {
    id: "sensitive",
    labelMS: "Isu Sensitif",
    labelEN: "Sensitive Issues",
    blurbMS: "Sebahagian penonton bertukar pandang — ini isu berisiko tinggi.",
    blurbEN: "Some in the crowd exchange glances — this is a higher-risk topic.",
  },
  {
    id: "healthcare",
    labelMS: "Sistem Kesihatan",
    labelEN: "Healthcare System",
    blurbMS: "Warga emas di barisan belakang bersorak apabila klinik komuniti disebut.",
    blurbEN: "Elderly attendees at the back cheer when community clinics come up.",
  },
  {
    id: "education",
    labelMS: "Pendidikan & Sekolah",
    labelEN: "Education & Schools",
    blurbMS: "Ibu bapa muda mengangguk setuju — bajet sekolah menyentuh hati mereka.",
    blurbEN: "Young parents nod in agreement as school funding hits home.",
  },
  {
    id: "infrastructure",
    labelMS: "Infrastruktur & Jalan Raya",
    labelEN: "Infrastructure & Roads",
    blurbMS: "Penduduk kampung bersorak — janji baiki jalan disambut meriah.",
    blurbEN: "Villagers cheer loudly — the promise to fix the roads lands well.",
  },
  {
    id: "youth_jobs",
    labelMS: "Peluang Kerja Belia",
    labelEN: "Youth Job Opportunities",
    blurbMS: "Kumpulan belia di tepi pentas mula rakam video — topik ini tular cepat.",
    blurbEN: "A cluster of young voters starts filming — this topic is going to travel fast.",
  },
  {
    id: "corruption",
    labelMS: "Ketelusan & Rasuah",
    labelEN: "Transparency & Corruption",
    blurbMS: "Ramai bersorak kuat — janji lawan rasuah sentuh kemarahan terpendam.",
    blurbEN: "A loud cheer rises — the anti-corruption pledge taps into pent-up anger.",
  },
  {
    id: "housing",
    labelMS: "Perumahan Mampu Milik",
    labelEN: "Affordable Housing",
    blurbMS: "Pasangan muda di barisan tengah berbisik teruja tentang skim rumah pertama.",
    blurbEN: "Young couples in the middle rows whisper excitedly about first-home schemes.",
  },
  {
    id: "environment",
    labelMS: "Alam Sekitar & Banjir",
    labelEN: "Environment & Flooding",
    blurbMS: "Penduduk kawasan banjir tepuk tangan panjang apabila janji tebatan air disebut.",
    blurbEN: "Flood-prone residents give a long round of applause at the flood-mitigation pledge.",
  },
];

// Social pool: short-form digital push, so blurbs read as platform/engagement signals.
const SOCIAL_POOL: CampaignTopic[] = [
  {
    id: "viral_meme",
    labelMS: "Meme Tular",
    labelEN: "Viral Meme",
    blurbMS: "Meme berkaitan kos sara hidup mula dikongsi berulang kali dalam masa nyata.",
    blurbEN: "A cost-of-living meme starts getting reshared in real time.",
  },
  {
    id: "livestream_qna",
    labelMS: "Sesi Soal Jawab Langsung",
    labelEN: "Live Q&A Session",
    blurbMS: "Komen bertimbun masuk apabila calon jawab soalan rakyat secara langsung.",
    blurbEN: "Comments flood in as the candidate answers voter questions live.",
  },
  {
    id: "influencer_collab",
    labelMS: "Kolaborasi Pemberi Pengaruh",
    labelEN: "Influencer Collaboration",
    blurbMS: "Pemberi pengaruh tempatan kongsi klip — jumlah tontonan melonjak drastik.",
    blurbEN: "A local influencer reshares the clip — view count spikes hard.",
  },
  {
    id: "fact_check",
    labelMS: "Semakan Fakta",
    labelEN: "Fact-Check Thread",
    blurbMS: "Rangkaian semakan fakta mendapat pujian atas ketelitian dan bukti.",
    blurbEN: "A fact-check thread gets praised for being precise and well-sourced.",
  },
  {
    id: "hashtag_challenge",
    labelMS: "Cabaran Hashtag",
    labelEN: "Hashtag Challenge",
    blurbMS: "Hashtag kempen mula trending di kalangan pengguna muda.",
    blurbEN: "The campaign hashtag starts trending among younger users.",
  },
  {
    id: "short_clip",
    labelMS: "Klip Video Pendek",
    labelEN: "Short-Form Video Clip",
    blurbMS: "Klip 30 saat dikongsi semula ratusan kali dalam sejam pertama.",
    blurbEN: "A 30-second clip gets reshared hundreds of times within the first hour.",
  },
  {
    id: "comment_section",
    labelMS: "Perang Ruangan Komen",
    labelEN: "Comment Section Battle",
    blurbMS: "Ruangan komen bertukar panas — sokongan dan bantahan bertembung.",
    blurbEN: "The comment section heats up as supporters and critics clash.",
  },
  {
    id: "poll_engagement",
    labelMS: "Undian Interaktif",
    labelEN: "Interactive Poll",
    blurbMS: "Ribuan pengguna undi dalam tinjauan pantas mengenai janji kempen.",
    blurbEN: "Thousands of users vote in a quick poll about the campaign pledge.",
  },
  {
    id: "explainer_carousel",
    labelMS: "Karusel Penjelasan Dasar",
    labelEN: "Policy Explainer Carousel",
    blurbMS: "Karusel infografik dikongsi meluas — mudah faham, mudah sebar.",
    blurbEN: "An infographic carousel spreads widely — easy to grasp, easy to share.",
  },
  {
    id: "rapid_rebuttal",
    labelMS: "Bantahan Pantas",
    labelEN: "Rapid Rebuttal Post",
    blurbMS: "Bantahan pantas terhadap dakwaan lawan dikongsi sebelum ia reda.",
    blurbEN: "A rapid rebuttal to an opponent's claim lands before the news cycle cools.",
  },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Turns a state's `keyIssues` entry into a one-off topic so the choices feel
// specific to where the player is campaigning, not just a generic pool.
function issueTopic(issue: string, gameType: MiniGameType): CampaignTopic {
  const id = `issue-${issue.toLowerCase().replace(/\s+/g, "-")}`;
  if (gameType === "social") {
    return {
      id,
      labelMS: issue,
      labelEN: issue,
      blurbMS: `Hantaran tentang "${issue}" tular pantas di kalangan pengundi negeri ini.`,
      blurbEN: `A post about "${issue}" spreads fast among voters in this state.`,
    };
  }
  return {
    id,
    labelMS: issue,
    labelEN: issue,
    blurbMS: `Penonton beri perhatian penuh apabila "${issue}" disentuh — isu ini dekat di hati mereka.`,
    blurbEN: `The crowd leans in as "${issue}" comes up — it hits close to home here.`,
  };
}

/**
 * Draws a fresh set of topics each time it's called: 1-2 pulled from the
 * target state's own `keyIssues` (so they vary by where you're campaigning)
 * mixed with a random sample from the generic pool, then shuffled. Called
 * once per mini-game session so replays don't show the same static list.
 */
export function generateCampaignTopics(state: StateData, gameType: MiniGameType, count = 4): CampaignTopic[] {
  const pool = gameType === "social" ? SOCIAL_POOL : CERAMAH_POOL;
  const issueCount = Math.min(2, state.keyIssues.length);
  const issuePicks = shuffle(state.keyIssues)
    .slice(0, issueCount)
    .map((issue) => issueTopic(issue, gameType));

  const genericNeeded = Math.max(0, count - issuePicks.length);
  const genericPicks = shuffle(pool).slice(0, genericNeeded);

  return shuffle([...issuePicks, ...genericPicks]);
}
