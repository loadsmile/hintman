# 🎯 Hintman

A Hitman-inspired trivia game where you race against an AI opponent to identify a hidden target from a sequence of progressively revealed hints. Each round is a "contract" — guess early for big damage, or wait for more clues and risk the AI shooting first.

***

## Features

- **One vs One — Agent vs AI**\
  Head-to-head mode, where you play as a field agent against Agent 47. Both sides start with a health bar and take damage based on how fast the other side answers correctly.

- **Progressive hint system**\
  Each target has up to 5 hints that unlock on a timer. The earlier you answer, the more damage you deal to your opponent.

- **Smart AI opponent**\
  The AI makes probabilistic guesses tied to how many hints are visible. It rarely fires early and becomes more dangerous as hints pile up.

- **Timer-driven rounds**\
  Each target has a 120-second clock. When it expires, no health is lost and the game moves on — missing a target is not a death sentence.

- **No penalty for wrong guesses**\
  You can fire as many shots as you want. Only correct answers trigger health changes.

- **300-question bank**\
  Questions span Science, History, Geography, Art, Entertainment, Sports, Culture, Food, and Technology — across easy, medium, and hard levels of difficulty.

- **Hitman-style UI**\
  Health bars, "Mission Briefing" start screen, agent codenames, and result banners themed around contracts, targets, and shots fired.

***


## Tech Stack

| Layer      | Choice                                     |
| ---------- | ------------------------------------------ |
| UI         | React (function components + hooks)        |
| Game logic | Custom `Player` and `Question` classes     |
| Data       | `questions.json` — 300 trivia entries      |
| Styling    | Tailwind CSS utility classes               |
| Bundler    | Vite (or CRA — adjust scripts accordingly) |

***


## Getting Started

## Prerequisites

- Node.js v18+

- npm or yarn


## Installation

    bash
    # Clone the repo
    git clone https://github.com/<your-username>/hintman.git
    cd hintman

    # Install dependencies
    npm install
    # or
    yarn install


## Development server

    bash
    npm run dev
    # or
    yarn dev

Open the URL printed in your terminal — typically `http://localhost:5173` for Vite.


## Production build

    bash
    npm run build
    npm run preview
    # or
    yarn build && yarn preview

***


## Project Structure

    text
    .
    ├── src/
    │   ├── components/
    │   │   ├── modes/
    │   │   │   └── OneVsOne.jsx        # Head-to-head Agent vs AI mode
    │   │   ├── game/
    │   │   │   ├── HintDisplay.jsx     # Renders revealed hints
    │   │   │   └── GuessInput.jsx      # Player guess input field
    │   │   └── common/
    │   │       ├── Timer.jsx           # Round countdown timer
    │   │       ├── Button.jsx
    │   │       └── LoadingSpinner.jsx
    │   ├── classes/
    │   │   ├── Player.js               # Health, stats, reset logic
    │   │   └── Question.js             # Hints, answer checking, timing
    │   ├── data/
    │   │   └── questions.json          # 300 trivia questions
    │   └── App.jsx                     # Mode routing and top-level layout
    └── package.json

***


## Gameplay Flow

A full walkthrough of a One vs One session from start to finish.


## 1. Mission Briefing

When you start the game, a briefing screen outlines the rules:

- You will face **5 targets** (questions)

- Hints are free — wait for more clues or answer early

- Speed matters: fewer hints visible = more damage dealt

- Wrong answers and timeouts carry no penalty

- The agent with the most health after 5 targets wins

Click **BEGIN MISSION** to start.

***


## 2. Question deck is built

The game shuffles all 300 questions and picks 5 for the session. They are stored in order for the current match — no repeats within a single game.

***


## 3. Round starts

A `Question` instance is created from the selected data. Both health bars appear. The round timer begins.

    text
    TARGET: 1 / 5
    Category: Geography
    Hint 0/5 · Damage: 1000 HP

    [ ████████████████████  PLAYER   5000 HP ]
    [ ████████████████████  AGENT 47 5000 HP ]

***


## 4. Hints reveal over time

- The **first hint** appears \~1 second after the round starts

- **Each subsequent hint** unlocks every 15 seconds

- As hints accumulate, the damage potential of a correct answer drops:

