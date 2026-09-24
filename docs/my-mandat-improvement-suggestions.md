# MyMandat Improvement Suggestions

Status key:
- DONE = implemented; verification scope is recorded below
- PARTIALLY DONE = core behavior exists, with remaining work listed
- IN PROGRESS = currently being implemented
- TODO = not implemented yet

Last updated: 2026-09-19

## Latest game-flow improvement checklist

Implementation baseline: current `main`. See [CAREER_LOOP.md](CAREER_LOOP.md)
for the current rules. The five core game-flow stages and twenty-four items in
the current implementation sequence are complete. Outstanding work is grouped
separately below so implementation tasks and validation tasks are easy to track.

### Current implementation sequence

- [x] Reproducible PRU/PRN balance audit and projection corrections.
- [x] Branching character stories with persistent consequences.
- [x] Coalition deal structures with budget, seat and cabinet trade-offs.
- [x] Minister profiles, loyalty, defections and cabinet representation effects.
- [x] State-specific PRN issues with channel fit and diminishing returns.
- [x] Tactical map overlays for hotspots, marginal seats and campaign reach.
- [x] Broader manifesto packages with voter-bloc trade-offs.
- [x] Debate and TV appearance campaign events.
- [x] Election-night seat reveal and late-count drama.
- [x] Scripted full PRN/opposition/rebuilding journeys and responsive-layout hardening.
- [x] PRN MB/Ketua Menteri candidate differentiation.
- [x] Unified end-of-term report card.
- [x] Curated historical and hypothetical scenario packs.
- [x] Metro `/kawasan` realism polish with an animated urban river, retained green banks, road bridges and river-aware traffic paths.
- [x] Cinematic night-lighting pass with sparse occupied windows, balanced exposure/bloom and restrained landmark accents.
- [x] Varied metro skyline with five high-rise profiles, restrained material variation and deterministic height rhythm.
- [x] Tropical daylight art direction with a blue-cyan horizon, neutral terrain bounce and clearer material separation.
- [x] Collision-safe Malaysian traffic with left-lane junction paths, predictive braking, body-aware queue spacing and correct turn orientation.
- [x] Weather-responsive city canopy with phased broadleaf, conifer and palm movement that strengthens naturally in rain.
- [x] Cinematic vehicle feedback with distance-driven wheel rotation and responsive brake-light intensity.
- [x] Rain-aware street life with individually coloured umbrellas that remain attached to moving pedestrians.
- [x] Coherent storm atmosphere with wind-angled rain, animated ground splashes and overcast wet-surface reflections.
- [x] Readable junction intent with amber vehicle indicators that begin before each protected left turn.
- [x] Resilient Premium entitlement check that exits loading safely during missing configuration, network failure or an unresponsive auth service.

### Not completed yet

- [ ] **NEXT:** Complete an authenticated Premium PRN browser journey plus an opposition/rebuilding return journey.
- [ ] Authenticated feature pass for coalition deals, branching stories, cabinet profiles and representation, PRN issues, tactical-map layers, and debate/TV events.
- [ ] Election-night controls and mobile-layout validation for both PRU and PRN, followed by a complete new-player mobile journey.
- [ ] Human balance playtest covering difficulty, economy, dominant strategies, pacing and replayability.
- [ ] Named coalition-partner representatives with deeper policy-concession negotiation.
- [ ] Cabinet-wide media headlines based on the final representation mix.
- [ ] Save-slot presentation: thumbnails, autosave label, campaign name, PRU/PRN tag, party logo and exact last-screen resume.
- [ ] Permanent Party HQ / War Room machinery upgrades: analytics, social media, ground, legal, polling, fundraising and rapid response teams.

### 1. Connect the full political career — DONE

- [x] Campaign → results → mandate → coalition → cabinet → ceremony → governing.
- [x] Opposition and rebuilding paths with real progression.
- [x] Coalition seats drawn from the election result and agreements persisted.
- [x] Saved cabinet appointments carried into the ceremony and governing term.
- [x] Next election at month 60, retaining commitments, city development and legacy.
- [x] Save/load and Continue resume the current chapter.

