# Clutch Labs — Mobile Arcade Suite

A premium mobile arcade suite built with React Native (Expo), featuring three distinct games with independent progression, XP, leaderboards, cosmetics, and visual systems.

---

## Games

### ClutchTap — Reflex Challenge
A fast-paced tap game. Follow rotating rules under time pressure — tap the right tile before the rule changes. Features rotating color/flash rules, a 4×3 tile grid, combo multiplier, and frenzy mode in the last 10 seconds.

### Velocity — Swipe to Dodge
A survival swipe game. Obstacles approach from four directions; swipe the opposite way to dodge. Survive as long as possible while the spawn rate ramps up. Features a glowing player orb, directional obstacle walls, combo-based scoring, and an unlockable cosmetics system (orb styles + trail effects).

### Surge — Precision Ring Tap
A timing-skill arcade game. An expanding ring grows outward from a central orb — tap when it reaches the target zone for a Perfect or Good hit, miss and lose a life. The ring accelerates as you build combo, demanding sharper precision each cycle. Features four game modes, a 9-tier XP progression system, a daily challenge, power-ups, ring cosmetics, and a Pro subscription.

---

## Shared Systems

| System | Games |
|---|---|
| XP & Leveling | All three — independent XP pools and title progressions per game |
| Local Leaderboard | Top 20 scores per game and mode, saved via AsyncStorage |
| Daily Challenge | ClutchTap (rule-seeded), Surge (param-seeded, 3 attempts/day, 1.5× XP) |
| Power-ups | ClutchTap (Shield, Time Freeze, 2× Points), Surge (Slow Ring, Extra Life, Double Score) |
| Cosmetics | Velocity (orb styles + trail effects), Surge (7 ring themes with unlock conditions) |
| Streak Tracking | Surge — daily play streak with Pro grace day |
| In-App Subscription | Surge Pro via RevenueCat — Pro ring themes, weekly power-up bonus, ad-free, streak grace |
| Rewarded Ads | Surge — watch ad to revive after game over |
| Visual Effects | ParticleBurst, ScreenFlash, ScorePopup, AmbientParticles, Confetti |
| Sound System | Web Audio API tones for hits, misses, combos, countdowns, game over |
| Analytics | Privacy-friendly event tracking (console only) |
| Haptics | expo-haptics — Light/Medium/Heavy impact and notification types |

---

## ClutchTap Features

### Game Modes
- **Regular** — Timed (30s) with Easy, Normal, Hard difficulty.
- **Endless** — No timer. Tile/rule speed ramps every 30 seconds.
- **Zen** — No timer, no lives. Practice rules at your own pace.

### Core Mechanics
- **Rotating Rules** — Rules change every few seconds: "Tap BLUE", "Tap NOT RED", "Tap the FLASHING tile"
- **Combo System** — Consecutive correct taps build a multiplier up to 5×
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
- **Combo Multiplier** — Consecutive successful dodges build a multiplier up to 5×.
- **Shake & Flash** — Missed obstacles shake the orb and flash the screen red.

### Cosmetics
3 orb styles (CoreBlue, NeonPulse, OverdriveGold) and 3 trail effects (CyanTrail, VioletTrail, GoldSpark), each with unlock conditions based on score, combo, or time survived.

### Scoring
- Successful dodge = 10 × combo multiplier
- Miss = combo resets, life lost (non-Zen)

---

## Surge Features

### Core Mechanic
An expanding ring animates outward from a central orb. The target zone is the midpoint of the ring's travel. Tap the orb at the right moment:
- **Perfect** (±80ms) — 15 pts × combo multiplier, gold flash
- **Good** (±160ms) — 8 pts × combo multiplier, green flash
- **Miss / Early / Late** — lose a life, combo resets

Every 3 successful hits (2 in Rush), the ring cycle accelerates. The game ends when all lives are lost.

