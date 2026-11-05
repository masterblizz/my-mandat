# Electoral boundaries

`dun/<state>.json` and `parlimen/<state>.json` hold each seat's boundary
(seat name in lower case → rings of `[lon, lat]`, rounded to 3 decimals and
simplified). Used by the city intro map (`app/kawasan-3d/CityIntro.tsx`).

Source: Department of Statistics Malaysia (DOSM), open data —
https://github.com/dosm-malaysia/data-open (`datasets/geodata/electoral_1_dun.geojson`,
`electoral_0_parlimen.geojson`), licensed CC BY 4.0. Regenerate with
`python3 scripts/build-boundaries.py <dun.geojson> <parlimen.geojson>`.
