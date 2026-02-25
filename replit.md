# ClutchTap - Reflex Challenge Game

## Overview
A React Native (Expo) mobile game where players tap colored tiles following rotating rules under time pressure. Features multiple game modes, lives system, combo multiplier, local leaderboard, achievement badges, performance ranking, daily challenges, XP progression, tile themes, daily login rewards, power-ups, stats dashboard, and polished visual effects.

## Tech Stack
- **Frontend**: Expo SDK 54, Expo Router (stack navigation), React Native Reanimated 4
- **Backend**: Express + TypeScript on port 5000 (serves APIs + static landing page)
- **State**: AsyncStorage for persistence, React useState for local state
- **Fonts**: @expo-google-fonts/outfit (400/500/600/700/800 weights)
- **Packages**: expo-av, expo-sharing, expo-crypto, expo-haptics, expo-linear-gradient

## Project Structure
```
app/
  _layout.tsx          - Root layout with providers, font loading, Stack navigator
  index.tsx            - Home screen (title, mode/difficulty picker, daily challenge, XP level, login streak, power-up preview, theme picker in settings)
  game.tsx             - Game screen (4x3 grid, rules, timer, effects, daily/endless/zen modes, power-ups bar)
  results.tsx          - Results screen (rank display, animated score, XP gain, stats, badges, challenge friend, enhanced sharing)
  leaderboard.tsx      - Top 20 local scores
  badges.tsx           - 12 achievement badges with progress
  stats.tsx            - Personal stats dashboard (games, play time, accuracy chart, best scores by difficulty/mode)
  +not-found.tsx       - 404 screen
components/
  ParticleBurst.tsx    - Particle explosion effect on correct taps
  ScreenFlash.tsx      - Full-screen green/red flash overlay
  Confetti.tsx         - Confetti rain effect for new best scores
  TapRipple.tsx        - Expanding ring ripple effect on tap
  AmbientParticles.tsx - Slow floating dots/sparkles in background
  ErrorBoundary.tsx    - Error boundary wrapper
constants/
  colors.ts            - Theme colors (dark navy gaming aesthetic + rank colors + 5 tile theme palettes)
  game.ts              - Game constants, difficulty configs, badge definitions, ranking, XP, daily challenge, game modes, tile themes, power-ups, daily rewards
lib/
  storage.ts           - AsyncStorage CRUD for scores, settings, badges, difficulty, XP, daily best, game mode, tile theme, login streak, power-ups, game stats, endless best
  sounds.ts            - Web Audio sound manager (tap, wrong, combo, countdown, game over, new best)
  analytics.ts         - Privacy-friendly event tracking (console only)
  query-client.ts      - React Query client
server/
  index.ts             - Express server
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
