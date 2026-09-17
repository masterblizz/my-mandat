# Balance audit — 2026-09-17

Reproduce with `node scripts/audit-balance.cjs`. This runs 30 seeded campaigns
for each combination of PRU/PRN, four difficulties and three strategies: 720 runs.
The seed controls test-process randomness only; production randomness is unchanged.
These are diagnostic simulations, not human usability or fun ratings.

All runs use the default fictional leader/home seat, default starting funds and
30-day campaign, with no initial operations. PRN uses Selangor (56 DUN seats).
Other states, campaign lengths, datasets and operation-heavy strategies are not
covered. Strategies can trigger different opponent random draws despite matching seeds.

- **Passive:** only advance days.
- **Community:** fundraise, visit the home state and train organisers each day.
- **Tactical:** fundraise, run a balanced ceramah in the closest contested state,
  then train organisers each day, subject to normal resource/action limits.

## Findings and next checks

- Passive Normal PRU wins 25/30 majorities: starting advantage may make inaction too rewarding.
- Community Normal PRN wins all seats in all 30 runs: repeated local visits may be too strong.
- Nightmare PRN is much harsher than PRU for these strategies; expand to other states
  and operation strategies before changing difficulty multipliers.
- Community play ends with more money than it started with. Check fundraising
  returns against real campaign spending needs before adjusting the economy.
- Fixed a correctness issue discovered during this audit: daily projections used
  parliamentary seat counts in PRN and differed from election-night results.
  Projections now use the result model and its existing tie convention.
- Regression coverage checks every day in PRU and PRN and confirms other states
  remain unchanged throughout a PRN campaign (17 regression tests total).

Full PRN browser testing remains pending: the isolated preview has no premium
entitlement. Opposition/rebuilding browser verification and human usability,
mobile layout, pacing and replayability tests also remain open.

## Baseline results

| Scope | Difficulty | Strategy | Majority runs | Mean seats | Mean funds |
|---|---|---|---:|---:|---:|
| PRU | easy | passive | 30/30 | 125.8 | RM2,300,000 |
| PRU | easy | community | 30/30 | 129.6 | RM3,025,000 |
| PRU | easy | tactical | 30/30 | 144.6 | RM1,140,000 |
| PRU | normal | passive | 25/30 | 118.5 | RM2,300,000 |
| PRU | normal | community | 28/30 | 123.3 | RM3,025,000 |
| PRU | normal | tactical | 30/30 | 137.8 | RM1,140,000 |
| PRU | hard | passive | 7/30 | 106.4 | RM2,300,000 |
| PRU | hard | community | 21/30 | 113.8 | RM3,025,000 |
| PRU | hard | tactical | 30/30 | 126.8 | RM1,140,000 |
| PRU | nightmare | passive | 0/30 | 93.9 | RM2,300,000 |
| PRU | nightmare | community | 0/30 | 101.9 | RM3,025,000 |
| PRU | nightmare | tactical | 24/30 | 115.8 | RM1,140,000 |
| PRN | easy | passive | 29/30 | 32.8 | RM2,300,000 |
| PRN | easy | community | 30/30 | 56.0 | RM3,025,000 |
| PRN | easy | tactical | 30/30 | 56.0 | RM1,140,000 |
| PRN | normal | passive | 0/30 | 21.3 | RM2,300,000 |
| PRN | normal | community | 30/30 | 56.0 | RM3,025,000 |
| PRN | normal | tactical | 30/30 | 56.0 | RM1,140,000 |
| PRN | hard | passive | 0/30 | 2.9 | RM2,300,000 |
| PRN | hard | community | 30/30 | 50.3 | RM3,025,000 |
| PRN | hard | tactical | 29/30 | 41.0 | RM1,140,000 |
| PRN | nightmare | passive | 0/30 | 0.0 | RM2,300,000 |
| PRN | nightmare | community | 1/30 | 12.7 | RM3,025,000 |
| PRN | nightmare | tactical | 0/30 | 2.9 | RM1,140,000 |