<!---->

    text
    Hint 1 visible → correct answer deals 1000 HP
    Hint 2 visible → correct answer deals  800 HP
    Hint 3 visible → correct answer deals  600 HP
    Hint 4 visible → correct answer deals  400 HP
    Hint 5 visible → correct answer deals  200 HP

***


## 5. You guess

Type your answer and submit. The `Question` class checks it using partial word matching — you do not need to be letter-perfect, but you need to hit the key words.

- **Correct** → AI loses HP based on how many hints were showing. A result banner fires. The round advances after a 3-second pause.

- **Wrong** → A brief "missed shot" banner appears. The round continues. No health change.

***


## 6. The AI is also guessing

At each hint reveal, the AI schedules a probabilistic guess attempt with a random 2–8 second delay. If the AI fires a correct answer before you:

- **You** lose HP based on the current hint count

- The banner shows `"Agent 47 shot first!"`

- The round advances after 3 seconds

A question ID system ensures that once a round ends — no matter who triggered it — all remaining pending AI guesses for that round are blocked. Only one outcome fires per round.

***


## 7. Timer runs out

If neither side answers correctly within 120 seconds:

- No health changes occur

- The banner shows `"Target escaped — no penalties"`

- The game moves to the next target

***


## 8. Repeat for all 5 targets

After each round the game:

1. Shows the result banner for 3 seconds

2. Loads the next question from the pre-built deck

3. Resets hints, the timer, and the AI guess state

***


## 9. Game ends

After 5 rounds — or if a player's health hits 0 — the final screen appears:

    text
    🏆 MISSION ACCOMPLISHED   or   💀 MISSION FAILED

    Agent [You]    4200 HP   3/5 correct
    Agent 47       2600 HP   2/5 correct

    [ 🔄 NEW MISSION ]     [ 🏠 BACK TO HQ ]

The winner is whoever has more health remaining. If a player is eliminated mid-game (HP hits 0), the game ends immediately without waiting for the remaining targets.

***


## Game Modes

## One vs One — Agent vs AI

Single player facing off against a probabilistic AI opponent across 5 questions. No penalties for wrong answers or timeouts. Win on health differential.


## Contract Elimination

Up to 6 players, last agent standing. Players are eliminated round by round based on health. Wrong answers **do** cost health in this mode. Inspired by GeoGuessr Battle Royale.


## Solo Time Attack

Clear as many targets as possible within a fixed time window. No opponent — just speed and accuracy.

***


## Damage System

Damage is tied to how many hints were visible when the correct answer was submitted.

| Hints visible | Damage dealt |
| :-----------: | :----------: |
|       1       |    1000 HP   |
|       2       |    800 HP    |
|       3       |    600 HP    |
|       4       |    400 HP    |
|       5       |    200 HP    |

Both sides start with **5000 HP**. A full game of 5 targets, all answered on hint 1, would deal exactly 5000 HP — enough to eliminate.

***


## AI Behavior

The AI does not "know" the answer. It operates on probability: each hint reveal gives it a chance to fire, with success rate scaling with hint count.

| Hints visible | AI correct guess chance |
| :-----------: | :---------------------: |
|       1       |           15%           |
|       2       |           25%           |
|       3       |           50%           |
|       4       |           65%           |
|       5       |           80%           |

The AI waits a random delay of 2–8 seconds after each hint before deciding whether to guess. This prevents it from reacting instantly and creates a believable thinking pause. Once a correct guess fires, all remaining queued guesses for that round are invalidated.

***


## Question Data Model

`questions.json` is a flat array. Each entry follows this shape:

    json
    {
      "id": 42,
      "answer": "The Pacific Ocean",
      "category": "Geography",
      "difficulty": "medium",
      "hints": [
        "It is the largest and deepest ocean on Earth.",
        "It borders Asia, Australia, and the Americas.",
        "It covers more area than all landmasses combined.",
        "Its name comes from the Latin word for 'peaceful'.",
        "The Mariana Trench, the deepest known point on Earth, lies within it."
      ]
    }


## Adding new questions

- Keep `answer`, `category`, `difficulty`, and `hints` present on every entry

- Aim for at least 3 hints per question; 5 is ideal

- Avoid duplicate answers to keep match stats clean

- `difficulty` accepts: `"easy"`, `"medium"`, `"hard"`

***


```
```
