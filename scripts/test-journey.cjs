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
