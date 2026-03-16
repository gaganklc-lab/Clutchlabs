const variant = process.env.APP_VARIANT ?? "clutchtap";

const IS_VELOCITY = variant === "velocity";

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
};

const cfg = VARIANTS[variant] || VARIANTS.clutchtap;

module.exports = {
  expo: {
    name: cfg.name,
    slug: cfg.slug,
    version: "1.0.0",
    orientation: "portrait",
    icon: IS_VELOCITY
      ? "./assets/images/velocity-icon.png"
      : "./assets/images/icon.png",
    scheme: cfg.scheme,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: IS_VELOCITY
        ? "./assets/images/velocity-splash-icon.png"
        : "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A1A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: cfg.bundleIdentifier,
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
