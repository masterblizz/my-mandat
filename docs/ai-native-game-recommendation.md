# MyMandat AI-Native Game Recommendation

## Current assessment

MyMandat is currently best described as an AI-themed / AI-assisted political strategy simulator, not yet a fully AI-native game.

Current AI-like features are mostly deterministic or rules-based:

- AI Advisor nomination suggestions are based on scoring and hardcoded candidate metadata.
- Seat projections and campaign effects are calculated by formulas.
- Candidate and politician data are mostly static TypeScript datasets.
- Local branch candidates are generated deterministically from hardcoded name pools.
- There is no real LLM/API/model-driven reasoning layer yet.
- There is no persistent AI memory of player decisions beyond normal game state.
- There is no adaptive AI opponent strategist yet.

This is still useful and good as a foundation, because deterministic rules keep the game fair, testable, and balanced. The recommended path is not to replace the rules engine, but to add AI as a strategic, narrative, and adaptive layer on top of it.

## Recommended AI-native direction

The best approach is a hybrid AI-native simulator:

1. A deterministic rules engine controls fairness and numbers.
2. AI generates strategy, reasoning, narrative, political reactions, opponent behavior, speeches, news, cabinet analysis, and memory-based advice.
3. AI output should be structured and validated before it changes gameplay values.

In short:

Rules engine = truth layer.
AI layer = strategy, story, reaction, explanation, and adaptation.

## Why hybrid is best

Do not let AI directly control all game numbers randomly.

Keep deterministic systems for:

- Seats
- Funds
- Support percentages
- Candidate stats
- State data
- Turn/day progression
- Win/loss calculation
- Cabinet score

Then AI sits above it to interpret the game state and generate advice, events, and narrative.

Benefits:

- The game remains balanced.
- The game remains testable.
- AI output feels intelligent but cannot break the simulation.
- Player can trust the numbers.
- The AI can make the campaign feel alive without destroying game logic.

## Phase 1 recommendation: candidate profile photos and full candidate profile modal

This should be the next UX upgrade.

Nomination screen should show profile photo for every candidate.

Each candidate profile should include:

- Profile photo / portrait
- Name
- Role
- Home state
- Home constituency
- Influence scope: national, state, local
- Influence
- Charisma
- Credibility
- Experience
- Specialty
- Seat fit
- Local advantage or outsider penalty
- Strengths
- Weaknesses
- Voter appeal
- Scandal/risk rating
- Cabinet potential
- AI tactical summary

Why this matters:

- Candidate selection becomes personal and memorable.
- Player can compare candidates more meaningfully.
- It creates a foundation for AI nomination advice.
- It makes the game feel more like a living political simulator.

## Phase 2 recommendation: real AI Campaign Advisor

This should be the first true AI-native feature.

The advisor should read the current game state and answer player questions like:

- Where should I campaign today?
- Which candidate should I nominate in Ledang?
- Why am I losing Johor?
- What is my best path to 112 seats?
- Should I spend money on social media or ceramah?
- Which state is my highest risk?
- Which voter group am I losing?

The AI should receive structured game context:

- Current day
- Total campaign days
- Funds
- Manpower
- Media buy
- State support
- Seat projections
- Nominations
- Candidate pool
- Poll trends
- Recent events
- Opponent strength
- Player party identity
- Difficulty/settings

The AI should return:

- Recommendation
- Reasoning
- Risk level
- Suggested actions
- Expected impact
- Alternative strategy

Example response shape:

```json
{
  "recommendation": "Focus today on Johor and Sabah instead of Selangor.",
  "reasoning": "Selangor is already leaning safe, while Johor has several marginal seats and Sabah is under-campaigned.",
  "riskLevel": "medium",
  "suggestedActions": [
    "Run ceramah in Johor rural seats",
    "Deploy social media campaign to Sabah youth voters",
    "Nominate local candidates in marginal Johor seats"
  ],
  "predictedEffects": {
    "johorSupport": 2,
    "sabahSupport": 1,
    "mediaHeat": 1
  }
}
```

## Phase 3 recommendation: AI-generated live news and political reaction

Every major player action should create a political reaction.

Examples:

- Candidate nomination
- Ceramah speech
- Social media campaign
- Manifesto pledge
- Scandal response
- Debate performance
- Cabinet appointment

AI can generate:

- News headline
- News summary
- Social media reaction
- Opponent attack
- Voter sentiment shift
- Advisor warning

Example:

Player nominates a national figure in a local Johor seat.

AI-generated reaction:

Headline:
"Local activists question MANDAT's decision to field national figure in Ledang"

Effect:

- Grassroots enthusiasm -2
- Media attention +3
- Urban visibility +1

This makes each action feel like part of a living political story.

## Phase 4 recommendation: AI nomination assistant

The nomination screen should allow the player to ask:

- Why is this candidate suitable?
- Who is the best candidate for this seat?
- What is the risk if I field this person here?
- Should I choose a local grassroots candidate or a national heavyweight?

AI should compare:

- Candidate profile
- Seat demographics
- Current party support
- Local/state/national influence
- Opponent strength
- Campaign strategy

Example AI reasoning:

"Marlina Yusof is a strong fit for Ledang because she is an Anak Kawasan with direct grassroots credibility. Her influence is lower than a national heavyweight, but she reduces outsider penalty and improves local machinery. Best used in marginal rural seats where local trust matters."

## Phase 5 recommendation: AI opponent strategist

The opposition should adapt to the player.

Opponent AI should:

- Study player weaknesses
- Attack marginal seats
- Counter player narratives
- Create campaign pressure in ignored regions
- Respond to speeches and manifesto promises
- Trigger scandals or media frames
- Shift resources dynamically

Examples:

