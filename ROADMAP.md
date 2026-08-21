# HINTMAN Project Roadmap

Last audited: 2026-08-21

This document describes the current HINTMAN product, records the repository audit baseline, and turns the confirmed improvement opportunities into an ordered delivery plan. It is based on the current working tree, including the survival reconnect work described in `planning-session.md`. Some of that work is not yet committed, so "implemented" does not necessarily mean "released."

## Status Legend

| Status | Meaning |
| --- | --- |
| `DONE` | Present in the current working tree and locally verified |
| `IN PROGRESS` | Partially implemented or awaiting integration/verification |
| `TODO` | Confirmed work not yet started |
| `DECISION` | Product or architecture choice required before implementation |
| `OPTIONAL` | Valuable follow-up, not required for the production baseline |

Priority meanings:

| Priority | Meaning |
| --- | --- |
| P0 | Current release blocker: exploitable security, game integrity, corrupt data, or unreproducible validation |
| P1 | Required production baseline: reliability, operations, accessibility, and maintainability |
| P2 | Important improvement after the safe production baseline |
| P3 | Optional product growth work |

## Product Summary

HINTMAN is a full-stack, real-time deduction game with a spy-themed interface. Players identify an answer from progressively revealed hints while managing health, time, and competition from either an AI opponent or other online players.

### Current Game Modes

| Mode | Current behavior | Runtime |
| --- | --- | --- |
| 1 vs 1 AI | Local practice match against Agent 47 | Browser only |
| 1 vs 1 Multiplayer | Online duel with general or category matchmaking | Browser plus Socket.IO server |
| Codename: Survival | Battle-royale-style match for up to six players | Browser plus Socket.IO server |

### Current Stack

| Area | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React 19, Vite 7, Tailwind CSS 3 | Screens, local game state, Socket.IO client, responsive UI |
| Backend | Node.js, Express 4, Socket.IO 4 | Matchmaking, rooms, authoritative online rules, timers, results |
| Realtime infrastructure | Redis 4 and `@socket.io/redis-adapter` | Socket.IO pub/sub and room/player snapshots |
| Content | JSON question banks | Answers, categories, difficulty, and five progressive hints |
| Tests | Node's built-in test runner | Two current survival lifecycle tests |
| Deployment | Vercel-oriented frontend and Render-oriented backend assumptions | Configuration currently lives mostly outside the repository |

### Runtime Architecture

1. `frontend/src/App.jsx` owns codename entry, game-mode selection, and top-level navigation.
2. `frontend/src/components/modes/OneVsOne.jsx` runs the local AI mode and imports a browser-side question bank.
3. `frontend/src/components/modes/OneVsOneMultiplayer.jsx` and `CodenameSurvival.jsx` connect directly to the Socket.IO backend.
4. `backend/server.js` initializes Express, Socket.IO, Redis, health/debug endpoints, and `GameManager`.
5. `backend/src/services/GameManager.js` owns connected players, matchmaking, room creation, reconnect handling, and persistence calls.
6. `backend/src/models/GameRoom.js` and `SurvivalRoom.js` contain the online game rules and timer state machines.
7. `backend/src/services/RedisService.js` saves snapshots, but the application does not currently hydrate playable rooms after a restart.

### Current Strengths

- Online health, timing, and match outcomes are primarily server-authoritative.
- Survival mode now uses deadline-based timing and can preserve hint, question, transition, and end-game delays across pause/resume.
- Socket listeners are generally cleaned up when multiplayer components unmount.
- Health values are clamped and survival elimination is centralized on the server.
- The backend fails fast if its question file cannot be loaded and handles shutdown signals.
- The question catalog is broad and uses progressive hints across many categories.
- The interface has a consistent visual theme, responsive breakpoints, and text values alongside visual health indicators.
- React renders player-controlled values safely rather than inserting raw HTML.

## Audit Baseline

The following is the state observed on 2026-08-21. These facts should be updated as milestones are completed.

| Area | Baseline |
| --- | --- |
| Roadmap/root documentation | No prior `ROADMAP.md` or root `README.md` |
| Frontend documentation | Contains unresolved Git conflict markers and Vite template text |
| Backend tests | Two passing survival lifecycle tests added; broader backend, frontend, integration, and E2E coverage is still absent |
| Measured loaded-backend coverage | 38.45% overall; no frontend, server, Redis, or E2E coverage |
| Frontend lint | Initially failed on generated `public/deps`; those 205 errors were excluded during integration. Lint exits successfully with one known hook-dependency warning |
| Backend lint/typecheck | Not configured |
| CI/CD | No CI workflow or deployment-as-code configuration |
| Question data | Backend has 1,323 entries; frontend is divergent. One nested array and the missing `q1543` answer found during this audit were repaired before integration |
| Repository hygiene | 1,372 tracked `node_modules` paths, tracked root `dist`, generated public dependency bundles, and `.DS_Store` |
| Package management | Separate root, frontend, and backend dependency trees without workspaces |
| Production recovery | Redis snapshots are written but never restored into active games |

