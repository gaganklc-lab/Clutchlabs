const variant = process.env.APP_VARIANT ?? "clutchtap";

const IS_VELOCITY = variant === "velocity";
const IS_SURGE = variant === "surge";

const VARIANTS = {
  clutchtap: {
    name: "ClutchTap",
    slug: "clutchtap",
    scheme: "myapp",
    bundleIdentifier: "com.myapp",
    androidPackage: "com.myapp",
  },
  velocity: {
    name: "Velocity",
    slug: "velocity",
    scheme: "velocity",
    bundleIdentifier: "app.replit.velocity",
    androidPackage: "app.replit.velocity",
  },
  surge: {
    name: "Surge",
    slug: "surge",
    scheme: "surge",
    bundleIdentifier: "app.replit.surge",
    androidPackage: "app.replit.surge",
  },
};

const cfg = VARIANTS[variant] || VARIANTS.clutchtap;

// Each variant is a separate EAS project with its own project ID.
// When a variant has no ID yet, EAS will create one on first `eas build:configure`.
const EAS_PROJECT_IDS = {
  clutchtap: undefined,
  velocity: "43583fb0-be02-428a-a19e-85dca9e961c9",
  surge: "bdce0786-1e60-490f-939e-2e696c61b392",
};

module.exports = {
  expo: {
    name: cfg.name,
    slug: cfg.slug,
    version: "1.0.0",
    orientation: "portrait",
    icon: IS_VELOCITY
      ? "./assets/images/velocity-icon.png"
      : IS_SURGE
      ? "./assets/images/surge-icon.png"
      : "./assets/images/icon.png",
    scheme: cfg.scheme,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: IS_VELOCITY
        ? "./assets/images/velocity-splash-icon.png"
        : IS_SURGE
        ? "./assets/images/surge-icon.png"
        : "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A1A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: cfg.bundleIdentifier,
      infoPlist: IS_SURGE
        ? {
            NSUserTrackingUsageDescription:
              "This allows us to show you more relevant ads and support the free version of Surge.",
          }
        : undefined,
    },
    android: {
      package: cfg.androidPackage,
      adaptiveIcon: IS_VELOCITY
        ? {
            backgroundColor: "#0A0A1A",
            foregroundImage:
              "./assets/images/velocity-android-icon-foreground.png",
            backgroundImage:
              "./assets/images/velocity-android-icon-background.png",
            monochromeImage:
              "./assets/images/velocity-android-icon-monochrome.png",
          }
        : IS_SURGE
        ? {
            backgroundColor: "#0A0A1A",
            foregroundImage:
              "./assets/images/surge-android-icon-foreground.png",
            backgroundImage:
              "./assets/images/surge-android-icon-background.png",
            monochromeImage:
              "./assets/images/surge-android-icon-monochrome.png",
          }
        : {
            backgroundColor: "#E6F4FE",
            foregroundImage: "./assets/images/android-icon-foreground.png",
            backgroundImage: "./assets/images/android-icon-background.png",
            monochromeImage: "./assets/images/android-icon-monochrome.png",
          },
    },
    web: {
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      ["expo-router", { origin: "https://replit.com/" }],
      "expo-font",
      "expo-web-browser",
      ...(IS_SURGE
        ? [
            [
              "react-native-google-mobile-ads",
              {
                androidAppId:
                  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
                  "ca-app-pub-3940256099942544~3347511713",
                iosAppId:
                  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
                  "ca-app-pub-3940256099942544~1458002511",
                userTrackingUsageDescription:
                  "This allows us to show you more relevant ads and support the free version of Surge.",
              },
            ],
            [
              "expo-tracking-transparency",
              {
                userTrackingPermission:
                  "This allows us to show you more relevant ads and support the free version of Surge.",
              },
            ],
          ]
        : []),
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appVariant: variant,
      ...(EAS_PROJECT_IDS[variant]
        ? { eas: { projectId: EAS_PROJECT_IDS[variant] } }
        : {}),
    },
  },
};
