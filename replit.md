# Clutch Labs — Multi-Variant Arcade Suite

## Overview
This project is a React Native (Expo) mobile arcade suite featuring three distinct games: ClutchTap, Velocity, and Surge. Each game is designed to be independently publishable on app stores with its own branding and launch flow, all built from a single, shared codebase. The overarching vision is to create a robust and expandable platform for mobile arcade games.

- **ClutchTap**: A reflex-based game where players tap colored tiles according to rotating rules under time pressure. It includes multiple game modes, a combo system, daily challenges, XP progression, tile themes, power-ups, badges, and a stats dashboard.
- **Velocity**: A survival game where players swipe to dodge incoming obstacle walls. It offers various modes (Regular, Endless, Zen), a combo scoring system, near-miss detection, and a cosmetic system for orb and trail styles. It also features a title progression system, leaderboards, and viral challenge sharing.
- **Surge**: A precision timing game where players tap when an expanding ring reaches a target zone. It includes Classic, Endless, Rush, and Daily modes, an XP progression system, streak tracking, ring cosmetic themes, power-ups, and an optional "Remove Ads" purchase. Surge also incorporates rewarded ads for in-game revives.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes.

## System Architecture
The project leverages Expo SDK 54 and Expo Router for navigation, with React Native Reanimated 4 for animations. A multi-variant architecture allows building independent applications from a single codebase using environment variables (`APP_VARIANT`) to dynamically configure app name, bundle ID, and icons via `app.config.js`. Each game variant has its own isolated AsyncStorage for persistence, ensuring data separation for scores, XP, and settings.

- **UI/UX**: The design adopts a dark navy gaming aesthetic with a color palette featuring cyan, pink, and purple accents. Game elements like tiles, ranks, and backgrounds utilize gradients and dynamic color shifts to enhance visual feedback and immersion. Visual effects include particle bursts, tap ripples, screen flashes, animated score counters, and confetti for achievements.
- **Technical Implementations**:
    - **Game Mechanics**: Implementations include rotating rules, dynamic difficulty scaling, combo systems, frenzy modes, daily seeded challenges, and a performance ranking system (S/A/B/C/D).
    - **XP and Progression**: Each game features its own XP system with level-up titles and unlockable content (e.g., tile themes, orb styles).
    - **Power-ups**: Various power-ups (Shield, Time Freeze, Double Points) are integrated with visual overlays to indicate activation.
    - **Sound**: Web Audio is used for game sound effects, providing distinct auditory feedback for actions, combos, game states, and achievements.
    - **Navigation**: Utilizes a stack-only navigation approach with `router.replace` to manage game flow and prevent unintended back navigation. Route parameters are used to pass game configurations.
- **Feature Specifications**:
    - **Daily Login Rewards**: Tracks consecutive login days and provides XP rewards, with animated popups and streak milestone bonuses.
    - **Stats Dashboard**: Provides a comprehensive overview of player performance, including total games, play time, best scores, accuracy trends, and achievement progress.
    - **Enhanced Sharing**: Features emoji-formatted score cards and "Challenge Friend" functionality for competitive sharing.

## External Dependencies
- **State Management & Persistence**: AsyncStorage (`lib/storage.ts`, `lib/velocity-storage.ts`, `lib/surge-storage.ts`)
- **Fonts**: `@expo-google-fonts/outfit`
- **In-App Purchases (IAP)**: RevenueCat (`react-native-purchases`) for Surge's "Remove Ads" one-time purchase.
- **Advertising**: Google AdMob (`react-native-google-mobile-ads`) for rewarded ads in Surge.
    - Requires `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID` secrets for production.
- **Utilities**: `expo-av`, `expo-sharing`, `expo-crypto`, `expo-haptics`, `expo-linear-gradient`, `expo-tracking-transparency`.
- **Backend**: Express + TypeScript server (on port 5000) for APIs and serving a static landing page.