## Guiding Principles

- Security and game integrity come before new game features.
- The server is authoritative for online identity, rules, clocks, health, statistics, and room lifecycle.
- One state transition must produce one outcome, even when events race or are retried.
- One canonical source should exist for questions, constants, event contracts, and environment documentation.
- A clean clone must be installable, testable, and deployable from repository instructions alone.
- Debug facilities must never expose secrets, infrastructure details, player data, or stack traces publicly.
- Accessibility, privacy, mobile behavior, and reduced motion are release requirements rather than polish.
- Redis behavior must be described truthfully: either implement recovery and distributed ownership or document a single-instance model.

## Decisions Required

Resolve these decisions before the dependent milestones. Record the result in this file or an architecture decision record.

| ID | Decision | Recommended direction | Blocks |
| --- | --- | --- | --- |
| D-01 | Is production single-instance or horizontally scalable? | Use a documented single-instance model first; add distributed room ownership only when needed | Redis recovery, deployment, matchmaking |
| D-02 | Must active games survive process restarts? | Either fully hydrate rooms and timers or stop calling snapshots persistence | Reliability claims, health checks |
| D-03 | How is reconnect identity proven? | Opaque random reconnect token bound to player ID, room ID, mode, and expiry | Secure reconnect |
| D-04 | Are duplicate display names allowed? | Allow display-name duplicates only if all logic uses stable server IDs | Results, reconnect, health UI |
| D-05 | What does category matchmaking promise? | Match the UI copy, then test the chosen same-category/different-category behavior | Matchmaking and question selection |
| D-06 | How does survival time damage work? | Choose per-hint or per-second and use one shared constant/copy source | Rules, UI, tests |
| D-07 | How does survival end after the question limit? | Define sole-survivor, ranking, tie, and multiple-survivor rules | Results and copy |
| D-08 | Which question data is canonical? | Keep online answers server-only; generate a validated local-mode subset if needed | Data integrity and anti-cheat |
| D-09 | Is advertising part of the product now? | Remove AdSense until there is a placement, consent flow, and privacy policy | Privacy and performance |
| D-10 | How do local and online duels resolve equal health/scores? | Represent a tie explicitly unless a documented secondary rule applies | Results, statistics, and copy |

## Delivery Plan

### Milestone 0: Integrate Current Lifecycle Work

Priority: P0

Goal: land the current survival pause/reconnect work safely before layering more room-state changes on top of it.

| Status | Deliverable | Acceptance criteria |
| --- | --- | --- |
| `IN PROGRESS` | Deadline-based survival pause/resume | Hint/question timing has unit coverage; transition and delayed-end timing still need integration coverage |
| `DONE` | Prevent duplicate socket handler registration on reconnect | Reconnecting does not process one event more than once |
| `IN PROGRESS` | Restore survival state in the client | Current question/timer/health/hints restore; transition/end-game phase and pending action are still incomplete |
| `IN PROGRESS` | Improve server-synced timer handling | Timer uses authoritative remaining duration but still needs component/integration coverage |
| `DONE` | Add lifecycle regression tests to version control | Current two tests are included and exposed through `npm test` |
| `TODO` | Run integration verification | Survival disconnect/reconnect works before a hint, during a question, during transition, and before game end |

Exit criteria:

- The test file is version-controlled and the current survival tests pass from a clean install through `npm test`.
- No stale timer fires while the room is paused.
- Reconnect does not duplicate listeners, hints, damage, transitions, or results.
- Reconnect state explicitly identifies lobby, active-question, transition, paused, and delayed-end phases and restores the correct pending action/deadline.
- The current modified files are reviewed and committed as one coherent change.

### Milestone 1: Secure and Correct the Playable Core

Priority: P0 for socket security, reconnect identity, timeout integrity, matchmaking lifecycle, data integrity, and production exposure. Remaining items are P1 production-baseline work unless marked otherwise in the improvement register.

Goal: eliminate remotely exploitable behavior, cheating paths, corrupt content, and state-machine defects before the next production release.

#### Socket Boundary and Identity

- [ ] Add strict schemas for every inbound Socket.IO event, including object shape, string lengths, enums, IDs, and category values.
- [ ] Put every synchronous and asynchronous socket handler behind a shared error boundary so malformed events cannot crash the process.
- [ ] Add per-IP and per-socket limits for connections, matchmaking requests, reconnect checks, and guesses.
- [ ] Reject matchmaking and room actions when a socket is already queued or assigned to a room.
- [ ] Replace name-plus-room reconnect with a cryptographically random reconnect token.
- [ ] Never reveal reconnectable room IDs in response to an unauthenticated display-name lookup.
- [ ] Use stable server-issued player IDs for health, results, winner detection, reconnect, and roster updates.
- [ ] Normalize and length-limit codenames; define duplicate-name and abusive-name behavior.