### 2. Make daily choices meaningful — DONE

- [x] Daily briefing and three major decisions per campaign day.
- [x] Visits, fundraising and organiser training with resource/support effects.
- [x] Tactical deployments and stories share the daily decision allowance.
- [x] Safe/balanced/aggressive tactics charge different actual costs.
- [x] Affordability and repeat-action safeguards; cause/effect journal.

### 3. Connect promises to delivery and reelection — DONE

- [x] Flood, clinic and jobs commitments made during campaigns.
- [x] Public development budget separate from campaign funds.
- [x] Two-quarter construction and visible completed constituency projects.
- [x] Delivery, trust, organisation and unfinished promises affect the next election.
- [x] Policies resolve on the quarterly clock; finished terms reject further actions.

### 4. Add characters, negotiation and scenarios — DONE

- [x] Eight non-repeating dilemmas with persistent character relationships.
- [x] Scenario-specific choices can change money, trust, stability, organisation and local support.
- [x] Earlier decisions unlock or prevent later follow-up stories.
- [x] Coalition allocation demands reduce the opening public budget.
- [x] Guided fictional starts centred on flood protection, clinics or jobs.
- [x] Six curated scenario packs: three history-inspired PRU campaigns and three hypothetical PRU/PRN futures.
- [x] Scenario-specific resources, support geography, trust, organisation, opponent/media pressure and live objectives.
- [x] Coalition partners offer development, portfolio, or confidence-and-supply deals.
- [x] Deal structures change supporting seats, opening budget, stability and effective cabinet quality.
- [x] Add persistent minister loyalty, ambition, factions and defections during weak governments.
- [ ] Add named coalition-partner representatives to the cabinet.

### 5. Improve onboarding and presentation — CORE DONE

- [x] Guided start alongside detailed setup.
- [x] BM/EN next-step guidance, costs and remaining-action feedback.
- [x] Player portrait and term/chapter identity in career briefings.
- [x] Project-delivery celebrations respecting reduced motion.
- [x] Responsive breakpoint hardening for campaign, War Room, election night, results, mandate, formation and cabinet screens.
- [ ] Conduct new-player usability and mobile-layout testing across the full journey.

### Verification and remaining validation

- [x] 44 journey regression tests passed, including daily PRU/PRN projection consistency, branching stories, scenario-pack starting conditions/objectives, coalition trade-offs, cabinet representation, defections, PRN issue momentum, MB/Ketua Menteri candidate trade-offs, end-of-term report grading/persistence, tactical-map classification, manifesto trade-offs, bilingual incoming-event coverage, major campaign events, exact PRU/PRN election-night counts and full opposition/rebuilding return journeys.
- [x] Reproducible 720-campaign balance baseline recorded in [balance-baseline-2026-09-17.md](balance-baseline-2026-09-17.md).
- [x] Corrected daily PRN projections to use DUN counts and the election-result model.
- [x] TypeScript check and production build passed (45 pages generated).
- [x] Browser: guided start, BM/EN briefing, daily limits, election and formation flow.
- [x] Browser: clinic funding, reload recovery, delivery celebration and constituency project.
- [x] Browser: full governing term, second campaign and fresh election result.
- [x] Browser: local-fallback PRU scenario start, manifesto effects, BM/EN War Room briefing, all six tactical-map layers, calendar detail, debate tone selection and result reveal.
- [x] Browser: Premium entitlement failure exits “checking” after a bounded wait, shows PRN locks correctly and leaves the setup screen interactive without console errors.
- [x] PRN scope/majority and opposition progression covered by regression tests.
- [x] Scripted full PRN defeat → opposition → second election and PRU collapse → rebuilding → second election journeys.
- [ ] Complete a full PRN browser playthrough and an opposition/rebuilding browser run.
- [ ] Browser-check the new coalition deal selector, conditional follow-up stories, cabinet profiles and representation panel in an authenticated browser session.
- [ ] Browser-check PRN issue selection, channel-fit feedback and diminishing returns in an authenticated campaign.
- [ ] Browser-check all PRN tactical-map layers and reduced-motion reach rings, then repeat the PRU layer pass in an authenticated campaign.
- [ ] Browser-check debate/TV event scheduling, tone selection and result reveals in PRN, then repeat the PRU event pass in an authenticated campaign.
- [ ] Browser-check election-night pacing, pause/fast/skip controls and mobile layout in PRU and PRN.
- [ ] Playtest difficulty, dominant strategies, pacing, replayability and economy balance.