### Game Modes
- **Classic** — 30-second timed run. Score as high as possible before time runs out.
- **Endless** — No timer, 3 lives. Survive as long as possible as the ring keeps accelerating.
- **Rush** — Fast-ramp variant. Ring starts at 700ms (vs 1300ms) and ramps every 2 hits instead of 3. Orange accent.
- **Daily Challenge** — Seeded daily run with unique name, cycle speed, and ring style. 3 attempts per day, best score tracked, 1.5× XP multiplier. Resets each day.

### Power-ups
| Power-up | Effect | Duration |
|---|---|---|
| Slow Ring | Raises the speed floor, preventing further acceleration | 15 seconds |
| Extra Life | Adds +1 life (max 4) | Instant |
| Double Score | All hit points are doubled | 20 seconds |

Power-ups are earned via gameplay milestones and the Pro weekly bonus. One power-up can be selected before each run.

### XP Progression — 9 Tiers

| Tier | Title | XP Required |
|---|---|---|
| 1 | Novice | 0 |
| 2 | Pulse | 150 |
| 3 | Rhythm | 350 |
| 4 | Beat | 650 |
| 5 | Flow | 1,100 |
| 6 | Resonance | 1,800 |
| 7 | Surge | 2,800 |
| 8 | Elite | 4,200 |
| 9 | Surge Master | 6,000 |

XP is earned each run based on score, combos, and perfect hits. Daily challenge runs earn 1.5× XP. Tier advancement triggers an animated banner with haptic feedback on the results screen.

### Streak System
- Play daily to build a streak. Displayed on the home screen and results screen.
- Pro users get a 1-day grace period — missing a single day does not reset the streak.

### Leaderboard
Classic and Endless modes each maintain a local top-20 leaderboard (score, max combo, perfect hits, date). Rush mode scores are tracked as personal best but not ranked on the leaderboard. Daily challenge scores are tracked separately in daily state and do not enter the leaderboard.

### Ring Cosmetics — 7 Themes

| Theme | Unlock Condition |
|---|---|
| Neon Cyan | Default — always unlocked |
| Gold Surge | Score 150+ in a Classic run |
| Void | Accumulate 500 XP total |
| Ember | Hit a 20× combo in one run |
| Ice Crystal | Survive 60 seconds in Endless mode |
| Obsidian Pro ⚡ | Surge Pro only |
| Aurora Pro ⚡ | Surge Pro only |

Ring themes affect the orb color, ring color, glow color, and shockwave. Daily challenges use a seeded theme that overrides the equipped theme for that run.

### Surge Pro Subscription (RevenueCat)
- Unlocks Obsidian Pro and Aurora Pro ring themes
- Weekly random power-up bonus (one per week, chosen at random)
- 1-day streak grace period
- Ad-free gameplay (no revive ad prompt)

---

## Screens & Routes

| Route | Screen |
|---|---|
| `/` | Home — game picker (ClutchTap / Velocity / Surge) |
| `/game` | ClutchTap game |
| `/results` | ClutchTap results |
| `/velocity` | Velocity game |
| `/velocity-results` | Velocity results |
| `/velocity-leaderboard` | Velocity top scores |
| `/surge` | Surge game |
| `/surge-results` | Surge results |
| `/surge-leaderboard` | Surge leaderboard (Classic + Endless) |
| `/leaderboard` | ClutchTap top scores |
| `/badges` | 12 achievement badges |
| `/stats` | ClutchTap personal stats dashboard |

---

## iPad / Tablet / Web Support
All screens use `useWindowDimensions` with a 560pt max-width centering wrapper. Content is centered on wide viewports; phone layout is pixel-identical at 375pt. Web platform insets (top: 67px, bottom: 34px) are applied via `Platform.OS` checks where native safe area is unavailable.

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
| Subscriptions | RevenueCat (`react-native-purchases`) — Surge Pro |
| Haptics | expo-haptics |
| Gradients | expo-linear-gradient |
| Gestures | PanResponder (React Native built-in) |

---

## Project Structure