Acceptance criteria:

- Invalid or missing payloads produce a bounded error response and never terminate the server.
- Every limited event has documented burst and sustained quotas; automated tests accept within-quota traffic and reject over-quota traffic.
- Knowing another player's display name and room ID is insufficient to take over that session.
- A socket cannot become both players in a duel or participate in multiple rooms.

#### Room State Machines

- [ ] Mark a regular multiplayer question complete before broadcasting a timeout result.
- [ ] Make answer, timeout, disconnect, and transition completion idempotent.
- [ ] Track every first-hint, hint, question, transition, reconnect, and end-game timer by deadline.
- [ ] Resume exact remaining time instead of granting a fresh hint interval or question timeout.
- [ ] Reject guesses while paused, after timeout, between rounds, after elimination, or after game end.
- [ ] Disable the corresponding inputs in both multiplayer clients and show why input is unavailable.
- [ ] Prevent eliminated/spectating survival players from pausing an active game when they disconnect.
- [ ] Ensure pending local AI callbacks cannot modify health or results after the local game completes or resets.
- [ ] Prevent simultaneous AI, player, and timeout callbacks from resolving the same local question twice.
- [ ] Define tie/no-winner behavior for local and online duels instead of silently choosing the AI or first result.

Acceptance criteria:

- Every question has exactly one terminal outcome and exactly one next-question transition.
- Fake-clock tests prove disconnect/resume preserves the same deadline without adding time; integration tests use a documented timing tolerance.
- Late answers cannot deal damage after the answer has been revealed.
- A completed local game cannot be mutated by delayed AI work.
- Eliminated/spectating players cannot pause or otherwise block remaining survival players.
- Equal duel scores/health produce the explicitly selected tie rule on server and client.

#### Matchmaking and Room Lifecycle

- [ ] Add explicit `cancelMatchmaking`, `leaveRoom`, and `rosterUpdated` events.
- [ ] Remove cancelled players immediately from waiting rooms and queued player state.
- [ ] Handle `matchTimeout`, `serverError`, `serverShutdown`, reconnect exhaustion, and transport failure in both multiplayer clients.
- [ ] Return survival clients from briefing to a usable lobby if readiness changes before start.
- [ ] Remove departed lobby players from all survival rosters, health maps, and readiness calculations.
- [ ] Validate room type before reconnecting and reject cross-mode restoration.
- [ ] Fully close/reset the current socket before "Start New Game" or mode switching.
- [ ] Define configured, concrete cleanup deadlines for completed, abandoned, and all-disconnected rooms.
- [ ] Stop periodic Redis saves for terminal rooms and delete expired room/player snapshots.

Acceptance criteria:

- Cancelled searches cannot later match.
- Queue timeout always returns the player to a clear retry state.
- Lobby rosters match the connected server roster.
- Every terminal or abandoned room is removed from memory and Redis within its tested configured deadline.

#### Question Integrity and Anti-Cheat

- [x] Fix the malformed frontend JSON: flatten the nested array and restore the missing answer for `q1543`.
- [ ] Select one canonical question source and remove manually maintained divergent copies.
- [ ] Add schema checks for required fields, top-level shape, unique IDs, allowed categories, difficulty, answer aliases, and exactly five usable hints.
- [ ] Fail tests/build/startup on malformed or duplicate content.
- [ ] Fix answer matching when normalization produces zero keywords, including numeric and short answers such as `1984`, `5G`, `K2`, or `U2`.
- [ ] Specify one Unicode-aware normalization and alias policy, then test punctuation, accents, symbols, numbers, abbreviations, and near misses.
- [ ] Make local AI validation server-authoritative or generate a disjoint browser-safe local pool that online matchmaking never uses.
- [ ] Repair local diverse-question selection, which currently counts values in a `Set` and cannot enforce intended diversity.
- [ ] Pass real hint metadata to the local `Question` model so hint count, ordering, and scoring are internally consistent.

Acceptance criteria:

- Every content record passes the same automated validator.
- Frontend and backend content cannot silently drift.
- An arbitrary guess is never accepted because an answer normalized to no keywords.
- No browser asset, including lazy-loaded local-mode chunks, contains answers used by online matchmaking.

#### Production Security and Privacy

- [ ] Remove the hardcoded remote Redis fallback and require explicit production configuration.
- [ ] Require authenticated TLS Redis or an explicitly documented private trusted network; reject insecure public Redis endpoints.
- [ ] Disable or strongly authenticate `/admin/redis-test`, `/admin/redis-connections`, and `/admin/stats`.
- [ ] Never return Redis keys, client addresses, stack traces, or process internals to public clients.
- [ ] Replace Redis `KEYS` operations with bounded `SCAN` where enumeration is still required.
- [ ] Drive allowed origins from validated environment configuration; do not trust every `*.vercel.app` origin by default.
- [ ] Add request-size limits, security headers, safe error serialization, and structured security logging.
- [ ] Remove AdSense loading or gate it behind consent, a real placement, and documented privacy behavior.
- [ ] Review historical `.env` commits and rotate any credentials that may have been exposed.
- [ ] Create a data inventory and retention/deletion policy for codenames, room snapshots, match summaries, logs, and analytics.
- [ ] Publish player-facing privacy information before retaining player data beyond an active session.