The remaining sections retain the broader backlog. Earlier claims about cabinet
bonuses and the career screen have been updated to match the current implementation.

## Storyline transition layer — DONE
Adds the missing narrative bridge so the game no longer jumps from one raw phase button to another.

Implemented:
- New `/mandate` screen after results to classify outcome: clear mandate, hung parliament, strong opposition, or mandate rejected.
- New `/formation` screen for Istana/confidence check and coalition talks before cabinet formation.
- Cabinet now flows from formation and advances to `/swearing-in`, not straight to government.
- New `/swearing-in` cinematic screen for official cabinet oath before starting first 100 days.
- `/opposition` provides organisation, trust and comeback actions after defeat or failed formation.
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
- Appointments persist and determine cabinet quality.
- Cabinet quality of 70 or above adds one trust point per quarter; lower quality subtracts one.
- Cabinet Effects shows quality, representation, loyalty and the combined quarterly effect.
- Candidate profiles expose faction, ambition, scandal risk, regional/community base
  and persistent loyalty; unstable governments can suffer minister defections.
- `/government` provides public budgets, policies, projects, trust, stability and recurring dilemmas.
- Deeper ministry-specific policy effects remain future work.

## Phase 3 — Multi-term political career — DONE
Game now continues beyond one election and one governing phase.

Implemented:
- Shared career dashboard supports governing, opposition and rebuilding.
- Time advances in quarters until month 60, then starts an actual new campaign.
- Term records retain seats, public trust and completed commitments.
- Branch building, candidate training and policy scrutiny affect organisation/trust.
- Persistent relationships and unfinished promises carry consequences across terms.
- Earlier illustrative faction/readiness panels are superseded by this playable loop; mid-term PRN/PRK contests and party elections remain future work.

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

## 3. Minister loyalty and faction system — DONE
Each minister has loyalty, ambition, faction and scandal risk. A separate public
popularity score remains a possible extension.

Implemented:
- Every candidate has a visible faction, loyalty, ambition and scandal-risk profile.
- Minister loyalty persists in saves and rises or falls with government stability.
- At-risk ministers reduce cabinet stability and highly ambitious, very disloyal
  ministers can leave the administration during a quarterly turn.
- Defections vacate the relevant portfolio, reduce trust/stability and enter the
  persistent political journal and incident history.
- Recurring story allies continue to have separate relationship scores.

Possible events:
- Leaks to media.
- Threatens to quit party.
- Demands bigger portfolio.
- Becomes faction leader.

## 4. Coalition negotiation screen — DONE
After election results, if player lacks majority, require coalition negotiation.

- [x] Formation screen, actual available partner seats, majority check and saved agreement.
- [x] Public-budget allocation demands with real opening-budget costs.
- [x] Portfolio bargaining and confidence-and-supply agreements have distinct trade-offs.
- [ ] Named partner representatives and detailed policy-concession negotiations can extend the system later.

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

## 6. Minister profile modal — DONE
Click a minister to open a full profile modal.

Implemented:
- Profile control on every appointment candidate, with a large portrait and role.
- State base, region, community, faction, specialty and experience context.
- Influence, credibility, charisma, persistent loyalty, ambition and scandal risk.
- Bilingual adviser assessment explaining the appointment's strengths and risks.

