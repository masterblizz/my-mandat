# Campaign and career loop

Implemented September 2026. This supersedes the campaign/post-election behavior
in the earlier route audit, `GAME_FLOW.md`.

## Player journey

1. Choose a guided local issue (flood protection, clinic, or jobs), or use detailed setup.
2. Spend three major decisions per campaign day on promises, community visits,
   fundraising, organising, stories, or tactical deployments. End the day from the
   briefing or War Room to resolve opponents and ongoing operations.
3. Election night freezes the result. PRU counts parliamentary seats; PRN counts
   DUN seats in the selected state. The personal seat and party mandate are separate.
4. Confirm a majority using the actual available independent seats, save coalition
   commitments, appoint the cabinet, and attend the ceremony. Without government,
   enter opposition or rebuilding with an organisation and trust objective.
5. During the term, fund promises from the public budget and choose up to two
   political actions each quarter. Projects take two quarters. Cabinet quality,
   representation, minister loyalty, policies, delivery, relationships, and
   instability affect public trust and government stability.
6. At month 60, begin the next election. The term record changes starting support;
   unfinished promises remain obligations. Campaign resources reset while the city,
   relationships, promises, and political legacy persist.

## Choices and feedback

- Safe/balanced/aggressive tactical actions cost 1x/1.2x/1.8x their base funding.
  Insufficient resources or an exhausted daily allowance block the action.
- PRN campaigns surface three issues for the selected state. Choosing one in a
  rally or social-media mini-game earns extra support when the channel fits its
  target voters. Repeating an issue produces diminishing returns, and coverage
  persists in the campaign record.
- Each election offers seven manifesto packages: economy, anti-corruption,
  conservative values, multiracial reform, rural development, Borneo autonomy,
  or youth jobs. The choice costs funds and one major decision, immediately shifts
  each in-scope state according to its voter profile, and adds a smaller follow-through
  effect when the player uses the package's preferred campaign channel.
- The War Room map can switch between base, marginal-seat, LAWAN-stronghold,
  swing-hotspot, campaign-reach and sentiment layers. PRN resolves individual DUN
  points; PRU shades state risk while surfacing priority parliamentary seats. Reach
  rings reflect active field and digital operations.
- Eight non-repeating character dilemmas have scenario-specific effects. Earlier
  choices can unlock follow-up stories; poor relationships create term pressure.
- Coalition partners offer development allocations, portfolio access, or
  confidence-and-supply. Each structure changes seats, cost, stability, or cabinet
  freedom. Partner seats still come only from the simulated independent total.
- Cabinet candidates have profiles for faction, regional/community base, loyalty,
  ambition and scandal risk. A balanced cabinet earns trust; a concentrated cabinet
  loses it. Loyalty changes with government stability, and an ambitious minister
  can defect when loyalty collapses. PRN EXCO balance uses the selected state.
- Promised clinic, flood, and market projects become visible in the constituency
  after delivery. Other constituency construction also uses public funds and time.
- BM/EN briefings show remaining actions, next steps, costs, and a cause/effect journal.
  Delivery celebrations respect reduced-motion preferences.

## Persistence and safeguards

The typed `journey` save contains cabinet appointments and loyalty, minister
incidents, coalition agreements, manifesto choice/history, PRN issue coverage, projects, per-seat city zones,
stories, term records, and the frozen election result.
Autosave updates the active slot. Refresh and Continue resume the current chapter.
Older saves receive defaults and legacy constituency development is migrated.
Premature results/cabinet navigation is guarded; finished terms reject further actions.

## Validation

Run `node scripts/test-journey.cjs`, `npx tsc --noEmit --pretty false`, and
`npm run build`. The regression suite exercises scarcity, affordability, PRN scope,
coalition arithmetic, cabinet representation and defections, state-specific PRN
issue momentum, manifesto trade-offs and channel fit, tactical-map classification, persistence, project delivery,
story/policy repeat protection, opposition progression, and a second election.

Balance still requires player testing. Coalition blocs and story numbers are game
mechanics, not real political forecasts. The three introductory scenarios use the
fictional dataset; detailed setup retains the other available datasets.