Acceptance criteria:

- Production refuses to boot with required secrets/configuration missing.
- Public routes expose only intentional health/version data.
- Cross-origin access is limited to configured deployments.
- No third-party advertising request occurs before consent.
- Every stored player-data field has a documented purpose, TTL, deletion path, and log-redaction rule.

### Milestone 2: Establish a Reproducible Quality Gate

Priority: P0/P1

Goal: make every change verifiable from a clean clone and prevent known regressions from re-entering the main branch.

#### Repository and Package Structure

- [ ] Choose npm workspaces or remove the unused root package and lockfile.
- [ ] Remove the legacy root `socket.io-redis` and redundant Redis dependency tree.
- [ ] Remove unused `@ctrl/react-adsense` dependencies from frontend and backend if advertising is not implemented.
- [ ] Stop tracking root/backend `node_modules`, root `dist`, `frontend/public/deps`, and `.DS_Store`.
- [ ] Expand `.gitignore` for dependencies, build output, coverage, logs, editor files, OS metadata, and generated assets.
- [ ] Pin Node 22 LTS and npm with `engines`, `packageManager`, and `.nvmrc` or `.node-version`.
- [ ] Add root scripts for `dev`, `lint`, `test`, `test:coverage`, `typecheck`, `build`, and `validate`.
- [ ] Use `npm ci` in automated environments.

#### Linting, Static Checks, and Formatting

- [x] Exclude generated vendor files from lint inputs and remove all frontend lint errors.
- [ ] Fix the outstanding React Hooks dependency warning in `OneVsOne.jsx` as part of the local state-machine cleanup.
- [ ] Add backend ESLint rules and lint scripts.
- [ ] Enable JavaScript typechecking with `checkJs` or plan an incremental TypeScript migration.
- [ ] Define and validate the Socket.IO event contract on both client and server.
- [ ] Consolidate duplicate PostCSS configuration into one source of truth.
- [ ] Add EditorConfig and a formatter; optionally add staged-file checks after CI is stable.

#### Automated Tests

- [ ] Expose the tracked survival tests through package scripts and replace timing-sensitive sleeps with fake or injected clocks.
- [ ] Add `Question` unit tests for exact, normalized, alias, numeric, punctuation, Unicode, short-answer, and rejection cases.
- [ ] Add `GameRoom` tests for timeout races, pause/resume, damage, transitions, disconnects, and result generation.
- [ ] Add `SurvivalRoom` tests for lobby departures, readiness rollback, elimination, ties, question-limit ending, and cleanup.
- [ ] Add `GameManager` tests for queue cancellation, duplicate matchmaking, room type, reconnect authorization, expiry, and shutdown.
- [ ] Add HTTP tests for liveness, readiness, CORS, admin authorization, and degraded dependencies.
- [ ] Add Socket.IO integration tests with multiple clients and an ephemeral Redis instance where Redis behavior matters.
- [ ] Add frontend component tests for timers, hints, disabled inputs, mode transitions, results, and reconnect state.
- [ ] Add Playwright smoke tests for login, local duel, online matchmaking, disconnect/reconnect, and survival lobby flow.
- [ ] Add a production-build smoke test that verifies expected assets and backend endpoint configuration.
- [ ] Set an achievable initial coverage floor and ratchet it upward rather than optimizing for a vanity percentage.

#### Continuous Integration

- [ ] Add CI for clean install, data validation, lint, typecheck, unit/integration tests, and production build.
- [ ] Require the CI workflow before merge.
- [ ] Cache dependencies without caching generated application output as source.
- [ ] Add scheduled dependency and security checks with Dependabot or Renovate.
- [ ] Add secret scanning and, later, SBOM/license checks.

Exit criteria:

- `npm run validate` passes from a clean clone on the pinned Node/npm version.
- Lint has zero errors and zero warnings.
- Question validation, critical room tests, and production build run on every pull request.
- Generated dependencies and stale build output are no longer source-controlled.

### Milestone 3: Make Production Behavior Reliable and Observable

Priority: P1

Goal: make deployment state, failure modes, recovery guarantees, and live operations explicit.

#### Redis and Scaling

