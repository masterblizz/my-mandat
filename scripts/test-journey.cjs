// Run the actual TypeScript reducers/store without a browser or extra test dependencies.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { useGameStore: store } = require('../app/store/gameStore.ts');
const { coalitionPool, governingSeats, resumeRoute, newJourney, normalizeJourney } = require('../app/store/journey.ts');
const { createSaveSnapshot, getSavedGames, saveGameSnapshot, setActiveSaveSlot } = require('../app/store/saveGame.ts');
const { computeElectionOutcome } = require('../app/utils/electionOutcome.ts');
const { availableStories } = require('../app/data/careerStories.ts');
const { evaluateCabinet } = require('../app/data/cabinetDynamics.ts');
const { getPrnIssues, prnIssueActionKey } = require('../app/data/prnIssues.ts');
const { generateConstituencies } = require('../app/data/constituencies.ts');
const { seatTacticalVisual, stateTacticalVisual } = require('../app/data/tacticalMap.ts');
const { manifestoCampaignBonus, manifestoStateImpact } = require('../app/data/manifestoPackages.ts');
const { CAMPAIGN_EVENTS, CAMPAIGN_TONES, campaignEventStateImpact, isCampaignEventUnlocked } = require('../app/data/campaignEvents.ts');
const { buildElectionNightTimeline, electionNightSeatUpdates } = require('../app/data/electionNight.ts');
const { PRN_CANDIDATES, prnCandidateChannelBonus, prnCandidateStateImpact } = require('../app/data/prnCandidates.ts');
const { buildTermReport, termRatingBand } = require('../app/data/termReport.ts');
const { SCENARIO_PACKS, getScenarioPack, scenarioObjectiveProgress } = require('../app/data/scenarioPacks.ts');
const { gameEvents } = require('../app/data/events.ts');
let passed = 0;
function test(name, fn) { store.getState().resetGame(); fn(); passed++; console.log(`PASS ${name}`); }
function act(action) { store.getState().journeyAction(action); }
function patchJourney(patch) { store.setState(s => ({ journey: { ...s.journey, ...patch } })); }
function win(scope = 'pru') {
  store.setState(s => ({ phase: 'playing', day: s.totalDays, settings: { ...s.settings, electionScope: scope, prnStateId: 'selangor' }, states: s.states.map(x => ({ ...x, mandatSupport: 75, lawanSupport: 15, othersSupport: 10 })) }));
  store.getState().finishElection();
  store.getState().confirmCoalition([]);
  patchJourney({ appointments: { 'min-fin': 'pm-003' }, cabinetQuality: 80 });
  store.getState().enterTerm('government');
}
test('daily actions are scarce, repeat-safe and reset on the next day', () => {
  act({ type: 'campaign', action: 'visit' });
  act({ type: 'campaign', action: 'visit' });
  assert.equal(store.getState().journey.decisions, 2);
  act({ type: 'campaign', action: 'fundraise' });
  act({ type: 'campaign', action: 'organise' });
  const before = store.getState().resources.funds;
  act({ type: 'pledge', issue: 'flood' });
  assert.equal(store.getState().resources.funds, before);
  assert.equal(store.getState().journey.pledges.length, 0);
  store.getState().advanceDay();
  assert.equal(store.getState().journey.decisions, 3);
});
test('location activities spend real resources, write a journal entry and cannot be farmed', () => {
  const funds = store.getState().resources.funds;
  const organisation = store.getState().journey.organisation;
  store.getState().runLocationActivity('office', 'prepare');
  assert.equal(store.getState().resources.funds, funds - 10000);
  assert.equal(store.getState().journey.decisions, 2);
  assert.equal(store.getState().journey.organisation, organisation + 2);
  assert.match(store.getState().journey.journal[0].ms, /Persediaan di office selesai/);
  store.getState().runLocationActivity('office', 'prepare');
  assert.equal(store.getState().journey.decisions, 2);
  store.setState(s => ({ resources: { ...s.resources, funds: 0 } }));
  store.getState().runLocationActivity('media', 'commit');
  assert.equal(store.getState().journey.decisions, 2);
});
test('location objective rewards are one-time and office mail state persists in the journey', () => {
  store.setState(s => ({ states: s.states.map(state => state.id === s.leader.homeState ? { ...state, mandatSupport: 59.5, lawanSupport: 32.5, othersSupport: 8 } : state) }));
  const funds = store.getState().resources.funds;
  store.getState().runLocationActivity('office', 'commit');
  assert.ok(store.getState().journey.locationObjectives.includes('campaign:home-support-60'));
  assert.equal(store.getState().resources.funds, funds - 25000 + 75000);
  store.getState().markOfficeMailRead(1);
  store.getState().markOfficeMailRead(1);
  assert.deepEqual(store.getState().journey.readOfficeMail, [1]);
});
test('mini-games cannot grant free support with no resources', () => {
  store.setState(s => ({ resources: { ...s.resources, funds: 0 } }));
  const before = store.getState().states[0].mandatSupport;
  store.getState().runCampaignMiniGame(store.getState().states[0].id, 'ceramah', 'aggressive');
  assert.equal(store.getState().states[0].mandatSupport, before);
  assert.equal(store.getState().journey.decisions, 3);
});
test('aggressive gains require a higher actual cost', () => {
  const before = store.getState().resources.funds;
  store.getState().runCampaignMiniGame('selangor', 'ceramah', 'aggressive');
  assert.equal(before - store.getState().resources.funds, 135000);
  assert.equal(store.getState().journey.decisions, 2);
});
test('PRN actions cannot change states outside the selected negeri', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  const before = store.getState().states.find(s => s.id === 'johor').mandatSupport;
  act({ type: 'campaign', action: 'visit' });
  store.getState().runCampaignMiniGame('johor', 'social', 'safe');
  assert.equal(store.getState().states.find(s => s.id === 'johor').mandatSupport, before);
  assert.equal(store.getState().journey.decisions, 2);
});
test('pre-election government formation is blocked', () => {
  store.getState().confirmCoalition(['borneo']);
  store.getState().enterTerm('government');
  assert.equal(store.getState().journey.chapter, 'campaign');
});
test('coalition seats come only from elected independent seats and persist', () => {
  store.setState(s => ({ day: s.totalDays }));
  store.getState().finishElection();
  const outcome = { ...store.getState().journey.outcome, seatsWon: 100, lawanSeats: 95, othersSeats: 27, majorityTarget: 112, totalSeats: 222, status: 'hung' };
  patchJourney({ outcome });
  const pool = coalitionPool(store.getState());
  assert.equal(pool.reduce((n, p) => n + p.seats, 0), 27);
  store.getState().confirmCoalition(['borneo']);
  assert.equal(governingSeats(store.getState()), 113);
  assert.deepEqual(createSaveSnapshot(store.getState()).journey.partners, ['borneo']);
  patchJourney({ appointments: { 'min-fin': 'pm-003' } });
  store.getState().enterTerm('government');
  assert.equal(store.getState().journey.chapter, 'government');
  assert.equal(store.getState().journey.publicBudget, 720000);
});
test('pledges are funded separately and delivered only after two quarters', () => {
  act({ type: 'pledge', issue: 'clinic' });
  win();
  const campaignFunds = store.getState().resources.funds;
  act({ type: 'fund', issue: 'clinic' });
  assert.equal(store.getState().resources.funds, campaignFunds);
  assert.equal(store.getState().journey.publicBudget, 680000);
  act({ type: 'quarter' });
  assert.equal(store.getState().journey.pledges[0].status, 'funded');
  act({ type: 'quarter' });
  assert.equal(store.getState().journey.pledges[0].status, 'delivered');
});
test('construction persists in save and completes visibly in stored zones', () => {
  win();
  patchJourney({ cityZones: { seat: [{ id: 'zone-0', archetype: 'townCentre', repeat: 0, kind: 'urban', economy: 50, welfare: 50, infra: 50, sentiment: 50, projects: [] }] }, construction: [{ seat: 'seat', zone: 'zone-0', project: 'road', target: 'infra', boost: 12, remaining: 2 }] });
  const save = JSON.parse(JSON.stringify(createSaveSnapshot(store.getState())));
  store.getState().resetGame(); store.setState(save);
  act({ type: 'quarter' }); act({ type: 'quarter' });
  assert.deepEqual(store.getState().journey.cityZones.seat[0].projects, ['road']);
  assert.equal(store.getState().journey.cityZones.seat[0].infra, 62);
});
test('stories cannot be farmed repeatedly during one turn', () => {
  act({ type: 'story', storyId: 'loyalty-event', choice: 'compromise', character: 'Organiser' });
  const funds = store.getState().resources.funds;
  act({ type: 'story', storyId: 'loyalty-event', choice: 'compromise', character: 'Organiser' });
  assert.equal(store.getState().resources.funds, funds);
  assert.equal(store.getState().journey.relationships.Organiser, 54);
  assert.equal(store.getState().journey.storyChoices['loyalty-event'], 'compromise');
});
test('story decisions unlock only their valid follow-up branches', () => {
  assert.ok(!availableStories('term', store.getState().journey.storyChoices).some(s => s.id === 'loyalty-reckoning'));
  act({ type: 'story', storyId: 'loyalty-event', choice: 'refuse', character: 'Organiser' });
  assert.ok(availableStories('term', store.getState().journey.storyChoices).some(s => s.id === 'loyalty-reckoning'));
  assert.ok(!availableStories('term', store.getState().journey.storyChoices).some(s => s.id === 'protected-figure-leak'));
});
test('scenario archive contains six distinct bilingual historical and future starts', () => {
  assert.equal(SCENARIO_PACKS.length, 6);
  assert.equal(new Set(SCENARIO_PACKS.map(pack => pack.id)).size, 6);
  assert.equal(SCENARIO_PACKS.filter(pack => pack.kind === 'historical').length, 3);
  assert.equal(SCENARIO_PACKS.filter(pack => pack.kind === 'hypothetical').length, 3);
  assert.ok(SCENARIO_PACKS.every(pack => pack.title.ms && pack.title.en && pack.premise.ms && pack.premise.en && pack.objectives.length === 3));
});
test('scenario packs apply real scoped resources, pressure and state support', () => {
  const beforeJohor = store.getState().states.find(state => state.id === 'johor').mandatSupport;
  const beforeMelaka = store.getState().states.find(state => state.id === 'melaka').mandatSupport;
  store.getState().applyScenarioPack('change-government-2018');
  const after = store.getState();
  const pack = getScenarioPack('change-government-2018');
  assert.equal(after.journey.scenarioPackId, pack.id);
  assert.equal(after.journey.scenarioPackTerm, 1);
  assert.equal(after.settings.difficulty, 'hard');
  assert.equal(after.settings.oppositionStrength, 76);
  assert.equal(after.resources.funds, 2300000);
  assert.equal(after.journey.trust, 61);
  assert.equal(after.states.find(state => state.id === 'johor').mandatSupport, beforeJohor + 3.5);
  assert.equal(after.states.find(state => state.id === 'melaka').mandatSupport, beforeMelaka);
  assert.equal(after.states.reduce((sum, state) => sum + state.projectedSeats, 0), computeElectionOutcome(after.states, after.settings).seatsWon);
});
test('scenario objectives update from actual campaign decisions and persist', () => {
  store.getState().applyScenarioPack('selangor-climate-2032');
  const pack = getScenarioPack('selangor-climate-2032');
  const pledgeObjective = pack.objectives.find(objective => objective.id === 'promise');
  assert.equal(scenarioObjectiveProgress(store.getState(), pledgeObjective.criterion).complete, false);
  act({ type: 'pledge', issue: 'flood' });
  assert.equal(scenarioObjectiveProgress(store.getState(), pledgeObjective.criterion).complete, true);
  assert.equal(createSaveSnapshot(store.getState()).journey.scenarioPackId, 'selangor-climate-2032');
});
test('policies charge once and resolve on the quarterly clock', () => {
  win();
  act({ type: 'policy', id: 'antiCorruption' });
  const budget = store.getState().journey.publicBudget;
  const trust = store.getState().journey.trust;
  act({ type: 'policy', id: 'antiCorruption' });
  assert.equal(store.getState().journey.publicBudget, budget);
  assert.equal(store.getState().journey.trust, trust);
  act({ type: 'quarter' });
  assert.equal(store.getState().journey.trust, trust + 6);
});
test('two elections retain the governing record and constituency commitments', () => {
  act({ type: 'manifesto', id: 'rural' });
  act({ type: 'pledge', issue: 'flood' }); win();
  act({ type: 'fund', issue: 'flood' });
  while (store.getState().careerProgress.month < 60) act({ type: 'quarter' });
  const oldSupport = store.getState().states.find(s => s.id === 'selangor').mandatSupport;
  act({ type: 'next-election' });
  assert.equal(store.getState().careerProgress.term, 2);
  assert.equal(store.getState().day, 1);
  assert.equal(store.getState().journey.chapter, 'campaign');
  assert.equal(store.getState().journey.records.length, 1);
  assert.equal(store.getState().journey.pledges[0].status, 'delivered');
  assert.equal(store.getState().journey.manifestoPackageId, null);
  assert.deepEqual(store.getState().journey.manifestoHistory, [{ term: 1, id: 'rural' }]);
  assert.ok(store.getState().states.find(s => s.id === 'selangor').mandatSupport > oldSupport);
  assert.equal(store.getState().journey.outcome, null);
  store.setState(s => ({ day: s.totalDays })); store.getState().finishElection();
  assert.ok(store.getState().journey.outcome);
  assert.equal(store.getState().journey.chapter, 'results');
});
test('opposition earns real organisation and resumes its own chapter', () => {
  store.setState(s => ({ day: s.totalDays })); store.getState().finishElection(); store.getState().enterTerm('opposition');
  act({ type: 'term', action: 'branches' });
  assert.equal(store.getState().journey.organisation, 46);
  assert.equal(resumeRoute(store.getState()), '/opposition');
});
test('PRN outcome and government retain the DUN majority', () => {
  win('prn');
  const s = store.getState();
  assert.equal(s.journey.outcome.totalSeats, s.states.find(x => x.id === 'selangor').dunSeats);
  assert.equal(s.journey.chapter, 'government');
});
test('older saves get fresh nested defaults', () => {
  const normalized = normalizeJourney();
  normalized.partners.push('borneo');
  assert.deepEqual(newJourney().partners, []);
  assert.equal(normalizeJourney().decisions, 3);
});
test('autosave rewrites the active slot and restores journey data', () => {
  const storage = new Map();
  global.window = {}; global.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  store.setState({ phase: 'playing' });
  setActiveSaveSlot(null); saveGameSnapshot(store.getState());
  act({ type: 'pledge', issue: 'jobs' }); saveGameSnapshot(store.getState());
  const slots = getSavedGames();
  assert.equal(slots.length, 1);
  assert.equal(slots[0].state.journey.pledges[0].id, 'jobs');
  delete global.window; delete global.localStorage;
});
test('finished terms reject spending but allow the next election', () => {
  win();
  store.setState(s => ({ careerProgress: { ...s.careerProgress, month: 60 } }));
  const before = JSON.stringify(store.getState().journey);
  act({ type: 'policy', id: 'cost' });
  act({ type: 'term', action: 'branches' });
  act({ type: 'story', storyId: 'branch-pressure', choice: 'help', character: 'Ally' });
  assert.equal(JSON.stringify(store.getState().journey), before);
  act({ type: 'next-election' });
  assert.equal(store.getState().journey.chapter, 'campaign');
  assert.equal(store.getState().careerProgress.term, 2);
});
test('end-of-term report grades actual delivery, strategy and mistakes', () => {
  act({ type: 'pledge', issue: 'flood' });
  win();
  store.setState(state => ({ careerProgress: { ...state.careerProgress, month: 60 } }));
  const report = buildTermReport(store.getState());
  assert.equal(report.term, 1);
  assert.equal(report.chapter, 'government');
  assert.equal(report.delivered, 0);
  assert.equal(report.totalPledges, 1);
  assert.ok(report.biggestMistake.en.includes('1 term commitments'));
  assert.equal(report.ratingBand, termRatingBand(report.rating));
  assert.equal(report.voterBlocs.length, 5);
  assert.ok(report.bestStrategy.en.length > 10);
});
test('next election preserves the complete report and PRN scope metrics', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  act({ type: 'prn-candidate', id: 'local-champion' });
  win('prn');
  store.setState(state => ({ careerProgress: { ...state.careerProgress, month: 60 } }));
  const expected = buildTermReport(store.getState());
  act({ type: 'next-election' });
  const saved = store.getState().journey.records[0];
  assert.equal(saved.rating, expected.rating);
  assert.equal(saved.scope, 'prn');
  assert.equal(saved.stateId, 'selangor');
  assert.equal(saved.totalSeats, store.getState().states.find(state => state.id === 'selangor').dunSeats);
  assert.equal(createSaveSnapshot(store.getState()).journey.records[0].bestStrategy.en, expected.bestStrategy.en);
});
test('coalition deal structures trade seats, money, stability and cabinet freedom', () => {
  store.setState(s => ({ day: s.totalDays })); store.getState().finishElection();
  patchJourney({ outcome: { ...store.getState().journey.outcome, seatsWon: 100, lawanSeats: 95, othersSeats: 27, majorityTarget: 112, totalSeats: 222, status: 'hung' } });
  store.getState().confirmCoalition(['borneo'], { borneo: 'confidence' });
  assert.equal(store.getState().journey.coalitionConfirmed, false);
  store.getState().confirmCoalition(['borneo'], { borneo: 'portfolio' });
  assert.equal(governingSeats(store.getState()), 113);
  assert.equal(createSaveSnapshot(store.getState()).journey.coalitionTerms.borneo, 'portfolio');
  patchJourney({ appointments: { 'min-fin': 'pm-003' }, cabinetQuality: 73 });
  store.getState().enterTerm('government');
  assert.equal(store.getState().journey.publicBudget, 837000);
  assert.equal(store.getState().journey.stability, 75);
  const trust = store.getState().journey.trust;
  act({ type: 'quarter' });
  assert.equal(store.getState().journey.trust, trust - 1);
});
test('cabinet representation rewards a broad, emerging and Borneo-inclusive team', () => {
  const concentrated = evaluateCabinet({ a: 'pm-001', b: 'pm-006', c: 'pm-015', d: 'pm-018' });
  const balanced = evaluateCabinet({ a: 'pm-002', b: 'pm-009', c: 'pm-013', d: 'pm-014', e: 'pm-005', f: 'pm-007' });
  assert.ok(balanced.score > concentrated.score);
  assert.ok(balanced.trustDelta > concentrated.trustDelta);
  assert.equal(balanced.borneo, 2);
  assert.ok(balanced.women >= 3);
});
test('low-loyalty ambitious ministers can defect during a weak governing quarter', () => {
  win();
  patchJourney({
    appointments: { 'min-fin': 'pm-001', 'min-home': 'pm-006', 'min-youth': 'pm-015', 'min-rural': 'pm-018' },
    ministerLoyalty: { 'pm-001': 20, 'pm-006': 70, 'pm-015': 70, 'pm-018': 70 },
    stability: 40,
  });
  act({ type: 'quarter' });
  assert.equal(store.getState().journey.appointments['min-fin'], null);
  assert.ok(store.getState().journey.ministerIncidents.some(event => event.includes("Dato' Sri Zulkifli Hamdan")));
  assert.ok(store.getState().journey.stability < 40);
  assert.equal(createSaveSnapshot(store.getState()).journey.ministerLoyalty['pm-001'], 17);
});
test('every PRN battlefield has three bilingual state-specific issues', () => {
  for (const state of store.getState().states.filter(item => item.dunSeats > 0)) {
    const issues = getPrnIssues(state.id);
    assert.equal(issues.length, 3, state.id);
    assert.ok(issues.every(issue => issue.title.ms && issue.title.en && issue.summary.ms && issue.summary.en), state.id);
  }
});
test('PRN leadership candidates offer five distinct bilingual archetypes and state fits', () => {
  assert.equal(PRN_CANDIDATES.length, 5);
  assert.equal(new Set(PRN_CANDIDATES.map(candidate => candidate.id)).size, 5);
  assert.ok(PRN_CANDIDATES.every(candidate => candidate.archetype.ms && candidate.archetype.en && candidate.strength.ms && candidate.risk.en));
  const kelantan = store.getState().states.find(state => state.id === 'kelantan');
  const penang = store.getState().states.find(state => state.id === 'penang');
  assert.ok(prnCandidateStateImpact('religious-figure', kelantan) > prnCandidateStateImpact('religious-figure', penang));
  assert.ok(prnCandidateStateImpact('technocrat', penang) > prnCandidateStateImpact('technocrat', kelantan));
});
test('a required PRN leadership nomination applies once, stays scoped and persists', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  const outside = JSON.stringify(store.getState().states.filter(state => state.id !== 'selangor'));
  const before = store.getState().states.find(state => state.id === 'selangor').mandatSupport;
  act({ type: 'prn-candidate', id: 'youth-reformer' });
  const after = store.getState();
  assert.equal(after.journey.prnCandidateId, 'youth-reformer');
  assert.equal(after.journey.prnCandidateHistory.length, 1);
  assert.ok(after.states.find(state => state.id === 'selangor').mandatSupport > before);
  assert.equal(JSON.stringify(after.states.filter(state => state.id !== 'selangor')), outside);
  assert.equal(after.journey.organisation, 43);
  act({ type: 'prn-candidate', id: 'state-warlord' });
  assert.equal(store.getState().journey.prnCandidateId, 'youth-reformer');
  assert.equal(store.getState().journey.prnCandidateHistory.length, 1);
  assert.equal(createSaveSnapshot(store.getState()).journey.prnCandidateId, 'youth-reformer');
});
test('PRN candidate strategy rewards matching campaign channels and debate tones', () => {
  const state = store.getState().states.find(item => item.id === 'selangor');
  const context = { charisma: 72, credibility: 91, strategy: 84, manifestoId: null, mediaSentiment: 'neutral', difficulty: 'normal', prnCandidateId: 'technocrat' };
  assert.ok(prnCandidateChannelBonus('technocrat', 'social') > prnCandidateChannelBonus('technocrat', 'ceramah'));
  assert.ok(campaignEventStateImpact('leader-debate', 'technocratic', state, context) > campaignEventStateImpact('leader-debate', 'religious', state, context));
});
test('matching a PRN issue to its campaign channel adds diminishing persistent momentum', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  const issueId = 'selangor-housing';
  const key = prnIssueActionKey(store.getState().careerProgress.term, 'selangor', issueId);
  const before = store.getState().states.find(state => state.id === 'selangor').mandatSupport;
  store.getState().runCampaignMiniGame('selangor', 'social', 'safe', issueId);
  const afterFirst = store.getState().states.find(state => state.id === 'selangor').mandatSupport;
  store.getState().runCampaignMiniGame('selangor', 'social', 'safe', issueId);
  const afterSecond = store.getState().states.find(state => state.id === 'selangor').mandatSupport;
  assert.ok(afterFirst - before > afterSecond - afterFirst);
  assert.equal(store.getState().journey.prnIssueActions[key], 2);
  assert.equal(createSaveSnapshot(store.getState()).journey.prnIssueActions[key], 2);
  assert.ok(store.getState().journey.journal[0].en.includes('Affordable housing'));
});
test('manifesto packages create distinct voter-bloc and regional trade-offs', () => {
  const kelantan = store.getState().states.find(state => state.id === 'kelantan');
  const penang = store.getState().states.find(state => state.id === 'penang');
  const sabah = store.getState().states.find(state => state.id === 'sabah');
  assert.ok(manifestoStateImpact('conservative', kelantan) > manifestoStateImpact('conservative', penang));
  assert.ok(manifestoStateImpact('multiracial', penang) > manifestoStateImpact('multiracial', kelantan));
  assert.ok(manifestoStateImpact('borneo', sabah) > manifestoStateImpact('borneo', penang));
  assert.ok(manifestoStateImpact('borneo', penang) < 0);
});
test('a manifesto launches once, charges resources and stays inside a PRN battlefield', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  const outsideBefore = JSON.stringify(store.getState().states.filter(state => state.id !== 'selangor'));
  const fundsBefore = store.getState().resources.funds;
  act({ type: 'manifesto', id: 'economy' });
  assert.equal(store.getState().journey.manifestoPackageId, 'economy');
  assert.equal(store.getState().journey.decisions, 2);
  assert.equal(fundsBefore - store.getState().resources.funds, 120000);
  assert.equal(JSON.stringify(store.getState().states.filter(state => state.id !== 'selangor')), outsideBefore);
  assert.deepEqual(createSaveSnapshot(store.getState()).journey.manifestoHistory, [{ term: 1, id: 'economy' }]);
  act({ type: 'manifesto', id: 'rural' });
  assert.equal(store.getState().journey.manifestoPackageId, 'economy');
  assert.equal(store.getState().journey.decisions, 2);
  assert.equal(store.getState().resources.funds, fundsBefore - 120000);
});
test('manifesto follow-through rewards its preferred campaign channel', () => {
  const penang = store.getState().states.find(state => state.id === 'penang');
  assert.ok(manifestoCampaignBonus('economy', penang, 'social') > manifestoCampaignBonus('economy', penang, 'ceramah'));
  assert.ok(manifestoCampaignBonus('conservative', penang, 'ceramah') > manifestoCampaignBonus('conservative', penang, 'social'));
});
test('campaign events and performance tones are complete and bilingual', () => {
  assert.equal(CAMPAIGN_EVENTS.length, 5);
  assert.equal(CAMPAIGN_TONES.length, 6);
  assert.equal(new Set(CAMPAIGN_EVENTS.map(event => event.id)).size, 5);
  assert.equal(new Set(CAMPAIGN_TONES.map(tone => tone.id)).size, 6);
  assert.ok(CAMPAIGN_EVENTS.every(event => event.title.ms && event.title.en && event.description.ms && event.description.en));
  assert.ok(CAMPAIGN_TONES.every(tone => tone.title.ms && tone.title.en && tone.risk.ms && tone.risk.en));
});
test('event tones reward audience, leader and manifesto fit while preserving risk', () => {
  const penang = store.getState().states.find(state => state.id === 'penang');
  const kelantan = store.getState().states.find(state => state.id === 'kelantan');
  const context = { charisma: 72, credibility: 91, strategy: 84, manifestoId: 'anti-corruption', mediaSentiment: 'neutral', difficulty: 'normal' };
  assert.ok(campaignEventStateImpact('press-conference', 'technocratic', penang, context) > campaignEventStateImpact('press-conference', 'religious', penang, context));
  assert.ok(campaignEventStateImpact('mega-rally', 'religious', kelantan, { ...context, manifestoId: 'conservative' }) > campaignEventStateImpact('mega-rally', 'technocratic', kelantan, context));
  assert.equal(isCampaignEventUnlocked(CAMPAIGN_EVENTS.find(event => event.id === 'leader-debate'), 1, 30), false);
  assert.equal(isCampaignEventUnlocked(CAMPAIGN_EVENTS.find(event => event.id === 'leader-debate'), 10, 30), true);
});
test('major campaign events are one-time, persistent and isolated to the PRN state', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  const beforeOutside = JSON.stringify(store.getState().states.filter(state => state.id !== 'selangor'));
  const before = { ...store.getState().resources };
  store.getState().runCampaignEvent('youth-townhall', 'reformist');
  const after = store.getState();
  assert.equal(after.journey.decisions, 2);
  assert.equal(after.journey.campaignEvents.length, 1);
  assert.equal(after.journey.campaignEvents[0].eventId, 'youth-townhall');
  assert.equal(after.resources.funds, before.funds - 90000);
  assert.equal(after.resources.mediaBuy, before.mediaBuy - 45);
  assert.equal(after.resources.manpower, before.manpower - 25);
  assert.equal(JSON.stringify(after.states.filter(state => state.id !== 'selangor')), beforeOutside);
  assert.equal(after.politicalReactions[0].actionType, 'debate');
  assert.equal(createSaveSnapshot(after).journey.campaignEvents[0].toneId, 'reformist');
  store.getState().runCampaignEvent('youth-townhall', 'attack');
  assert.equal(store.getState().journey.campaignEvents.length, 1);
  assert.equal(store.getState().journey.decisions, 2);
});
test('PRU election night reveals every seat once with all late-count drama beats', () => {
  const states = store.getState().states;
  const timeline = buildElectionNightTimeline(states, 'MANDAT', 'parliament');
  const seatUpdates = electionNightSeatUpdates(timeline);
  const outcome = computeElectionOutcome(states, { electionScope: 'pru' });
  assert.equal(seatUpdates.length, outcome.totalSeats);
  assert.equal(new Set(seatUpdates.map(update => update.id)).size, outcome.totalSeats);
  assert.equal(seatUpdates.filter(update => update.result === 'WIN').length, outcome.seatsWon);
  assert.equal(seatUpdates.filter(update => update.result === 'LOSS').length, outcome.lawanSeats);
  const bulletins = timeline.filter(update => update.kind === 'bulletin').map(update => update.bulletinType);
  for (const type of ['too-close', 'postal-swing', 'recount', 'late-rural', 'borneo-late', 'kingmaker', 'complete']) assert.ok(bulletins.includes(type), type);
  const borneoBulletin = timeline.findIndex(update => update.kind === 'bulletin' && update.bulletinType === 'borneo-late');
  const firstBorneoSeat = timeline.findIndex(update => update.kind === 'seat' && update.region === 'borneo');
  assert.ok(firstBorneoSeat > borneoBulletin);
});
test('PRN election night counts only the selected state DUN', () => {
  const selected = store.getState().states.find(state => state.id === 'selangor');
  const timeline = buildElectionNightTimeline([selected], 'MANDAT', 'dun');
  const seatUpdates = electionNightSeatUpdates(timeline);
  assert.equal(seatUpdates.length, selected.dunSeats);
  assert.ok(seatUpdates.every(update => update.stateId === 'selangor'));
  assert.equal(new Set(seatUpdates.map(update => update.id)).size, selected.dunSeats);
});
test('full PRN defeat flows through opposition and back to a scoped second election', () => {
  store.getState().updateSettings({ electionScope: 'prn', prnStateId: 'selangor' });
  act({ type: 'manifesto', id: 'youth-jobs' });
  while (store.getState().day < store.getState().totalDays) store.getState().advanceDay();
  store.setState(state => ({ states: state.states.map(item => item.id === 'selangor' ? { ...item, mandatSupport: 35, lawanSupport: 55, othersSupport: 10 } : item) }));
  store.getState().finishElection();
  store.getState().enterTerm('opposition');
  assert.equal(store.getState().journey.chapter, 'opposition');
  assert.equal(resumeRoute(store.getState()), '/opposition');
  while (store.getState().careerProgress.month < 60) act({ type: 'quarter' });
  act({ type: 'next-election' });
  assert.equal(store.getState().journey.chapter, 'campaign');
  assert.equal(store.getState().settings.electionScope, 'prn');
  assert.equal(store.getState().settings.prnStateId, 'selangor');
  assert.equal(store.getState().careerProgress.term, 2);
});
test('heavy PRU defeat completes the rebuilding route and preserves its legacy', () => {
  store.setState(state => ({ day: state.totalDays, states: state.states.map(item => ({ ...item, mandatSupport: 14, lawanSupport: 76, othersSupport: 10 })) }));
  store.getState().finishElection();
  assert.equal(store.getState().journey.outcome.status, 'collapse');
  store.getState().enterTerm('rebuilding');
  assert.equal(resumeRoute(store.getState()), '/postmortem');
  act({ type: 'term', action: 'branches' });
  while (store.getState().careerProgress.month < 60) act({ type: 'quarter' });
  act({ type: 'next-election' });
  assert.equal(store.getState().careerProgress.term, 2);
  assert.equal(store.getState().journey.records.length, 1);
  assert.equal(store.getState().journey.chapter, 'campaign');
});
test('tactical overlays identify marginal, opponent and swing DUN contests', () => {
  const state = store.getState().states.find(item => item.id === 'selangor');
  const base = generateConstituencies(state, 'dun')[0];
  const marginal = { ...base, mandat: 46, lawan: 43, others: 11, winner: 'mandat', margin: 3, safety: 'danger' };
  const opponent = { ...base, mandat: 31, lawan: 54, others: 15, winner: 'lawan', margin: 23, safety: 'safe' };
  assert.equal(seatTacticalVisual(marginal, state, 'marginal').active, true);
  assert.equal(seatTacticalVisual(marginal, state, 'swing').active, true);
  assert.equal(seatTacticalVisual(opponent, state, 'opponent').active, true);
  assert.equal(seatTacticalVisual(opponent, state, 'marginal').active, false);
});
test('campaign-reach overlay follows active operations and stays state-scoped', () => {
  const selangor = store.getState().states.find(item => item.id === 'selangor');
  const johor = store.getState().states.find(item => item.id === 'johor');
  const operations = [{ id: 'reach', name: 'Field push', type: 'ceramah', location: 'Selangor', stateIds: ['selangor'], status: 'active', manpowerCost: 20, fundsCost: 10000, supportGain: 1 }];
  assert.equal(stateTacticalVisual(selangor, 'reach', operations).active, true);
  assert.equal(stateTacticalVisual(johor, 'reach', operations).active, false);
  assert.ok(stateTacticalVisual(selangor, 'reach', operations).detail.en.includes('field'));
});
test('every incoming campaign event has complete BM and English copy', () => {
  assert.equal(gameEvents.length, 15);
  for (const event of gameEvents) {
    assert.ok(event.title.trim(), `${event.id} English title`);
    assert.ok(event.description.trim(), `${event.id} English description`);
    assert.ok(event.titleMS?.trim(), `${event.id} BM title`);
    assert.ok(event.descriptionMS?.trim(), `${event.id} BM description`);
  }
});
test('daily PRU and PRN projections agree with election-night seat counting', () => {
  for (const scope of ['pru', 'prn']) {
    store.getState().resetGame();
    store.getState().updateSettings({ electionScope: scope, prnStateId: 'selangor' });
    const outside = JSON.stringify(store.getState().states.filter(s => s.id !== 'selangor'));
    for (let day = 1; day < store.getState().totalDays; day++) {
      store.getState().advanceDay();
      const s = store.getState();
      const projected = s.states.filter(x => scope === 'pru' || x.id === 'selangor').reduce((sum, x) => sum + x.projectedSeats, 0);
      assert.equal(projected, computeElectionOutcome(s.states, s.settings).seatsWon);
    }
    if (scope === 'prn') assert.equal(JSON.stringify(store.getState().states.filter(s => s.id !== 'selangor')), outside);
  }
});
console.log(`${passed} journey regression tests passed.`);
