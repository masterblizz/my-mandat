# MyMandat Improvement Suggestions

Status key:
- DONE = already implemented and verified
- IN PROGRESS = currently being implemented
- TODO = not implemented yet

Last updated: 2026-07-02

## Storyline transition layer — DONE
Adds the missing narrative bridge so the game no longer jumps from one raw phase button to another.

Implemented:
- New `/mandate` screen after results to classify outcome: clear mandate, hung parliament, strong opposition, or mandate rejected.
- New `/formation` screen for Istana/confidence check and coalition talks before cabinet formation.
- Cabinet now flows from formation and advances to `/swearing-in`, not straight to government.
- New `/swearing-in` cinematic screen for official cabinet oath before starting first 100 days.
- New `/opposition` screen for failed government formation / election defeat with shadow cabinet and comeback strategy.
- New `/postmortem` screen for heavy defeat with party rebuild agenda.
- Results button now says “Sahkan Mandat” and always routes into the storyline bridge.
- War Room is locked after swearing-in/government/opposition/postmortem modes.

## 1. PRN mode / State election mode — DONE
Add mode selection between PRU and PRN.

Implemented:
- Setup screen has PRU / PRN selector.
- PRN shows state selector.
- Settings page has PRU / PRN selector.
- War Room shows PRN command briefing, selected state, PRN state seats, PRN timeline and PRN map title.
- Verified with typecheck, production build, and browser screenshots.

## 2. Cabinet gameplay effects — DONE
Make cabinet appointments affect gameplay instead of being cosmetic.

Implemented:
- Finance and Trade appointments affect government funds/economy bonus.
- Communications appointment affects media/comms bonus.
- DPM, Home Affairs and Defence appointments affect stability.
- Education, Health, Women/Family and Youth appointments affect public trust.
- Weak or mismatched appointments increase scandal risk.
- Cabinet screen now displays a live “Kesan Kabinet / Cabinet Effects” panel tied to current assignments.
- New `/government` Phase 2 screen added for post-election governing: policy agenda, approval, public trust, coalition stability, fiscal space and crisis decisions.
- Verified with typecheck, production build, and browser screenshot.

## Phase 3 — Multi-term political career — DONE
Game now continues beyond one election and one governing phase.

Implemented:
- New `/career` screen for multi-term political career.
- Legacy score tracks long-term political reputation.
- Career index tracks faction control, party machinery and next PRU readiness.
- PRN and PRK risk panels show mid-term electoral pressure.
- Career actions include PRN test, PRK machinery, party election, government/opposition mode and next PRU narrative.
- Time advances by month inside each term before the next PRU window opens; 60 months complete one five-year term.
- Party internal politics panel tracks Reformists, State Warlords, Youth Wing and Borneo Bloc demands.
- Supports Government Mode if player has majority and Opposition Mode if player lacks majority.
- Navigation from Phase 2 Government to Phase 3 Career added.

## Phase 4 — Full Malaysia political sandbox — DONE
Adds a national sandbox layer for long-term governing beyond election cycles.

Implemented:
- New `/sandbox` screen for Malaysia-wide political simulation.
- National outcome scenario system: stable reformist Malaysia, fragile coalition, economic pressure, or competitive sandbox.
- Sandbox metrics: economy, federal-state relations, parliament, institutions, international position.
- National policy levers: targeted subsidy, MA63/Borneo autonomy, anti-corruption reform, media freedom, investment corridor, parliament reform.
- Federal-state relation panel with stronghold and pressure states.
- Parliament & institutions panel with effective majority, fiscal space, media/court pressure and PRU/PRN mode.
- Alternate history log explaining how policy choices affect the future.
- Navigation from Phase 3 Career to Phase 4 Sandbox added.

## 3. Minister loyalty and faction system — PARTIALLY DONE
Each minister can have loyalty, ambition, faction, popularity and scandal risk.

Possible events:
- Leaks to media.
- Threatens to quit party.
- Demands bigger portfolio.
- Becomes faction leader.

## 4. Coalition negotiation screen — TODO
After election results, if player lacks majority, require coalition negotiation.

Possible demands:
- DPM post.
- Key ministry.
- Policy concession.
- State allocation.
- Confidence and supply agreement.

## 5. Cabinet photo polish — DONE
Improve current cabinet portrait presentation.

Implemented:
- Bigger PM, DPM and minister images.
- Official portrait card style with PM/DPM/MIN/MP labels.
- Party colour stripe on portraits and minister cards.
- Cleaner cabinet card layout with official-card visual treatment.
- Better visual hierarchy for PM, DPM and ministers.
- Appointment panel rows retain profile photos.
- Verified with typecheck, production build, and browser screenshot.

## 6. Minister profile modal — TODO
Click a minister to open a full profile modal.

Show:
- Large portrait.
- Name and portfolio.
- State base.
- Specialty.
- Influence, credibility, charisma.
- Loyalty and risk.
- Why AI advisor selected them.

## 7. News reaction after cabinet appointment — TODO
Generate media/public reactions after cabinet appointment.

Examples:
- Markets positive after Finance Minister appointment.
- Grassroots angry due to regional underrepresentation.
- Technocrat cabinet praised.
- Controversial appointment criticised by opposition.

