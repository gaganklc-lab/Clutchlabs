# ClutchTap — Reflex Challenge Game

A fast-paced mobile reflex game built with React Native (Expo). Tap the right tiles following ever-changing rules under time pressure. Features multiple game modes, combo multipliers, achievement badges, power-ups, daily challenges, and polished visual effects — optimized for both iPhone and iPad.

## Features

### Game Modes
- **Regular** — Timed gameplay with Easy, Normal, and Hard difficulty. Race the clock and manage your lives.
- **Endless** — No timer. Difficulty ramps up every 30 seconds with increasing tile speed. Only lives end the game.
- **Zen** — No timer, no lives, no score. Practice mode for learning rules at your own pace.

### Core Mechanics
- **Rotating Rules** — Rules change every few seconds: "Tap BLUE", "Tap NOT RED", "Tap the FLASHING tile"
- **Combo System** — Consecutive correct taps build a multiplier up to 5x with a visual progress bar
- **Frenzy Mode** — The last 10 seconds of Regular mode ramp up visual intensity
- **Daily Challenge** — A unique daily seed generates a fixed rule sequence for everyone
- **Performance Ranking** — S/A/B/C/D rank based on score, accuracy, combo, and difficulty

### Progression
- **XP & Leveling** — Earn XP each game with score-based rewards and bonuses. Level up from Beginner to Godlike.
- **12 Achievement Badges** — Track milestones like "First Blood", "Combo King", "Speed Demon", and more
- **Daily Login Rewards** — 7-day XP reward cycle (25–300 XP) with streak milestone bonuses at 3, 7, 14, and 30 days
- **Local Leaderboard** — Top 20 scores saved locally

### Power-ups
- **Shield** (gold) — Absorbs one wrong tap. Earned every 5 games.
- **Time Freeze** (blue) — Pauses the timer for 3 seconds. Earned on 5+ combo streaks.
- **Double Points** (green) — 2x score for 5 seconds. Earned every 500 XP.

### Tile Themes
6 unlockable color palettes that change the game tile appearance:
- Default, Neon, Pastel, Earth, Candy, Midnight
- Unlock at level milestones (Level 3, 5, 8, 12, 16, 20)

### Stats Dashboard
- Total games, play time, and accuracy trends
- Best scores by difficulty and game mode
- Records: best combo, perfect games, weekly stats
- Visual accuracy chart for the last 20 games

### Visual Effects
- Gradient tiles with glass-like highlights
- Particle bursts and tap ripples on correct taps
- Screen flash feedback (green/red)
- Ambient floating particles on all screens
- Animated hearts, combo fire streaks, and point popups
- Confetti rain on new best scores
- Power-up overlay effects (shield border, freeze tint, double glow)

### Sharing
- Emoji-formatted score cards for sharing results
- "Challenge Friend" button with competitive messaging

### iPad Support
All 6 primary screens are fully optimized for iPad (App Store Guideline 4.0 compliant):
- Content constrained to a 560pt max-width column, centered on wide viewports
- Dynamic tile sizing via `useWindowDimensions` — the 4×3 game grid always fits correctly
- `Dimensions` replaced with the `useWindowDimensions` hook throughout so layout recalculates on orientation change
- iPhone layout is pixel-identical to before — no visual regressions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54, React Native |
| Navigation | Expo Router (file-based, stack) |
| Animation | React Native Reanimated 4 |
| Persistence | AsyncStorage |
| Fonts | Outfit (Google Fonts) |
| Backend | Express + TypeScript |
| Haptics | expo-haptics |
| Gradients | expo-linear-gradient |

## Project Structure

```
app/
  _layout.tsx          Root layout with providers and font loading
  index.tsx            Home screen with mode/difficulty picker
  game.tsx             Main game screen (4x3 grid, rules, effects)
  results.tsx          Results with rank, XP, badges, sharing
  leaderboard.tsx      Top 20 local scores
  badges.tsx           12 achievement badges with progress
  stats.tsx            Personal stats dashboard
components/
  ParticleBurst.tsx    Particle explosion on correct taps
  ScreenFlash.tsx      Full-screen flash overlay
  Confetti.tsx         Confetti rain effect
  TapRipple.tsx        Expanding ring ripple
  AmbientParticles.tsx Floating background particles
  ErrorBoundary.tsx    Error boundary wrapper
constants/
  colors.ts            Theme colors and tile palettes
  game.ts              Game config, badges, XP, modes, power-ups
lib/
  storage.ts           AsyncStorage persistence layer
  sounds.ts            Web Audio sound effects
  analytics.ts         Privacy-friendly event tracking
  query-client.ts      React Query client
server/
  index.ts             Express API server
  templates/           Static landing page
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo Go app (iOS/Android) for mobile testing

### Install & Run

```bash
npm install
npm run expo:dev    # Start Expo dev server (port 8081)
npm run server:dev  # Start Express backend (port 5000)
```

Scan the QR code with Expo Go to test on your phone, or press `w` to open in a web browser.

## Game Controls

1. Select a **game mode** (Regular / Endless / Zen)
2. Choose a **difficulty** (Easy / Normal / Hard) for Regular mode
3. Read the rule at the top of the screen
4. Tap the matching tile in the 4x3 grid
5. Build combos for higher scores
6. Use power-ups strategically during gameplay

## Theme

Dark navy gaming aesthetic with vibrant accents:
- Background: `#0D0D24` → `#0A0A1A`
- Primary: `#00E5FF` (cyan)
- Secondary: `#FF2D6F` (pink)
- Accent: `#7B61FF` (purple)

## License

MIT
