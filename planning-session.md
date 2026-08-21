# Planning Session

Date: 2026-04-08

## Project Summary

HINTMAN is a full-stack real-time deduction game.

- `frontend/` is a React + Vite app with three modes:
  - local 1v1 vs AI
  - online 1v1 multiplayer
  - survival battle royale
- `backend/` is an Express + Socket.IO server that handles matchmaking, room state, hints, health, and results.
- Redis is used for the Socket.IO adapter and room/player snapshotting.

## Key Review Findings

1. Survival disconnect/reconnect was broken because `GameManager` tried to pause/resume survival rooms, but `SurvivalRoom` did not implement that lifecycle.
2. Reconnect identity is weak: reconnect uses only `playerName` and `roomId`.
3. Reconnect previously reattached duplicate socket listeners in `GameManager`.
4. Matchmaking cancel/leave is incomplete, which can leave ghost waiting rooms.
5. Frontend rules text and backend rules have drifted in a few places.
6. Single-player mode mutates class-based state directly and should be simplified.
7. Redis currently behaves more like snapshot storage than true crash recovery.
8. Docs/tests/repo hygiene need work: stale docs, tracked build output, little automated coverage.

## Prioritized Implementation Plan

### Fix Now

1. Stabilize survival disconnect/reconnect.
   - Files: `backend/src/services/GameManager.js`, `backend/src/models/SurvivalRoom.js`, `frontend/src/components/modes/CodenameSurvival.jsx`
   - Goal: pause the room on disconnect, preserve timer state exactly, restore correctly on reconnect, and handle permanent disconnects safely.

2. Secure reconnect and remove duplicate listener registration.
   - Files: `backend/src/services/GameManager.js`, `frontend/src/components/modes/OneVsOneMultiplayer.jsx`
   - Goal: move to a server-issued reconnect token/session key and ensure reconnect does not double-register handlers.

3. Add real cancel/leave matchmaking.
   - Files: `frontend/src/components/modes/OneVsOneMultiplayer.jsx`, `frontend/src/components/modes/CodenameSurvival.jsx`, `backend/src/services/GameManager.js`
   - Goal: allow players to leave queues cleanly and prevent ghost rooms/timeouts.

4. Lock down unsafe backend exposure.
   - Files: `backend/server.js`
   - Goal: remove hardcoded production Redis fallback and protect or disable admin/debug endpoints outside trusted environments.

5. Add critical backend tests.
   - Files: backend test setup around room lifecycle and reconnect flows.
   - Goal: cover matchmaking, cancel search, disconnect/reconnect, and survival room timing.

### Next

1. Sync frontend messaging with backend rules.
   - Files: `frontend/src/components/game/CategorySelector.jsx`, `frontend/src/components/modes/CodenameSurvival.jsx`

2. Fix single-player state management.
   - Files: `frontend/src/components/modes/OneVsOne.jsx`, `frontend/src/classes/Player.js`, `frontend/src/classes/Question.js`

3. Refactor oversized mode components.
   - Files: `frontend/src/components/modes/OneVsOne.jsx`, `OneVsOneMultiplayer.jsx`, `CodenameSurvival.jsx`

4. Centralize shared game constants and event contracts.
   - Goal: reduce frontend/backend drift in timing, damage, question counts, and payload shapes.

5. Clean UI implementation issues.
   - Files: `frontend/src/components/game/CategorySelector.jsx`, `HintDisplay.jsx`, `MissionTracker.jsx`, `App.jsx`, `GuessInput.jsx`, `frontend/tailwind.config.js`

6. Fix repo hygiene and docs.
   - Files: `frontend/README.md`, root docs, tracked `dist/` artifacts, package manifests.

### Later

1. Decide whether Redis should support real restore-on-boot or remain snapshot/cache support only.
2. Improve room lifecycle cleanup for finished and abandoned rooms.
3. Add rate limiting and payload validation.
4. Add frontend automated tests for answer matching, timer behavior, and multiplayer state transitions.

## Recommended Execution Order

1. Survival disconnect/reconnect fix
2. Reconnect token plus listener cleanup
3. Matchmaking cancel/leave flow
4. Backend critical-path tests
5. Rules copy sync
6. Single-player state cleanup
7. Frontend refactor and UI cleanup
8. Redis strategy and production hardening

## Decision Made In This Session

We chose the full fix for survival pause/resume rather than the minimal temporary workaround.

## Work Completed In This Session

Implemented full survival pause/resume support.

- Replaced interval-based survival timing with exact deadline-based scheduling in `backend/src/models/SurvivalRoom.js`
- Added pause/resume preservation for:
  - next hint timing
  - question timeout timing
  - round transition timing
  - delayed end-game timing
- Updated `backend/src/services/GameManager.js` so reconnect does not duplicate socket listeners
- Added survival reconnect state restoration for the frontend in `frontend/src/components/modes/CodenameSurvival.jsx`
- Updated `frontend/src/components/common/Timer.jsx` to handle server-synced remaining durations more safely
- Added backend tests in `backend/test/survival-room.test.js`

## Verification Performed

- `node --test "backend/test/survival-room.test.js"`
- `npm run build` in `frontend/`

## Suggested Next Task

Implement a real `leaveQueue` / `cancelMatchmaking` flow, or harden reconnect security with a proper reconnect token.