- [ ] Implement D-01 and D-02: either support full recovery/distribution or deliberately simplify to single-instance in-memory rooms.
- [ ] If recovery is required, persist enough state to restore deadlines, phase, selected questions, hint index, round, health, statistics, readiness, elimination, and reconnect expiry.
- [ ] Version snapshot schemas and define atomic writes, compatibility across rolling deployments, and safe handling of missing, partial, expired, or corrupt snapshots.
- [ ] If scaling is required, add room ownership, distributed locking, shared matchmaking, sticky routing strategy, and cross-instance event delivery.
- [ ] Use Socket.IO rooms/adapter broadcasts instead of retaining and calling only local socket objects.
- [ ] Hydrate snapshots at startup and test restart during every game phase.
- [ ] Coalesce Redis writes rather than saving the complete room and answers after every guess.
- [ ] Prevent overlapping autosave passes and use bounded TTL/cleanup policies.

#### Configuration and Deployment

- [ ] Add `.env.example` files with safe placeholders and document every required/optional variable.
- [ ] Validate environment variables at process startup and fail with actionable messages.
- [ ] Remove client fallback to `http://localhost:10000` in production; fail the build when the backend URL is missing.
- [ ] Make frontend and backend deployment roots, build commands, start commands, health checks, and Node versions reproducible in code or documentation.
- [ ] Add deployment-as-code for the chosen platforms or containerize the services.
- [ ] Separate liveness from readiness so Redis-required deployments report degraded/unready correctly.
- [ ] Test graceful shutdown, deployment drains, and reconnect behavior during rolling releases.

#### Observability and Operations

- [ ] Replace ad hoc console output and emoji-prefixed logs with structured logs and request/room correlation IDs.
- [ ] Record bounded metrics for active sockets, queue depth, room count, match duration, reconnect success, errors, Redis latency, and cleanup.
- [ ] Add alerting for crash loops, readiness failures, Redis errors, abnormal queue time, event-rate spikes, and leaked rooms.
- [ ] Define service objectives for availability, matchmaking latency, reconnect success, and error rate after enough baseline data exists.
- [ ] Keep raw guesses, codenames, reconnect tokens, and answers out of analytics and logs.
- [ ] Add a production incident and rollback runbook.

Exit criteria:

- Health endpoints accurately distinguish alive, ready, and degraded states.
- The documented restart/scaling guarantee is proven by automated tests.
- Operators can detect failed matchmaking, Redis degradation, event abuse, and room leaks without exposing private data.
- A new environment can be deployed without undocumented dashboard knowledge.

### Milestone 4: Improve Frontend Quality and Maintainability

Priority: P1/P2

Goal: align the UI with real rules, meet accessibility expectations, reduce load cost, and make mode logic easier to change safely.

#### Rules and User Experience

- [ ] Make category mode descriptions, matching behavior, and question selection agree.
- [ ] Make category cards semantic keyboard controls and preserve an intentional selection/confirmation flow.
- [ ] Use shared constants for hint intervals, question duration, damage, health, question count, and reconnect windows.
- [ ] Apply D-06 consistently to server rules, client calculations, tests, and survival copy; do not preserve contradictory per-second/per-hint behavior.
- [ ] Correct the hardcoded next-hint timing and `/5` display in shared hint UI.
- [ ] Preserve real hint order and display the server-provided hint index instead of numbering reversed render order.
- [ ] Define and clearly present survival ranking, ties, multiple-survivor outcomes, and question-limit endings.
- [ ] Define and clearly present tie/no-winner behavior for local and online duels.
- [ ] Make statistics server-authoritative and preserve them across reconnect and disconnect victories.
- [ ] Provide explicit loading, queue, timeout, reconnect countdown, paused, retry, and server-unavailable states.
- [ ] Persist only intentional low-risk preferences, with a visible change-codename/logout action.

#### Accessibility

- [ ] Add programmatic labels and error/help text for codename and guess inputs.
- [ ] Use native buttons or correct keyboard roles for every clickable choice.
- [ ] Add `role="timer"`, status/live regions, accessible health values, and result/elimination announcements.
- [ ] Manage focus when dialogs, pauses, reconnect notices, and results appear.
- [ ] Preserve visible focus indicators and usable scrolling rather than hiding every scrollbar.
- [ ] Honor `prefers-reduced-motion` for pulse, spin, scale, and transition effects.
- [ ] Verify text contrast, zoom to 200%, keyboard-only play, and common screen-reader flows.
- [ ] Target WCAG 2.2 AA for all critical game flows.

#### Performance and Assets

- [ ] Lazy-load each game mode so visitors do not download all modes and Socket.IO code immediately.
- [ ] Keep server-only answers out of all browser chunks.
- [ ] Move background assets into Vite's supported asset flow and verify they exist in production output.
- [ ] Resize/compress large PNG backgrounds and provide responsive WebP/AVIF variants.
- [ ] Remove generated dependency bundles and source maps from `frontend/public`.
- [ ] Replace the missing `/vite.svg` favicon with a real HINTMAN icon.
- [ ] Establish bundle and image budgets from a measured baseline and enforce them in CI.
- [ ] Test desktop and mobile layout, low-bandwidth loading, reconnect, and background fallback behavior.

