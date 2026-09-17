// Reproducible diagnostic runs, not a substitute for human playtesting.
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { useGameStore: store } = require('../app/store/gameStore.ts');
const originalRandom = Math.random;
const runs = 30;
console.log('| Scope | Difficulty | Strategy | Majority runs | Mean seats | Mean funds |');
console.log('|---|---|---|---:|---:|---:|');
try {
  for (const scope of ['pru', 'prn']) for (const difficulty of ['easy', 'normal', 'hard', 'nightmare']) for (const strategy of ['passive', 'community', 'tactical']) {
    let wins = 0, seats = 0, funds = 0;
    for (let seed = 1; seed <= runs; seed++) {
      let randomState = seed;
      Math.random = () => { randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0; return randomState / 4294967296; };
      store.getState().resetGame();
      store.getState().updateSettings({ electionScope: scope, prnStateId: 'selangor', difficulty });
      // Same fresh start as guided setup; no pre-seeded staff operations.
      store.setState({ operations: [] });
      while (store.getState().day < store.getState().totalDays) {
        const game = store.getState();
        if (strategy !== 'passive') {
          game.journeyAction({ type: 'campaign', action: 'fundraise' });
          if (strategy === 'community') {
            game.journeyAction({ type: 'campaign', action: 'visit' });
            game.journeyAction({ type: 'campaign', action: 'organise' });
          } else {
            const targets = game.states.filter(s => scope === 'pru' || s.id === 'selangor').sort((a, b) => Math.abs(a.mandatSupport - a.lawanSupport) - Math.abs(b.mandatSupport - b.lawanSupport));
            game.runCampaignMiniGame(targets[0].id, 'ceramah', 'balanced');
            game.journeyAction({ type: 'campaign', action: 'organise' });
          }
        }
        game.advanceDay();
      }
      store.getState().finishElection();
      const game = store.getState(), outcome = game.journey.outcome;
      wins += outcome.status === 'majority' ? 1 : 0;
      seats += outcome.seatsWon;
      funds += game.resources.funds;
    }
    console.log(`| ${scope.toUpperCase()} | ${difficulty} | ${strategy} | ${wins}/${runs} | ${(seats / runs).toFixed(1)} | RM${Math.round(funds / runs).toLocaleString('en-US')} |`);
  }
} finally { Math.random = originalRandom; }
