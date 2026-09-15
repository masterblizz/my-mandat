// Event dates (not substitute days off). Moving dates must be verified per
// year; never reuse last year's lunar dates or estimate them astronomically.
// Source: https://www.kabinet.gov.my/storage/2025/08/HKA-2026.pdf
export type FestivalId = 'merdeka' | 'malaysia' | 'raya' | 'aidiladha' | 'cny'
  | 'deepavali' | 'christmas' | 'wesak' | 'thaipusam' | 'kaamatan' | 'gawai';
export type Festival = {
  id: FestivalId; ms: string; en: string; colors: readonly string[];
  motif: 'flag' | 'ketupat' | 'lantern' | 'light' | 'tree' | 'harvest';
};
export const FESTIVALS: readonly Festival[] = [
  { id: 'merdeka', ms: 'Hari Kebangsaan', en: 'Independence Day', colors: ['#cf233b', '#f8f4de', '#153b8b', '#f5c94c'], motif: 'flag' },
  { id: 'malaysia', ms: 'Hari Malaysia', en: 'Malaysia Day', colors: ['#153b8b', '#f8f4de', '#cf233b', '#f5c94c'], motif: 'flag' },
  { id: 'raya', ms: 'Hari Raya Aidilfitri', en: 'Hari Raya Aidilfitri', colors: ['#2fa66a', '#e7c65a'], motif: 'ketupat' },
  { id: 'aidiladha', ms: 'Hari Raya Aidiladha', en: 'Hari Raya Aidiladha', colors: ['#21866c', '#efdd9f'], motif: 'ketupat' },
  { id: 'cny', ms: 'Tahun Baharu Cina', en: 'Chinese New Year', colors: ['#dd2937', '#f4bd45'], motif: 'lantern' },
  { id: 'deepavali', ms: 'Deepavali', en: 'Deepavali', colors: ['#e8902e', '#db4d97', '#9c66db', '#f6d36a'], motif: 'light' },
  { id: 'christmas', ms: 'Krismas', en: 'Christmas', colors: ['#2e8b57', '#d94242', '#f3d994'], motif: 'tree' },
  { id: 'wesak', ms: 'Hari Wesak', en: 'Wesak Day', colors: ['#477cdb', '#f3cf46', '#da4248', '#faf1da', '#f49944'], motif: 'lantern' },
  { id: 'thaipusam', ms: 'Thaipusam', en: 'Thaipusam', colors: ['#f2bb36', '#f29233', '#f6edd4'], motif: 'light' },
  { id: 'kaamatan', ms: 'Pesta Kaamatan', en: 'Kaamatan Harvest Festival', colors: ['#e3bd65', '#ae4433', '#343438'], motif: 'harvest' },
  { id: 'gawai', ms: 'Hari Gawai', en: 'Gawai Dayak', colors: ['#c84c3b', '#e8cd86', '#353438'], motif: 'harvest' },
];
const FIXED: Partial<Record<FestivalId, string>> = {
  merdeka: '08-31', malaysia: '09-16', christmas: '12-25', kaamatan: '05-30', gawai: '06-01',
};
const MOVING: Record<number, Partial<Record<FestivalId, string>>> = {
  2026: { cny: '02-17', raya: '03-21', aidiladha: '05-27', wesak: '05-31', deepavali: '11-08', thaipusam: '02-01' },
};
const DAY = 86_400_000;
export function malaysiaDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function activeFestivals(dateKey: string): Festival[] {
  const year = Number(dateKey.slice(0, 4));
  const today = Date.parse(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(today)) return [];
  return FESTIVALS.map(festival => {
    const md = FIXED[festival.id] ?? MOVING[year]?.[festival.id];
    const distance = md ? (today - Date.parse(`${year}-${md}T00:00:00Z`)) / DAY : Infinity;
    return { festival, distance };
  }).filter(({ distance }) => distance >= -7 && distance <= 2)
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))
    .map(({ festival }) => festival);
}
