# Date-based Malaysian city celebrations

The live city and demo use the real `Asia/Kuala_Lumpur` date, refreshed every
30 seconds and when a browser tab becomes visible. The visual day/night
button and game turns do not affect the celebration calendar.

Decorations run from seven days before an event through two days afterward.
This is a visual decoration window, not a claim about public-holiday length.
Overlapping celebrations share the available street-front locations.

Supported: Hari Kebangsaan, Malaysia Day, Aidilfitri, Aidiladha, Chinese New
Year, Deepavali, Christmas, Wesak, Thaipusam, Kaamatan and Gawai.
Themes use flags, lanterns, ketupat forms, festive lights, tree ornaments
and harvest-coloured decorations with Malay/English banners. They appear
on plot-edge pavements, avoiding landmark plots and the roundabout.

Malaysia Day and Hari Kebangsaan use enlarged Jalur Gemilang bunting. At
night, KLCC's twin towers display red/white shaft bands, blue crowns and
gold spires, inspired by the national flag. This is an in-game lighting
design, not a claim about the towers' real lighting schedule. It follows
the same real-date decoration window and returns to ordinary lighting
outside that period or during day/dusk.

Aidilfitri and Aidiladha use green woven-leaf ketupat with diamond-shaped
bodies and two hanging leaf tails; their texture is shaded as palm strips
rather than flat coloured cubes.

## Calendar maintenance

2026 moving dates are from the [official BKPP JPM calendar](https://www.kabinet.gov.my/storage/2025/08/HKA-2026.pdf).
Religious dates marked subject to change by the source must be updated if
official announcements revise them. Substitute days off are not festival dates.
Fixed Gregorian dates recur annually. Moving dates are enabled only for
verified years in `app/kawasan-3d/festivals.ts`; currently that is 2026.
Add each new official year's dates there; unsupported years deliberately
omit moving festivals rather than reuse incorrect dates.

These celebrate Malaysia's cultural calendar across the city; they do not
assert that every event is a statutory holiday in the selected state.

Run `node scripts/verify-festival-calendar.mjs` for calendar boundary checks.

## Verification

Production build, TypeScript, and calendar checks passed. An isolated
browser fixture using the built demo verified the Malaysia Day and Chinese
New Year badges against controlled dates and real preset-button clicks.
The [Malaysia Day capture](qa-screenshots/festival-malaysia.png) shows the
flags and banners. The Chinese New Year screenshot timed out under software
WebGL; the remaining themes have not all been visually inspected.

The national-lighting refinement passed TypeScript, production build and
calendar checks. A night-mode browser run with a real zoom-button click
reported no page/shader errors and produced the
[KLCC national-colour capture](qa-screenshots/klcc-malaysia-night.png).
The woven ketupat refinement has not yet received a close-up browser check.
