// Prints the region + seat seed used by supabase/migrations/20261102_regional_worlds_and_elections.sql.
// Run: npx tsx scripts/online/gen-region-seats.ts
import { ONLINE_REGIONS as REGIONS, regionSeats } from "../../app/lib/onlineRegions";



const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const regionRows: string[] = [];
const seatRows: string[] = [];
REGIONS.forEach((region, index) => {
  const seats = regionSeats(region.id);
  if (!seats.length) throw new Error(`No seats for ${region.id}`);
  regionRows.push(`  (${q(region.id)}, ${q(region.nameMs)}, ${q(region.nameEn)}, ${q(region.headMs)}, ${q(region.headEn)}, ${index + 1}, ${seats.length})`);
  seats.forEach((seat, order) => seatRows.push(`  (${q(seat.id)}, ${q(region.id)}, ${q(seat.code)}, ${q(seat.name)}, ${seat.voters}, ${order + 1})`));
});
console.log(`insert into public.world_regions(id, name_ms, name_en, head_title_ms, head_title_en, rotation_order, seat_count) values\n${regionRows.join(",\n")}\non conflict (id) do update set name_ms = excluded.name_ms, name_en = excluded.name_en, head_title_ms = excluded.head_title_ms, head_title_en = excluded.head_title_en, rotation_order = excluded.rotation_order, seat_count = excluded.seat_count;\n`);
console.log(`insert into public.world_region_seats(constituency_id, region_id, code, name, voters, seat_order) values\n${seatRows.join(",\n")}\non conflict (constituency_id) do update set region_id = excluded.region_id, code = excluded.code, name = excluded.name, voters = excluded.voters, seat_order = excluded.seat_order;`);