#### Code Structure

- [ ] Replace ad hoc multiplayer state updates with explicit reducers/state machines.
- [ ] Extract shared Socket.IO connection, session, reconnect, error, and cleanup behavior from both multiplayer modes.
- [ ] Break oversized mode components into transport/state orchestration and focused presentation components.
- [ ] Stop mixing mutable class instances with plain React state objects in local mode.
- [ ] Remove unused components/services or integrate them intentionally, including duplicated mode/category selection concepts.
- [ ] Keep reusable logic small and shared only where rules are genuinely identical.

Exit criteria:

- Rules displayed to users match server behavior and shared constants.
- Critical flows are keyboard and screen-reader usable and respect reduced motion.
- Initial assets no longer include the full question corpus or all game modes.
- Multiplayer modes share one tested connection/session layer without sharing unrelated presentation state.

### Milestone 5: Documentation and Project Governance

Priority: P1/P2

Goal: make the project understandable and maintainable by someone who did not build it.

- [ ] Add a root `README.md` with product overview, screenshots, architecture, prerequisites, installation, Redis setup, commands, tests, and troubleshooting.
- [ ] Replace the conflicted frontend README with frontend-specific development documentation.
- [ ] Add backend documentation for HTTP endpoints, Socket.IO events, payloads, errors, room lifecycle, and Redis behavior.
- [ ] Document the canonical question schema, validation command, authoring process, and synchronization/generation rules.
- [ ] Retire stale `update.md` claims or rewrite them as dated historical notes backed by repeatable validation.
- [ ] Make `replace_hints.py` path-independent, schema-aware, dry-run capable, and safe for the canonical source, or retire it.
- [ ] Move useful local-only guidance into tracked contributor documentation and remove stale claims about available modes and data paths.
- [ ] Add `CONTRIBUTING.md`, `SECURITY.md`, a license, package license metadata, and a responsible disclosure path.
- [ ] Add architecture decision records for reconnect identity, Redis/scaling, question delivery, category matchmaking, and survival end rules.
- [ ] Keep this roadmap current by moving completed work into a changelog/release note and adding links to issues or pull requests.

Exit criteria:

- A new contributor can run and test both services from tracked instructions.
- Public interfaces and environment variables are documented and match implementation.
- Content maintenance is repeatable and cannot silently corrupt one copy of the data.
- Security reporting, contribution expectations, and licensing are explicit.

### Milestone 6: Product Enhancements After Stabilization

Priority: P2/P3

These are intentionally sequenced after Milestones 1-5. They should not delay security, correctness, accessibility, recovery, or operational work.

| Status | Enhancement | Product value |
| --- | --- | --- |
| `OPTIONAL` | Rematch flow that reuses the same verified players/session | Reduces friction after a duel |
| `OPTIONAL` | Private room codes/invites | Supports playing with friends without public matchmaking |
| `OPTIONAL` | Better queue feedback and estimated wait state | Makes online mode feel responsive at low concurrency |
| `OPTIONAL` | Match summary/history stored with privacy-conscious retention | Gives players useful progression without storing raw guesses |
| `OPTIONAL` | Content feedback/reporting for ambiguous answers or hints | Improves question quality with traceable review |
| `OPTIONAL` | Curated difficulty/category balancing tools | Produces fairer decks and better replayability |
| `OPTIONAL` | Spectator or replay support | Adds social value after event contracts and privacy rules are stable |
| `OPTIONAL` | Seasonal missions, achievements, and leaderboards | Adds retention only after identity and anti-cheat are trustworthy |
| `OPTIONAL` | Localization | Broadens access after all rules/copy are centralized |

## Detailed Improvement Register

This register preserves audit findings that could otherwise be lost inside larger milestones.