## 7. News reaction after cabinet appointment — PARTIALLY DONE
Generate media/public reactions after cabinet appointment.

Current implementation: each appointment creates a named political reaction based
on the member, portfolio, assignment score, party and PRU/PRN context. Cabinet-wide
reaction headlines based on the final representation mix remain open.

Examples:
- Markets positive after Finance Minister appointment.
- Grassroots angry due to regional underrepresentation.
- Technocrat cabinet praised.
- Controversial appointment criticised by opposition.

## 8. Regional balance system — DONE
Cabinet should reward balanced representation.

Implemented:
- Federal cabinets score northern, central, southern, east-coast and Borneo reach.
- Sabah/Sarawak representation receives an explicit federal target.
- PRN EXCOs use selected-state representation rather than an irrelevant federal
  Borneo target.
- Concentrated cabinets lose quarterly trust and can weaken stability.

## 9. Gender / youth / ethnic representation score — DONE
Add cabinet representation metrics.

Implemented metrics:
- Women representation.
- Emerging/rising leadership representation.
- Sabah/Sarawak representation for federal cabinets or selected-state depth for PRN.
- Malay, Chinese, Indian, Sabah and Sarawak community breadth.
- Regional reach, average loyalty and at-risk minister count.
- The resulting score has a visible and persistent quarterly trust effect.

## 10. PRN campaign issues — DONE
Each state should have unique PRN issues.

Implemented:
- Every PRN-eligible state has three bilingual issues, a target voter bloc and a
  preferred campaign channel.
- The daily briefing and War Room display the selected state's actual priorities.
- State issues appear as selectable ceramah/social-media mini-game topics.
- Matching the issue to its preferred channel gives a real support bonus and clear
  feedback in the cause/effect journal.
- Repeating one issue has diminishing returns, encouraging a broader campaign.
- Issue coverage persists in save data and remains isolated to the selected PRN state.

Examples now in play include Selangor water/housing/transport, Kelantan clean
water/youth migration, Kedah padi/floods, Penang housing/development, Terengganu
oil royalties/youth jobs, Johor cross-border economics, Sabah MA63/utilities and
Sarawak autonomy/rural connectivity.

## 11. Tactical map improvement — DONE
Add deeper tactical overlays to the map.

Implemented:
- Six selectable War Room layers: base position, marginal contests, LAWAN
  strongholds, swing hotspots, campaign reach and sentiment heatmap.
- PRN layers classify and recolor individual DUN points using their simulated vote
  margins; PRU shades state risk while counting and naming priority parliamentary seats.
- Active field operations create orange reach rings while digital/youth operations
  create wider cyan rings. Reduced-motion preference disables their animation.
- The sentiment layer combines local support direction, daily trend, media mood and
  active digital campaigning.
- Each layer reports the number of flagged targets and names its strongest target.
- Hover details explain why a DUN or state matches the selected tactical filter.

## 12. Manifesto system — DONE
Player chooses campaign manifesto.

- [x] Flood, clinic and jobs promises with funding, delivery and reelection consequences.
- [x] Seven broader ideological packages with distinct voter-bloc and regional trade-offs.
- [x] One package per election, with a real funding cost, one major decision and an organisation effect.
- [x] Immediate state-by-state support and seat-projection changes; PRN effects stay inside the selected state.
- [x] Persistent selection/history and fresh selection at the next election.
- [x] Follow-through bonuses when rallies or social campaigning match the package, shown in previews and the cause/effect journal.

Manifesto options:
- Economy package.
- Anti-corruption.
- Religious/conservative.
- Multiracial reform.
- Rural development.
- Sabah/Sarawak autonomy.
- Youth jobs.

Each manifesto gives voter bloc bonuses and trade-offs.

## 13. Debate / TV appearance mini-game — DONE
Add major campaign event mini-games.

Implemented:
- Five scheduled, one-time events per election: PM/MB candidate debate, press
  conference, viral scandal response, youth town hall and closing mega rally.
