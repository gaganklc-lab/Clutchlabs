# Clutch Labs — Multi-Variant Arcade Suite

## Overview
A React Native (Expo) mobile arcade suite with three independently publishable games built from a shared codebase. Each game ships as its own App Store app with its own name, bundle identifier, and direct launch flow.

- **ClutchTap** (`APP_VARIANT=clutchtap`): Rotating-rule reflex tap game. Tap colored tiles following rotating rules under time pressure. Features game modes, lives, combo multiplier, daily challenges, XP, tile themes, power-ups, badges, stats dashboard.
- **Velocity** (`APP_VARIANT=velocity`): Swipe-to-dodge survival game. Dodge incoming obstacle walls by swiping in the correct direction. Features Regular/Endless/Zen modes, lives (pip bar), combo scoring, edge warnings, 3-layer orb (aura+mid+core) with squash/stretch, orb dash+trail, near-miss detection, keyboard controls (web), combo glow escalation, frenzy mode polish, enhanced animated grid background with arena rings + diagonal lane lines + mode-based color shifts, shockwave ring effect, S/A/B/C/D rank, personal best detection, viral challenge sharing, leaderboard. Production features: score popups (+10/+15/NEAR MISS/CLUTCH!/FRENZY), phase-up overlay (endless), obstacle layered neon beams, arena glow border, title progression system (Runner→Phantom→Surge→Overdrive→Legend), results XP progress bar. Cosmetics system: 3 unlockable orb styles (CoreBlue/NeonPulse/OverdriveGold) + 3 trail styles (CyanTrail/VioletTrail/GoldSpark) with unlock conditions, equip UI (Customize button on home), applied to gameplay visuals. Unlock reward card shown on results screen when new items are earned.
- **Surge** (embedded in arcade suite): Precision timing game. An expanding ring grows from a central orb — tap when it reaches the target zone. Features Classic/Endless/Rush/Daily modes, 9-tier XP progression (Novice→Surge Master), daily challenge with 1.5× XP and seeded ring style, streak tracking with Pro grace day, 7 ring cosmetic themes with unlock conditions, power-ups (Slow Ring/Extra Life/Double Score), revive via rewarded ad, Surge Pro subscription via RevenueCat (Pro ring themes, weekly power-up bonus, ad-free, streak grace). LevelUpBanner on results with haptic pulse on tier change.

## Build & Publishing
- **Config**: `app.config.js` (dynamic Expo config, replaces `app.json`). Reads `APP_VARIANT` env var to switch between ClutchTap and Velocity configs (name, slug, bundle ID, icons).
- **EAS**: `eas.json` defines build profiles: `production-clutchtap` (APP_VARIANT=clutchtap) and `production-velocity` (APP_VARIANT=velocity).
- **Bundle IDs**: ClutchTap = `com.myapp`, Velocity = `app.replit.velocity`
- **Icons**: ClutchTap uses `assets/images/icon.png`, Velocity uses `assets/images/velocity-icon.png`. Each has its own Android adaptive icon set.
- **To build**: `eas build --profile production-velocity --platform ios` (requires EAS CLI + Apple Developer account)

## Tech Stack
- **Frontend**: Expo SDK 54, Expo Router (stack navigation), React Native Reanimated 4
- **Backend**: Express + TypeScript on port 5000 (serves APIs + static landing page)
- **State**: AsyncStorage for persistence, React useState for local state
- **Fonts**: @expo-google-fonts/outfit (400/500/600/700/800 weights)
- **Subscriptions**: RevenueCat (`react-native-purchases`) — Surge Pro entitlement, purchase, restore
- **Ads**: Google AdMob (`react-native-google-mobile-ads`) — Surge rewarded ad (revive after game over); `expo-tracking-transparency` for iOS ATT permission
- **Packages**: expo-av, expo-sharing, expo-crypto, expo-haptics, expo-linear-gradient

## AdMob Configuration (Surge)

`react-native-google-mobile-ads` is registered as an Expo plugin in `app.config.js` **only for the Surge variant** (`APP_VARIANT=surge`). It requires a native build (EAS) — it degrades gracefully to a stub in Expo Go so development is unaffected.

### Required Replit Secrets (add before production EAS build)

| Secret name | What it is |
|---|---|
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | AdMob iOS App ID for Surge (`ca-app-pub-XXXXXX~YYYYYYY`) |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | AdMob Android App ID for Surge (`ca-app-pub-XXXXXX~YYYYYYY`) |
| `EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID` | iOS rewarded ad unit ID for the revive placement |

If these secrets are absent the config falls back to **Google's official test App IDs / test ad unit IDs**, so development and CI builds still work correctly — only production ad delivery requires the real values.

