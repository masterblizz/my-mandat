# City material polish

The live `/kawasan` page uses `City3DMapGL` from `app/kawasan-3d`; the
legacy CSS renderer is not changed in this pass.

- Corrected grass, paved-plot and soil albedo textures: mid-grey sRGB was
  multiplying already-coloured materials down to roughly 20% linear light.
  Near-white, seeded surface variation now preserves the intended palette.
- Environment reflections now include a terrain-coloured lower hemisphere
  rather than sky on both sides of the horizon.
- Reduced bloom and raised its threshold to retain concrete and facade
  detail, while keeping emissive windows and street lights luminous.

No building footprints, traffic routes, gameplay, texture dimensions or
quality-tier gates were changed. This is a material/lighting pass, not a
photorealistic asset replacement or a fix for the earlier clipping reports.

## Visual checks

Captured the live `/kawasan` page and the shared renderer's Metro demo in
Chromium (1440 x 1000):

- [Live map](qa-screenshots/city-polish-live.png)
- [Metro](qa-screenshots/city-polish-metro.png)

TypeScript, production build (44 pages), and whitespace checks passed.
The automated Dense metro preset
click timed out; rotated Dense metro and night views remain unverified.
The local live-page test used the application's existing missing-Supabase
development fallback, with process-only environment overrides; no auth code
or environment files were modified.
