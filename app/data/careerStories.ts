import type { Bilingual } from "../store/journey";

export interface CareerStory {
  title: Bilingual;
  description: Bilingual;
  choices: Record<"help" | "compromise" | "refuse", Bilingual>;
}
export const CAREER_STORIES: CareerStory[] = [
  { title: { ms: "Kesetiaan ada harganya", en: "The price of loyalty" }, description: { ms: "Penganjur anda meminta dana parti untuk acara penyokong. Penduduk mahu tumpuan kepada janji awam.", en: "Your organiser requests party funds for a supporters’ event. Residents want attention on public commitments." }, choices: { help: { ms: "Taja acara penuh", en: "Sponsor the full event" }, compromise: { ms: "Adakan acara kecil", en: "Hold a smaller event" }, refuse: { ms: "Utamakan penduduk", en: "Prioritise residents" } } },
  { title: { ms: "Calon pilihan akar umbi", en: "The grassroots favourite" }, description: { ms: "Rakan anda mahu latihan khas untuk calon kesayangannya. Pasukan dasar mahu pemilihan terbuka kepada semua ahli.", en: "Your ally wants special training for a favoured candidate. The policy team wants an open process for all members." }, choices: { help: { ms: "Biayai calon pilihan", en: "Fund the favoured candidate" }, compromise: { ms: "Kongsi sesi latihan", en: "Share the training sessions" }, refuse: { ms: "Kekalkan proses terbuka", en: "Keep the process open" } } },
  { title: { ms: "Tekanan daripada cawangan", en: "Pressure from the branches" }, description: { ms: "Ketua cawangan menuntut jelajah khas dan mengancam menarik sokongan. Pengundi meminta laporan kemajuan awam.", en: "Branch leaders demand a special tour and threaten to withdraw support. Voters are asking for a public progress report." }, choices: { help: { ms: "Biayai jelajah parti", en: "Fund the party tour" }, compromise: { ms: "Gabungkan dengan dialog awam", en: "Combine it with a public forum" }, refuse: { ms: "Terbitkan laporan awam", en: "Publish the public report" } } },
];