```
app/
  _layout.tsx              Root layout — Stack navigator, font loading, providers
  index.tsx                Home screen — game picker (ClutchTap / Velocity / Surge)
  game.tsx                 ClutchTap game screen
  results.tsx              ClutchTap results
  leaderboard.tsx          ClutchTap top scores
  badges.tsx               12 achievement badges
  stats.tsx                ClutchTap stats dashboard
  velocity.tsx             Velocity game screen
  velocity-results.tsx     Velocity results
  velocity-leaderboard.tsx Velocity top scores
  surge.tsx                Surge game screen
  surge-results.tsx        Surge results (XP, rank, daily state, level-up banner)
  surge-leaderboard.tsx    Surge leaderboard (Classic + Endless)
components/
  SurgeHome.tsx            Surge home — mode picker, XP bar, streak, daily card, ring themes
  SurgePaywallSheet.tsx    Surge Pro subscription paywall sheet
  SurgePowerUpSelect.tsx   Pre-game power-up selection UI
  VelocityHome.tsx         Velocity home screen
  VelocityBackgroundFX.tsx Velocity animated arena background
  VelocityCustomizeModal.tsx  Velocity orb/trail cosmetics modal
  OrbTrail.tsx             Velocity orb trail effect
  ParticleBurst.tsx        Particle explosion on hits
  ScreenFlash.tsx          Full-screen flash overlay
  ScorePopup.tsx           Floating score/label popups
  Confetti.tsx             Confetti rain on new best scores
  TapRipple.tsx            Ripple on taps
  AmbientParticles.tsx     Floating background particles
  ErrorBoundary.tsx        Error boundary wrapper
constants/
  colors.ts                Theme colors, tile palettes, rank colors
  game.ts                  ClutchTap config, badges, XP tables, modes, power-ups
lib/
  storage.ts               ClutchTap AsyncStorage persistence
  velocity-storage.ts      Velocity AsyncStorage persistence
  velocity-progression.ts  Velocity title progression system
  velocity-cosmetics.ts    Velocity orb/trail unlock and equip
  surge-storage.ts         Surge persistence — XP, leaderboard, power-ups, streak, settings
  surge-daily.ts           Daily challenge seeding, state tracking, attempt recording
  surge-progression.ts     9-tier Surge XP title system (Novice → Surge Master)
  surge-cosmetics.ts       Ring theme definitions, unlock conditions, equip persistence
  surge-subscription.tsx   RevenueCat integration — Surge Pro entitlement, purchase, restore
  surge-ads.ts             Rewarded ad integration (revive after game over)
  sounds.ts                Web Audio sound manager
  analytics.ts             Privacy-friendly event tracking
  query-client.ts          React Query client + API helpers
server/
  index.ts                 Express server (port 5000)
  templates/               Static landing page
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

## Multi-Variant Architecture

The project uses an environment-variable-driven variant system to build independent apps from one codebase.

### App Variant Config
- `app.config.js` — reads `APP_VARIANT` at build time; sets app name, slug, bundle ID, scheme
- `constants/appVariant.ts` — runtime variant detection via `expo-constants`; exports `APP_VARIANT`, `IS_CLUTCHTAP`, `IS_VELOCITY`
- `app/index.tsx` — routes to the correct home screen based on variant; production builds show only the target game

### Storage Namespacing
- ClutchTap: keys prefixed `clutchtap_` — `lib/storage.ts`
- Velocity: keys prefixed `velocity_` — `lib/velocity-storage.ts`
- Surge: keys prefixed `surge_` — `lib/surge-storage.ts`, `lib/surge-daily.ts`, `lib/surge-cosmetics.ts`

### Build Commands

```bash
# Development (ClutchTap — default)
APP_VARIANT=clutchtap npx expo start

# Development (Velocity)
APP_VARIANT=velocity npx expo start

# EAS Build — ClutchTap (iOS)
eas build --platform ios --profile production-clutchtap

# EAS Build — Velocity (iOS)
eas build --platform ios --profile production-velocity

# EAS Build — ClutchTap (Android)
eas build --platform android --profile production-clutchtap

# EAS Build — Velocity (Android)
eas build --platform android --profile production-velocity
```

---

## License

MIT