### Ad unit used
- Placement: revive after game over (one per session, skipped for Pro subscribers)
- Format: rewarded (user watches to completion to earn 1 extra life)
- Development test ID: `ca-app-pub-3940256099942544/1712485313` (iOS rewarded)

## Project Structure
```
app/
  _layout.tsx              - Root layout with providers, font loading, Stack navigator
  index.tsx                - Home screen — game picker (ClutchTap / Velocity / Surge)
  game.tsx                 - ClutchTap game screen (4x3 grid, rules, timer, effects, daily/endless/zen modes, power-ups bar)
  results.tsx              - ClutchTap results (rank display, animated score, XP gain, stats, badges, challenge friend)
  leaderboard.tsx          - ClutchTap top 20 local scores
  badges.tsx               - 12 achievement badges with progress
  stats.tsx                - ClutchTap stats dashboard (games, play time, accuracy chart, best scores)
  velocity.tsx             - Velocity game screen
  velocity-results.tsx     - Velocity results
  velocity-leaderboard.tsx - Velocity top scores
  surge.tsx                - Surge game screen (ring tap, power-ups, revive, all modes)
  surge-results.tsx        - Surge results (XP, rank, daily state, level-up banner)
  surge-leaderboard.tsx    - Surge leaderboard (Classic + Endless)
  +not-found.tsx           - 404 screen
components/
  SurgeHome.tsx            - Surge home — mode picker, XP bar, streak, daily card, ring themes
  SurgePaywallSheet.tsx    - Surge Pro subscription paywall sheet
  SurgePowerUpSelect.tsx   - Pre-game power-up selection UI
  VelocityHome.tsx         - Velocity home screen
  VelocityBackgroundFX.tsx - Velocity animated arena background
  VelocityCustomizeModal.tsx  - Velocity orb/trail cosmetics modal
  OrbTrail.tsx             - Velocity orb trail effect
  ParticleBurst.tsx        - Particle explosion effect on correct hits
  ScreenFlash.tsx          - Full-screen green/red flash overlay
  ScorePopup.tsx           - Floating score/label popups
  Confetti.tsx             - Confetti rain effect for new best scores
  TapRipple.tsx            - Expanding ring ripple effect on tap
  AmbientParticles.tsx     - Slow floating dots/sparkles in background
  ErrorBoundary.tsx        - Error boundary wrapper
constants/
  colors.ts                - Theme colors (dark navy gaming aesthetic + rank colors + tile palettes)
  game.ts                  - ClutchTap config, badges, XP tables, modes, tile themes, power-ups
lib/
  storage.ts               - ClutchTap AsyncStorage persistence (scores, XP, settings, streaks)
  velocity-storage.ts      - Velocity AsyncStorage persistence
  velocity-progression.ts  - Velocity title progression system
  velocity-cosmetics.ts    - Velocity orb/trail unlock and equip
  surge-storage.ts         - Surge persistence — XP, leaderboard, power-ups, streak, settings
  surge-daily.ts           - Daily challenge seeding, state tracking, attempt recording
  surge-progression.ts     - 9-tier Surge XP title system (Novice → Surge Master)
  surge-cosmetics.ts       - Ring theme definitions, unlock conditions, equip persistence
  surge-subscription.tsx   - RevenueCat integration — Surge Pro entitlement, purchase, restore
  surge-ads.ts             - Rewarded ad integration (revive after game over)
  sounds.ts                - Web Audio sound manager (tap, wrong, combo, countdown, game over, new best)
  analytics.ts             - Privacy-friendly event tracking (console only)
  query-client.ts          - React Query client + API helpers
server/
  index.ts                 - Express server
  templates/landing-page.html - Static landing page
```

## Theme
- Background: Gradient from #0D0D24 to #0A0A1A (dark navy)
- Primary: #00E5FF (cyan)
- Secondary: #FF2D6F (pink)
- Accent: #7B61FF (purple)
- 6 tile colors: Blue, Red, Green, Yellow, Orange, Purple
- Rank colors: S=#FFD700, A=#00E5FF, B=#00E676, C=#FF9100, D=#FF3D3D
- 6 Tile Themes: Default, Neon, Pastel, Earth, Candy, Midnight (unlock by level)

## Game Modes
- **Regular**: Timed gameplay with difficulty selection (Easy/Normal/Hard), standard rules
- **Endless**: No timer, difficulty ramps every 30s (speed multiplier increases), only lives end the game
- **Zen**: No timer, no lives, no score — practice mode for learning rules, shows streak counter