| ID | Priority | Area | Confirmed issue | Planned resolution |
| --- | --- | --- | --- | --- |
| SEC-01 | P0 | Socket API | Inbound payloads are unvalidated and handlers can throw | Schemas, error boundary, payload limits |
| SEC-02 | P0 | Abuse prevention | Guess and matchmaking events have no rate limits | Per-IP/per-socket throttles and monitoring |
| SEC-03 | P0 | Reconnect | Public names and disclosed room IDs can take over sessions | Opaque reconnect token and stable player ID |
| SEC-04 | P0 | Admin API | Public debug routes leak keys, addresses, stacks, memory, and room data | Disable/authenticate and sanitize |
| SEC-05 | P0 | CORS | Broad Vercel wildcard is trusted with credentials | Environment allowlist |
| SEC-06 | P0 | Privacy | AdSense loads globally before consent and without a placement | Remove or consent-gate |
| SEC-07 | P0 | Redis transport | Production fallback uses unauthenticated plaintext Redis transport | TLS/authentication or private trusted network |
| SEC-08 | P1 | Privacy governance | Persisted codenames/room data lack an explicit inventory, retention, deletion, and disclosure policy | Data lifecycle and player privacy documentation |
| GAME-01 | P0 | Duel timeout | Late answers remain valid after timeout and can schedule a second transition | Idempotent terminal state before broadcast |
| GAME-02 | P0 | Matchmaking | Cancel search is client-only; duplicate/self matching is possible | Server-side queue lifecycle and membership guard |
| GAME-03 | P0 | Match timeout | Clients do not handle server `matchTimeout` | Explicit timeout UI and state cleanup |
| GAME-04 | P0 | Survival lobby | Departures leave ghost roster entries and can strand briefing | Authoritative roster and readiness rollback |
| GAME-05 | P0 | Timers | Regular room leaves some timers untracked and resets time on resume | Deadline-based state machine |
| GAME-06 | P0 | Identity | Name-based UI logic breaks with duplicate names | Use player IDs everywhere |
| GAME-07 | P0 | Local mode | Pending AI timeouts and simultaneous callbacks can mutate completed state | Track/cancel tasks and gate terminal state |
| GAME-08 | P1 | Reconnect | A client can restore the wrong game mode | Bind token/state to room type |
| GAME-09 | P1 | Navigation | Starting another mode can reuse a stale socket and remain connecting | Explicit leave/disconnect/reset flow |
| GAME-10 | P1 | Statistics | Reconnect resets duel statistics and disconnect results can omit players | Server-owned persistent match stats |
| GAME-11 | P1 | Input UX | Paused/between-round guesses are cleared even when ignored | Disable input and return acknowledgements |
| GAME-12 | P1 | Rules | Category matching/selection contradicts its UI | Decide and centralize behavior/copy |
| GAME-13 | P1 | Rules | Survival damage timing and result wording contradict implementation | Decide and centralize behavior/copy |
| GAME-14 | P1 | Hints | Hints render newest-first with misleading numbers and hardcoded totals | Preserve indexed order and dynamic totals |
| GAME-15 | P1 | Duel results | Equal local/online duel outcomes silently pick a winner | Explicit tested tie/no-winner rule |
| GAME-16 | P1 | Survival pause | Eliminated players remain reconnectable and can pause active survivors | Restrict pause authority to active players |
| GAME-17 | P1 | Local hints | Local `Question` is created without the hint metadata used by hint UI/scoring | Pass and test one consistent hint model |
| DATA-01 | P0 | Questions | Audit found a nested array and a missing answer in frontend data | Repaired; add schema validation to prevent recurrence |
| DATA-02 | P0 | Answers | Numeric/short answers can normalize to zero keywords and accept any guess | Explicit zero-keyword fallback and tests |
| DATA-03 | P0 | Anti-cheat | Browser bundle contains the online answer bank | Server-only online content and code splitting |
| DATA-04 | P0 | Source of truth | Frontend/backend question files have diverged | Canonical dataset and generated consumers |
| DATA-05 | P1 | Selection | Local diversity logic misuses a `Set` count | Correct/test deck construction |
| REL-01 | P1 | Persistence | Redis snapshots are never hydrated and omit reconstructive state | Implement full recovery or remove the claim |
| REL-02 | P1 | Scaling | Rooms and sockets remain process-local despite Redis adapter | Single-instance contract or distributed ownership |
| REL-03 | P1 | Cleanup | Fully disconnected survival rooms can live forever | Terminal cleanup independent of roster length |
| REL-04 | P1 | Redis load | Full snapshots are written per guess and `KEYS` can block Redis | Coalesce writes, use `SCAN`, bounded jobs |
| REL-05 | P1 | Health | Service reports healthy while Redis-backed guarantees are unavailable | Separate liveness/readiness/degraded state |
| REL-06 | P1 | Recovery format | Snapshots have no schema version, atomicity, compatibility, or corruption strategy | Versioned atomic snapshots and recovery policy |
| DX-01 | P0 | CI | No automated merge gate exists | CI validation workflow |
| DX-02 | P0 | Tests | Only two backend tests exist and wider coverage is absent | Expand unit/integration/E2E coverage |
| DX-03 | P0 | Lint | Frontend lint errors were removed during integration; one hook warning remains and backend has no lint | Fix the warning, add backend lint, and remove generated public assets |
| DX-04 | P1 | Types/contracts | No typecheck or shared event contract | `checkJs`/TypeScript and runtime schemas |
| DX-05 | P0 | Dependencies | Root legacy adapter pulls obsolete Redis/debug dependencies | Workspaces or remove root tree |
| DX-06 | P0 | Repository | Dependencies and stale build artifacts are tracked | Untrack generated files and improve ignores |
| DX-07 | P1 | Runtime version | Backend allows Node 18 while current Vite requires newer Node | Pin Node 22 LTS and npm |
| DX-08 | P1 | Deployment | Platform settings and environment requirements are undocumented | Deployment-as-code and env examples |
| DX-09 | P1 | Documentation | Frontend README has conflict markers; no root/backend docs | Rewrite tracked documentation |
| DX-10 | P2 | Maintenance | Hint replacement script uses an absolute path and one data copy | Make safe/path-independent or retire |
| UI-01 | P1 | Accessibility | Inputs lack labels; clickable divs, timers, and statuses lack semantics | WCAG 2.2 AA pass |
| UI-02 | P1 | Motion/scroll | Scrollbars are hidden and motion ignores user preference | Visible scrolling and reduced-motion styles |
| UI-03 | P1 | Performance | All modes and a large question file load eagerly | Route/mode code splitting and server-only answers |
| UI-04 | P1 | Assets | Large backgrounds are outside the reliable Vite public/import path | Optimize and manage through Vite |
| UI-05 | P2 | Maintainability | Multiplayer components duplicate transport/state logic and exceed 900 lines | Shared session layer and focused components |
| UI-06 | P2 | State model | Local mode mixes mutable classes and plain React objects | One immutable state model/reducer |