## 8. Regional balance system — TODO
Cabinet should reward balanced representation.

Regions:
- Semenanjung.
- Sabah.
- Sarawak.
- Pantai Timur.
- Johor.
- Lembah Klang.

Penalty if cabinet too concentrated in one region.

## 9. Gender / youth / ethnic representation score — TODO
Add cabinet representation metrics.

Metrics:
- Youth representation.
- Women representation.
- Sabah/Sarawak representation.
- Malay/Chinese/Indian/Bumiputera balance.
- Technocrat vs politician balance.

## 10. PRN campaign issues — TODO
Each state should have unique PRN issues.

Examples:
- Selangor: water, housing, urban voters.
- Kelantan: clean water, religion, youth migration.
- Kedah: padi, flood, rural Malay voters.
- Penang: housing, development, urban voters.
- Terengganu: religion, oil royalty, youth jobs.
- Johor: Singapore economy, cost of living, urban-rural split.
- Sabah: MA63, infrastructure, water, electricity.
- Sarawak: autonomy, development, rural seats.

## 11. Tactical map improvement — TODO
Add deeper tactical overlays to the map.

Ideas:
- PRN hotspots.
- Marginal DUN/parliament seats.
- Opponent stronghold.
- Swing district.
- Ceramah impact radius.
- Social media sentiment heatmap.

## 12. Manifesto system — TODO
Player chooses campaign manifesto.

Manifesto options:
- Economy package.
- Anti-corruption.
- Religious/conservative.
- Multiracial reform.
- Rural development.
- Sabah/Sarawak autonomy.
- Youth jobs.

Each manifesto gives voter bloc bonuses and trade-offs.

## 13. Debate / TV appearance mini-game — TODO
Add major campaign event mini-games.

Events:
- PM/MB candidate debate.
- Press conference.
- Viral scandal response.
- Youth townhall.
- Ceramah mega.

Tone choices:
- Calm.
- Attack.
- Populist.
- Technocratic.
- Religious.
- Reformist.

## 14. Election night drama — TODO
Improve Malam Keputusan.

Features:
- Seat-by-seat reveal.
- Kingmaker state.
- Too close to call.
- Recount.
- Postal vote swing.
- Late rural boxes.
- Borneo seats arriving late.

## 15. Save game polish — PARTIALLY DONE
Current save/load exists, but can be improved.

Already implemented:
- Load Game route/menu exists.
- Save/load behavior exists.
- Intro does not replay on load/setup.

Remaining:
- 5 save slots with thumbnails.
- Autosave label.
- Campaign name.
- PRU/PRN tag.
- Party logo.
- Current day.
- Last route.

## 16. Party HQ / War Room upgrades — TODO
Add permanent campaign machinery upgrades.

Upgrades:
- Data analytics team.
- Social media unit.
- Ground machinery.
- Legal team.
- Polling unit.
- Fundraising network.
- Rapid response team.

## 17. More aggressive opponent AI — DONE
Opponent should actively counter player strategy.

Opponent actions:
- Attack manifesto. — DONE (`manifesto_attack` action type in `opponentAI.ts`, national credibility damage)
- Expose scandal. — DONE (existing `scandal` action type)
- Target swing states. — DONE (existing `pressure` action type)
- Steal candidate. — DONE (`candidate_poach` action type, targets a contested state's local figure)
- Form coalition. — DONE (`coalition_form` action type, consolidates smaller parties into LAWAN's camp in the state MANDAT is trailing worst)
- Launch viral campaign / flood TikTok/social media narrative. — DONE (`viral_social` action type, frequent low-magnitude national chip damage, distinct from `media_blitz`'s TV/billboard/radio framing)

All six action types verified firing in a live 28-day passive-play run (Nightmare) with zero console errors.

Also fixed: difficulty selected at Setup was never reaching the opponent AI's
difficulty multiplier (stuck reading a stale top-level `state.difficulty`
instead of `state.settings.difficulty`) — "Nightmare" behaved identically to
"Normal". Now synced in `gameStore.ts`'s `updateSettings`.

## 18. MB Candidate for PRN — TODO
PRN mode should require Menteri Besar / Ketua Menteri candidate.

Candidate archetypes:
- Popular local figure.
- Religious figure.
- Technocrat.
- Youth reformer.
- State warlord.

MB candidate gives PRN-specific bonuses.

## 19. Endgame report card — TODO
After game ends, show final performance report.

Metrics:
- Seats won.
- Popular vote.
- Cabinet quality.
- Coalition stability.
- Regional support.
- Voter bloc support.
- Biggest mistake.
- Best strategy.
- Historical rating.

## 20. UI polish priority — PARTIALLY DONE
High-impact UI polish list.

Already implemented:
- Cabinet hierarchy view.
- Minister/cabinet images.
- PRN mode selector.

Remaining:
- Cabinet effect score.
- Election night animation.
- News reaction after cabinet appointment.
- Minister detail modal.

## Recommended next implementation order
1. Finish cabinet photo polish.
2. Cabinet gameplay effects.
3. Minister profile modal.
4. PRN MB candidate.
5. News reaction after cabinet appointment.