- Six performance tones: calm, attack, populist, technocratic, religious and reformist.
- Results combine leader charisma/credibility/strategy, event fit, state voter
  demographics, manifesto alignment, media mood and difficulty.
- Every appearance consumes one major decision plus actual campaign funds, media
  and manpower, then changes support and seat projections in the relevant PRU/PRN scope.
- Bilingual studio selection, audience and risk guidance, result reveal, strongest/
  weakest state feedback, news reaction, alert and cause/effect journal.
- Completed events and outcomes persist in saves and become available again in a new term.

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

## 14. Election night drama — DONE
Improve Malam Keputusan.

Implemented:
- Full seat-by-seat live declaration sequence using the same deterministic PRU/PRN
  constituency results as the official outcome.
- Live MANDAT/LAWAN/others tallies, majority marker, declared-seat progress and
  rolling declaration log.
- Too-close-to-call, postal-vote swing and recount bulletins tied to the closest
  actual simulated seats.
- Rural boxes and Sabah/Sarawak declarations are held for the late count, with a
  separate Borneo arrival bulletin in PRU mode.
- A data-driven kingmaker-state bulletin highlights the state with the strongest
  combination of close contests and smaller-bloc seats.
- Pause, 3× speed, skip and official-result controls; reduced-motion users go
  straight to the final accessible result.
- PRN uses only the selected state's DUN and its actual majority threshold.

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
- Five save slots and autosave rewriting the active slot.
- Current chapter resume and persisted coalition, cabinet, projects, relationships and legacy.
- Older-save defaults and legacy city migration.

Remaining:
- Save-slot thumbnails.
- Autosave label.
- Campaign name.
- PRU/PRN tag.
- Party logo.
- Exact last-screen resume (current implementation resumes the appropriate chapter).

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

## 18. MB Candidate for PRN — DONE
PRN mode should require Menteri Besar / Ketua Menteri candidate.

Candidate archetypes:
- Popular local figure.
- Religious figure.
- Technocrat.
- Youth reformer.
- State warlord.

Implemented:
- PRN setup requires one of five named leadership candidates before continuing.
- Each archetype has bilingual strengths, risks and a demographic fit score for the selected state.
- Nomination changes only that PRN state's opening support, plus persistent trust and organisation.
- Preferred rally/social channels and debate tones give real campaign bonuses; weak fits can penalise performance.
- The nominee persists in save data and appears in the War Room, results, mandate, formation and swearing-in flow.
- Formation confidence reflects the nominee's governing and bargaining profile.

## 19. Endgame report card — DONE
After game ends, show final performance report.

- [x] Election results and term legacy records for seats, trust and commitments delivered.
- [x] Unified report with strategy assessment, biggest mistake and historical rating.

Implemented:
- Month 60 now opens the report before the next-election action can run.
- The report scores seats, popular vote, trust, delivered promises, cabinet/EXCO quality, stability and organisation.
- Regional and voter-bloc support are derived from the actual in-scope PRU or PRN state data.
- Actual campaign events, manifesto, delivery, cabinet incidents and term readiness determine the best strategy and biggest mistake.
- A 0–100 historical rating and bilingual verdict compare the current term with earlier saved reports.
- The complete report persists in the career record when the next election begins.

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
- Actual cabinet effect score, guided starts, BM/EN career briefings and delivery celebrations.
- Interactive PRU/PRN tactical map overlays and campaign-reach visualization.
- Seat-by-seat election-night animation with pause, speed and skip controls.
- Full minister profile modal with political and performance attributes.

Remaining:
- Cabinet-wide news reaction based on the completed appointment mix.
- Authenticated end-to-end and mobile usability validation.

## Recommended next implementation order
1. Authenticated PRN, opposition/rebuilding, election-night and mobile usability validation.
2. Human difficulty, pacing, economy and replayability playtest.
3. Save-slot presentation and exact last-screen resume.
4. Permanent Party HQ / War Room machinery upgrades.
5. Named coalition representatives and cabinet-wide media reactions.
