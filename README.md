# Clutch Labs — Mobile Arcade Suite

A premium mobile arcade suite built with React Native (Expo), featuring two distinct games with shared progression, XP, leaderboards, and visual systems.

---

## Games

### ClutchTap — Reflex Challenge
A fast-paced tap game. Follow rotating rules under time pressure — tap the right tile before the rule changes. Features rotating color/flash rules, a 4×3 tile grid, combo multiplier, and frenzy mode in the last 10 seconds.

### Velocity — Swipe to Dodge
A survival swipe game. Obstacles approach from four directions; swipe the opposite way to dodge. Survive as long as possible while the spawn rate ramps up. Features a glowing player orb, directional obstacle walls, and combo-based scoring.

---

## Shared Systems (reused across both games)

| System | Details |
|---|---|
| XP & Leveling | Earn XP each game. Level up from Beginner to Godlike. |
| Local Leaderboard | Top 20 scores per game, saved via AsyncStorage. |
| Stats Dashboard | Games played, accuracy history, best scores, streaks. |
| 12 Achievement Badges | Unlock milestones across all gameplay. |
| Daily Login Rewards | 7-day XP cycle (25–300 XP), streak bonuses at 3/7/14/30 days. |
| Power-ups (ClutchTap) | Shield, Time Freeze, 2x Points — earned and used in-game. |
| Visual Effects | ParticleBurst, ScreenFlash, TapRipple, AmbientParticles, Confetti. |
| Sound System | Web Audio API tones for tap/wrong/combo/countdown/game-over. |
| Analytics | Privacy-friendly event tracking. |
| Haptics | expo-haptics for Light/Medium/Heavy impact and notification types. |

---

## ClutchTap Features

### Game Modes
- **Regular** — Timed (30s) with Easy, Normal, Hard difficulty.
- **Endless** — No timer. Tile/rule speed ramps every 30 seconds.
- **Zen** — No timer, no lives. Practice rules at your own pace.

### Core Mechanics
- **Rotating Rules** — Rules change every few seconds: "Tap BLUE", "Tap NOT RED", "Tap the FLASHING tile"
- **Combo System** — Consecutive correct taps build a multiplier up to 5x
- **Frenzy Mode** — Visual intensity ramps in the last 10 seconds of Regular mode
- **Daily Challenge** — Fixed daily rule seed for competitive play
- **Performance Ranking** — S/A/B/C/D rank based on score, accuracy, combo, and difficulty

### Tile Themes
6 unlockable color palettes (Default, Neon, Pastel, Earth, Candy, Midnight). Unlock at levels 3, 5, 8, 12, 16, 20.

---

## Velocity Features

### Game Modes
- **Regular** — 30-second survival. Race to dodge as many obstacles as possible.
- **Endless** — Spawn rate ramps every 20 seconds (floor: 600ms). Survive as long as possible.
- **Zen** — No lives depleted. Practice reading directions without pressure.

### Core Mechanics
- **Directional Obstacles** — Walls spawn from top, bottom, left, or right and animate toward the center.
- **Swipe to Dodge** — Swipe the opposite direction: top → swipe down, left → swipe right, etc.
- **Combo Multiplier** — Consecutive successful dodges build a multiplier up to 5x.
- **Shake & Flash** — Missed obstacles shake the orb and flash the screen red.

### Scoring
- Successful dodge = 10 × combo multiplier
- Miss = combo resets, life lost (non-Zen)

---

## Screens & Routes

| Route | Screen |
|---|---|
| `/` | Home — game picker (ClutchTap / Velocity), mode/difficulty, daily challenge |
| `/game` | ClutchTap game |
| `/results` | ClutchTap results |
| `/velocity` | Velocity game |
| `/velocity-results` | Velocity results |
| `/leaderboard` | Top 20 leaderboard |
| `/badges` | 12 achievement badges |
| `/stats` | Personal stats dashboard |

---

## iPad Support
All screens use `useWindowDimensions` with a 560pt max-width centering wrapper. Content is centered on wide viewports; iPhone layout is pixel-identical. Compliant with App Store Guideline 4.0 (Design).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React Native |
| Navigation | Expo Router (file-based, stack) |
| Animation | React Native Reanimated 4 |
| Persistence | AsyncStorage |
| Fonts | Outfit (Google Fonts via @expo-google-fonts) |
| Backend | Express + TypeScript (port 5000) |
| Haptics | expo-haptics |
| Gradients | expo-linear-gradient |
| Gestures | PanResponder (React Native built-in) |

---

## Project Structure

```
app/
  _layout.tsx          Root layout — Stack navigator, font loading, providers
  index.tsx            Home screen — game picker, ClutchTap + Velocity controls
  game.tsx             ClutchTap game screen
  results.tsx          ClutchTap results
  velocity.tsx         Velocity game screen
  velocity-results.tsx Velocity results
  leaderboard.tsx      Top 20 leaderboard
  badges.tsx           12 achievement badges
  stats.tsx            Personal stats dashboard
components/
  ParticleBurst.tsx    Particle explosion on correct actions
  ScreenFlash.tsx      Full-screen flash overlay
  Confetti.tsx         Confetti rain on new best scores
  TapRipple.tsx        Ripple on taps
  AmbientParticles.tsx Floating background particles
  ErrorBoundary.tsx    Error boundary wrapper
constants/
  colors.ts            Theme colors, tile palettes, rank colors
  game.ts              Game config, badges, XP tables, modes, power-ups
lib/
  storage.ts           AsyncStorage persistence (leaderboard, XP, stats, settings)
  sounds.ts            Web Audio sound effects
  analytics.ts         Privacy-friendly event tracking
  query-client.ts      React Query client
server/
  index.ts             Express server (port 5000)
  templates/           Static landing page
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo Go app (iOS/Android) for mobile testing

### Install & Run

```bash
npm install
npm run expo:dev    # Expo dev server — port 8081
npm run server:dev  # Express backend — port 5000
```

Scan the QR code with Expo Go to test on your phone, or press `w` for the web browser preview.

---

## Theme

Dark navy gaming aesthetic with vibrant accents:
- Background: `#0D0D24` → `#0A0A1A`
- Primary (cyan): `#00E5FF`
- Secondary (pink): `#FF2D6F`
- Accent (purple): `#7B61FF`
- Warning (gold): `#FFD700`
- Success (green): `#00E676`

---

## Adding a Third Game (Future)

The architecture is designed for extensibility:
1. Create `app/<game-name>.tsx` and `app/<game-name>-results.tsx`
2. Register routes in `app/_layout.tsx`
3. Add a game card to the picker in `app/index.tsx`
4. Reuse: `Colors`, `storage.ts` (addXP, addLeaderboardEntry, updateGameStats), `soundManager`, particle components, haptics, fonts

---

## License

MIT