## Suggested Execution Order

1. Review and integrate the current survival lifecycle changes.
2. Repair/validate question data and stop exposing online answers in the browser.
3. Validate and rate-limit the socket boundary.
4. Add token-based reconnect and stable player identity.
5. Fix duel timeout idempotency and all timer state transitions.
6. Add server-side cancel/leave/roster lifecycle and room cleanup.
7. Remove public admin exposure, hardcoded Redis fallback, and premature AdSense loading.
8. Establish tracked tests, passing lint, pinned tooling, and CI.
9. Decide and implement the honest Redis/restart/scaling model.
10. Align rules/copy, accessibility, performance, and component structure.
11. Complete documentation, governance, observability, and deployment automation.
12. Consider optional product enhancements only after the production baseline is met.

## Release Gates

No production release should proceed until the applicable gate is green.

### Security Gate

- [ ] Socket payload validation and event rate limits are enabled.
- [ ] Reconnect cannot be claimed with public information.
- [ ] Admin/debug routes are private or disabled.
- [ ] Required secrets/configuration have no hardcoded production fallback.
- [ ] No third-party advertising request occurs without the chosen consent policy.

### Correctness Gate

- [ ] Question data validation passes.
- [ ] Timeout/answer/disconnect transitions are idempotent.
- [ ] Queue cancel, leave, reconnect, and cleanup integration tests pass.
- [ ] Displayed rules match tested server rules.
- [ ] Online answers are absent from browser assets.

### Quality Gate

- [ ] Clean install, lint, typecheck, tests, and production build pass in CI.
- [ ] Critical frontend flows pass keyboard and screen-reader checks.
- [ ] Production assets include backgrounds/icons and exclude generated vendor debris.
- [ ] No dependencies or build output are tracked as source.

### Operations Gate

- [ ] Liveness/readiness behavior matches the selected Redis architecture.
- [ ] Deployment and rollback are documented and reproducible.
- [ ] Logs/metrics can identify room leaks, reconnect failures, and Redis degradation.
- [ ] Privacy-sensitive values are excluded from logs and analytics.

## Validation Commands

### Available Today

```bash
# Backend server
cd backend
npm start

# Current backend tests (not yet exposed as an npm script)
node --test test/survival-room.test.js

# Frontend development and build
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

Current audit results:

- `npm test` in `backend/`: 2 passed, 0 failed.
- `npm run lint` in `frontend/`: exits successfully after excluding generated public dependencies, with one known local game-loop hook warning.
- `npm run build` in `frontend/`: passes; Vite reports a large-bundle warning that remains tracked as performance work.
- There is no declared root validation, backend lint, typecheck, frontend test, integration test, E2E test, or CI command yet.

### Target Developer Interface

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run validate
```

## Definition of Production Ready

HINTMAN is production ready when all P0 work and the required P1 production-baseline work are complete and the following statements are true:

- A malicious or malformed client cannot crash the server, flood expensive work, join multiple rooms, or steal a reconnecting session.
- Online games have deterministic, server-authoritative state transitions and cleanup.
- Question data is valid, canonical, tested, and does not leak multiplayer answers.
- A clean clone can be installed, validated, built, and deployed on pinned tooling using tracked instructions.
- CI protects data integrity, lint, contracts/types, tests, and production builds.
- The selected restart/scaling guarantee is accurate, documented, monitored, and tested.
- Critical desktop and mobile flows meet the accessibility and privacy baseline.
- Operators can detect failures without public debug endpoints or sensitive logs.

## Roadmap Maintenance

- Review this roadmap after each merged milestone.
- Link completed items to issues or pull requests and record meaningful release notes.
- Re-run the repository audit before changing priority or claiming production readiness.
- Keep audit counts and command results dated so temporary working-tree state is not mistaken for a permanent fact.
- Do not mark optional product work as active while any P0 security, integrity, or correctness gate is open.
