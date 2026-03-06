const variant = process.env.APP_VARIANT ?? "clutchtap";

const VARIANTS = {
  clutchtap: {
    name: "ClutchTap",
    slug: "clutchtap",
    scheme: "clutchtap",
    bundleIdentifier: "com.clutchlabs.clutchtap",
    androidPackage: "com.clutchlabs.clutchtap",
  },
  velocity: {
    name: "Velocity",
    slug: "velocity",
    scheme: "velocity",
    bundleIdentifier: "com.clutchlabs.velocity",
    androidPackage: "com.clutchlabs.velocity",
  },
};

const cfg = VARIANTS[variant] || VARIANTS.clutchtap;

module.exports = {
  expo: {
    name: cfg.name,
    slug: cfg.slug,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: cfg.scheme,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A1A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: cfg.bundleIdentifier,
    },
    android: {
      package: cfg.androidPackage,
      adaptiveIcon: {
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
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appVariant: variant,
    },
  },
};
