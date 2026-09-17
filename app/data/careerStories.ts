export type StoryChoice = "help" | "compromise" | "refuse";
export type StoryPhase = "campaign" | "term" | "government" | "opposition";
type Copy = { ms: string; en: string };
export interface StoryEffects { funds?: number; trust?: number; stability?: number; organisation?: number; relationship?: number; localSupport?: number }
export interface CareerStory {
  id: string;
  phases: StoryPhase[];
  title: Copy;
  description: Copy;
  requires?: { storyId: string; choices?: StoryChoice[] };
  choices: Record<StoryChoice, Copy & { effects: StoryEffects }>;
}
export const CAREER_STORIES: CareerStory[] = [
  { id: "loyalty-event", phases: ["campaign", "term"], title: { ms: "Kesetiaan ada harganya", en: "The price of loyalty" }, description: { ms: "Penganjur anda meminta dana parti untuk acara penyokong. Penduduk mahu tumpuan kepada janji awam.", en: "Your organiser requests party funds for a supporters’ event. Residents want attention on public commitments." }, choices: {
    help: { ms: "Taja acara penuh", en: "Sponsor the full event", effects: { funds: -50000, relationship: 10, organisation: 3, trust: -2 } },
    compromise: { ms: "Adakan acara kecil", en: "Hold a smaller event", effects: { funds: -20000, relationship: 4, organisation: 1, trust: 1 } },
    refuse: { ms: "Utamakan penduduk", en: "Prioritise residents", effects: { relationship: -8, trust: 3, localSupport: .5 } },
  } },
  { id: "candidate-favourite", phases: ["campaign", "opposition"], title: { ms: "Calon pilihan akar umbi", en: "The grassroots favourite" }, description: { ms: "Rakan anda mahu latihan khas untuk calon kesayangannya. Pasukan dasar mahu pemilihan terbuka kepada semua ahli.", en: "Your ally wants special training for a favoured candidate. The policy team wants an open process for all members." }, choices: {
    help: { ms: "Biayai calon pilihan", en: "Fund the favoured candidate", effects: { funds: -45000, relationship: 8, organisation: 5, trust: -3 } },
    compromise: { ms: "Kongsi sesi latihan", en: "Share the training sessions", effects: { funds: -25000, relationship: 3, organisation: 4, trust: 1 } },
    refuse: { ms: "Kekalkan proses terbuka", en: "Keep the process open", effects: { relationship: -6, organisation: 2, trust: 3 } },
  } },
  { id: "branch-pressure", phases: ["term", "opposition"], title: { ms: "Tekanan daripada cawangan", en: "Pressure from the branches" }, description: { ms: "Ketua cawangan menuntut jelajah khas dan mengancam menarik sokongan. Pengundi meminta laporan kemajuan awam.", en: "Branch leaders demand a special tour and threaten to withdraw support. Voters are asking for a public progress report." }, choices: {
    help: { ms: "Biayai jelajah parti", en: "Fund the party tour", effects: { funds: -50000, relationship: 8, organisation: 5, trust: -2 } },
    compromise: { ms: "Gabungkan dengan dialog awam", en: "Combine it with a public forum", effects: { funds: -25000, relationship: 3, organisation: 3, trust: 2 } },
    refuse: { ms: "Terbitkan laporan awam", en: "Publish the public report", effects: { relationship: -7, stability: -2, trust: 4 } },
  } },
  { id: "contractor-shortcut", phases: ["government"], title: { ms: "Jalan pintas kontraktor", en: "The contractor’s shortcut" }, description: { ms: "Kontraktor projek menawarkan penyiapan pantas jika audit diketepikan. Pegawai daerah memberi amaran tentang risiko mutu.", en: "A project contractor offers faster delivery if the audit is waived. District officers warn about quality risks." }, choices: {
    help: { ms: "Luluskan laluan pantas", en: "Approve the fast track", effects: { trust: -5, stability: 3, relationship: 6 } },
    compromise: { ms: "Audit dipercepat", en: "Run an expedited audit", effects: { funds: -30000, trust: 2, stability: 1, relationship: 2 } },
    refuse: { ms: "Kekalkan audit penuh", en: "Keep the full audit", effects: { trust: 4, stability: -2, relationship: -5 } },
  } },
  { id: "whistleblower", phases: ["government", "opposition"], title: { ms: "Fail daripada pemberi maklumat", en: "The whistleblower’s file" }, description: { ms: "Seorang pegawai menyerahkan bukti salah guna dana oleh tokoh kanan. Mendedahkannya boleh menggugat parti anda sendiri.", en: "An official hands over evidence of fund misuse by a senior figure. Publishing it could damage your own party." }, choices: {
    help: { ms: "Lindungi tokoh parti", en: "Protect the party figure", effects: { relationship: 10, trust: -7, stability: 4 } },
    compromise: { ms: "Rujuk audit tertutup", en: "Refer it to a closed audit", effects: { relationship: 2, trust: 1, stability: 1 } },
    refuse: { ms: "Dedahkan bukti", en: "Release the evidence", effects: { relationship: -10, trust: 7, stability: -6 } },
  } },
  { id: "viral-clip", phases: ["campaign"], title: { ms: "Klip tular di kawasan", en: "A viral constituency clip" }, description: { ms: "Rakaman kempen anda dipotong di luar konteks. Pasukan media mahu menyerang balas, tetapi penduduk mahu penjelasan terus.", en: "A campaign clip is cut out of context. Your media team wants a counterattack, while residents want a direct explanation." }, choices: {
    help: { ms: "Lancarkan serangan balas", en: "Launch a counterattack", effects: { funds: -35000, relationship: 5, localSupport: 1.2, trust: -2 } },
    compromise: { ms: "Adakan sidang media", en: "Hold a press briefing", effects: { funds: -15000, trust: 2, localSupport: .6 } },
    refuse: { ms: "Jumpa penduduk sendiri", en: "Meet residents directly", effects: { relationship: -3, trust: 3, localSupport: .8 } },
  } },
  { id: "loyalty-reckoning", phases: ["term"], requires: { storyId: "loyalty-event" }, title: { ms: "Bil kesetiaan tiba", en: "The loyalty bill comes due" }, description: { ms: "Keputusan lama anda kembali. Penganjur yang sama meminta pengaruh dalam pelantikan parti menjelang pilihan raya berikutnya.", en: "Your earlier decision returns. The same organiser now asks for influence over party appointments before the next election." }, choices: {
    help: { ms: "Beri kuasa pelantikan", en: "Grant appointment influence", effects: { relationship: 8, organisation: 6, trust: -5, stability: 2 } },
    compromise: { ms: "Tubuhkan panel bersama", en: "Create a joint panel", effects: { relationship: 3, organisation: 3, trust: 1 } },
    refuse: { ms: "Tolak campur tangan", en: "Reject the interference", effects: { relationship: -9, trust: 4, stability: -3 } },
  } },
  { id: "protected-figure-leak", phases: ["term"], requires: { storyId: "whistleblower", choices: ["help", "compromise"] }, title: { ms: "Fail itu bocor", en: "The file leaks" }, description: { ms: "Dokumen yang tidak didedahkan kini bocor kepada media. Anda mesti memilih antara penafian, siasatan atau pengakuan.", en: "The document you withheld has leaked to the press. You must choose denial, investigation, or admission." }, choices: {
    help: { ms: "Nafikan dan lawan", en: "Deny and fight", effects: { funds: -40000, relationship: 6, trust: -8, stability: -3 } },
    compromise: { ms: "Buka siasatan bebas", en: "Open an independent inquiry", effects: { funds: -30000, trust: 5, stability: -4 } },
    refuse: { ms: "Akui kesilapan", en: "Admit the mistake", effects: { relationship: -8, trust: 7, stability: -6 } },
  } },
];

export function availableStories(phase: StoryPhase, choices: Record<string, StoryChoice>) {
  return CAREER_STORIES.filter(story => story.phases.includes(phase) && !choices[story.id] && (!story.requires || (choices[story.requires.storyId] && (!story.requires.choices || story.requires.choices.includes(choices[story.requires.storyId])))));
}