- If player ignores Sabah, opposition increases campaign pressure there.
- If player overuses social media, opposition frames player as online-only and weak on grassroots.
- If player nominates too many elites, opposition attacks the party as disconnected from ordinary voters.

This makes the game less static and more replayable.

## Phase 6 recommendation: AI speech, manifesto, and message crafting

Player should be able to generate campaign content through AI.

Inputs:

- Target state
- Target voter group
- Channel: ceramah, TikTok, press statement, manifesto, debate
- Tone: reformist, nationalist, economic, youth-focused, anti-corruption, rural development
- Risk level: safe, balanced, aggressive

AI generates:

- Speech
- Slogan
- Policy message
- Press statement
- Social media script
- Debate attack line

Then the rules engine evaluates the message.

Example effects:

- Youth support +2
- Rural support -1
- Media heat +3
- Credibility +1
- Opponent attack risk +2

This is one of the strongest AI-native mechanics because the player is creating political content with AI and seeing consequences in the simulation.

## Phase 7 recommendation: AI voter blocs and sentiment model

Add voter groups beyond state-level support.

Possible voter blocs:

- Malay rural voters
- Urban middle class
- Youth voters
- Civil servants
- Sabah/Sarawak autonomy voters
- Chinese urban voters
- Indian working-class voters
- Small business owners
- Religious conservatives
- Reform voters

AI interprets player actions and explains sentiment changes.

Example:

"Your anti-corruption message improved urban trust but reduced support among voters dependent on local patronage networks. Rural machinery enthusiasm is down in Kedah and Pahang."

This gives deeper gameplay than only support percentages.

## Phase 8 recommendation: AI campaign memory

The AI advisor should remember the campaign history.

Examples:

- You ignored Sabah for five days.
- You promised fuel subsidies earlier; today's austerity speech contradicts that.
- You nominated too many national elites; grassroots morale is dropping.
- You rejected autonomy demands earlier, so Sarawak coalition talks are harder now.
- You spent heavily on social media but neglected ceramah.

This turns AI from a generic helper into a campaign strategist that understands the player's run.

## Phase 9 recommendation: AI-native post-election gameplay

The cabinet system is a strong foundation for AI-native post-election gameplay.

AI should evaluate cabinet balance:

- Region balance
- Gender balance
- Ethnic/community balance
- Faction loyalty
- Competence
- Scandal risk
- Coalition satisfaction
- Public reaction
- Market/business confidence
- Reform credibility

AI can warn:

- Too many West Malaysia ministers. Sabah/Sarawak backlash likely.
- Finance Minister has strong economic credibility but low grassroots appeal.
- Deputy PM choice may anger party veterans.
- Cabinet lacks youth representation.

After cabinet formation, AI can generate:

- First 100 days events
- Coalition pressure
- Public approval changes
- Policy conflicts
- Media reaction
- Opposition attacks

## Recommended technical architecture

### A. Game engine

Deterministic TypeScript logic.

Responsible for:

- State changes
- Seat calculations
- Resource calculations
- Support changes
- Polling
- Election results
- Cabinet scoring

### B. AI context builder

Converts current game state into compact structured JSON.

Example context:

```json
{
  "day": 7,
  "totalDays": 14,
  "funds": 4200000,
  "targetSeats": 112,
  "projectedSeats": 105,
  "highestRiskStates": ["johor", "sabah"],
  "recentActions": ["social_media_selangor", "nominate_ledang"],
  "settings": {
    "difficulty": "hard",
    "mediaBias": "hostile"
  }
}
```

### C. AI service layer

Calls an LLM/API/local model.

This can be implemented later using:

- Cloud LLM API
- Local model
- User-configured AI provider
- Server route in Next.js

### D. Structured AI response schema

AI should return JSON, not only free text.

Example:

```json
{
  "type": "campaign_advice",
  "summary": "Shift focus to Johor and Sabah.",
  "reasoning": [
    "Johor contains several marginal seats.",
    "Sabah has low campaign attention.",
    "Selangor is already above safe threshold."
  ],
  "riskLevel": "medium",
  "actions": [
    {
      "label": "Ceramah Johor rural belt",
      "cost": 250000,
      "targetState": "johor",
      "expectedEffect": {
        "support": 2,
        "grassroots": 3
      }
    }
  ]
}
```

### E. Rules validator

Before applying AI output, validate and clamp effects.

Rules:

- AI cannot give impossible support gains.
- AI cannot create negative funds.
- AI cannot change election rules.
- AI cannot bypass difficulty balance.
- AI suggestions must map to valid game actions.

This prevents AI from breaking the simulation.

## Recommended implementation order

1. Candidate profile photos and full profile modal.
2. Real AI Campaign Advisor that reads current game state.
3. AI-generated news reactions after major actions.
4. AI nomination assistant for seat/candidate fit.
5. AI opponent strategist.
6. AI speech / manifesto / message generator.
7. AI voter bloc sentiment model.
8. AI campaign memory.
9. AI cabinet and first-100-days governance advisor.

## Best first AI-native feature

The best first real AI-native feature is:

AI Campaign Advisor + AI-generated news reaction.

Reason:

- It touches the whole game.
- It makes every decision feel alive.
- It can use the current game state without rebuilding the whole simulator.
- It gives immediate player-facing value.
- It fits the existing War Room / AI Advisor theme.

## Final positioning

Current positioning:

AI-themed / AI-assisted political strategy simulator.

Future positioning after implementing the roadmap:

AI-native Malaysian political campaign simulator.

The key is to make AI responsible for adaptive reasoning, political narrative, candidate explanations, opposition strategy, voter reactions, and campaign memory — while the deterministic rules engine keeps the game fair and balanced.