## Game Mechanics
- **Rules**: Rotate every few seconds - "Tap COLOR", "Tap NOT COLOR", "Tap FLASHING tile"
- **Difficulty**: Easy (45s/4 lives), Normal (30s/3 lives), Hard (20s/2 lives)
- **Combo**: Consecutive correct taps multiply score up to 5x, with progress bar
- **Frenzy Mode**: Last 10 seconds - visual intensity ramps up (regular mode only)
- **Speed**: Tile changes accelerate as time runs out (regular) or as speed level increases (endless)
- **Daily Challenge**: Fixed daily seed generates unique rule sequence; separate daily best tracking
- **Performance Rank**: S/A/B/C/D based on score, accuracy, combo, difficulty multiplier
- **XP System**: Earn XP per game (score-based + bonuses), level up with titles (Beginner → Godlike)

## Power-ups
- **Shield** (gold): Absorbs one wrong tap, earned every 5 games
- **Time Freeze** (blue): Pauses timer for 3 seconds, earned on 5+ combo
- **Double Points** (green): 2x score for 5 seconds, earned every 500 XP
- One use per type per game, visual overlay effects when active

## Daily Login Rewards
- Track consecutive login days, reward XP each day (25, 50, 75, 100, 150, 200, 300 cycle)
- Animated reward claim popup on home screen
- Streak milestones: 3-day (+50 XP), 7-day (+150 XP), 14-day (+300 XP), 30-day (+500 XP)
- Streak counter badge displayed on home screen

## Tile Themes
- 6 themes with different color palettes, unlock at level milestones
- Theme picker in Settings modal with lock/unlock display
- Applied to game tiles via generateTileColors(themeId)

## Stats Dashboard (app/stats.tsx)
- Level display with XP progress bar
- Overview: total games, play time, best score, avg accuracy
- Best scores by difficulty (easy/normal/hard) and endless mode
- Records: best combo, perfect games, games today, games this week
- Accuracy trend chart (last 20 games, color-coded bars)
- Total XP display

## Enhanced Sharing
- Emoji-formatted share message with score card layout
- "Challenge Friend" button with competitive challenge text
- Mode/difficulty badges shown on results screen

## Visual Effects
- Gradient tiles with glass-like highlight (LinearGradient + white highlight overlay)
- Particle burst on correct taps
- Tap ripple ring expansion from tap point
- Screen flash (green/red) for feedback
- Ambient floating particles on all screens
- Gradient backgrounds (LinearGradient instead of flat color)
- Animated hearts that shake/bounce on life loss
- Combo fire streak with growing flames + progress bar
- Point popup animations (+points float up)
- Frenzy mode pulsing red border
- Confetti on new best score
- Animated score counter on results
- Performance rank display with glow animation
- XP gain indicator
- Enhanced countdown with ring + "GO!" animation
- Floating tiles on home screen
- Shimmer animation on "NEW BEST" banner
- Tile entrance animation (spring scale on grid refresh)
- Power-up overlays (shield border, freeze tint, double glow)

## Sound Effects (Web Audio)
- Correct tap: bright double pop tone
- Wrong tap: low buzz
- Combo milestone (every 5): ascending ding
- Countdown beep: tick sound
- Game over: descending sad tones
- New best: ascending fanfare
- Level up: victory ascending

## Navigation
- Stack-only (no tabs), all headerShown: false
- Game uses router.replace to prevent back gesture mid-game
- Difficulty + mode + daily flag + theme passed as route params from home → game → results
- Stats screen accessible from home top bar

## Multi-Variant Architecture

The project uses an environment-variable-driven variant system to build two independent apps from one codebase.

### App Variant Config
- `app.config.js` — reads `APP_VARIANT` at build time; sets app name, slug, bundle ID, scheme
- `constants/appVariant.ts` — runtime variant detection via `expo-constants`; exports `APP_VARIANT`, `IS_CLUTCHTAP`, `IS_VELOCITY`
- `app/index.tsx` — exports `IS_VELOCITY ? VelocityHome : ClutchTapHomeScreen`; production builds show only the correct game

### Storage Namespacing
- ClutchTap: all keys prefixed `clutchtap_` — `lib/storage.ts`
- Velocity: all keys prefixed `velocity_` — `lib/velocity-storage.ts`
- Scores, leaderboards, XP, and streaks are fully isolated between games

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

### Adding Future Games
1. Add a new entry to `VARIANTS` in `app.config.js`
2. Add `IS_NEWGAME` to `constants/appVariant.ts`
3. Create `lib/newgame-storage.ts` with namespaced keys
4. Create a home screen component and game screen
5. Update `app/index.tsx` default export with the new variant
