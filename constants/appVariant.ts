import Constants from "expo-constants";

type Variant = "clutchtap" | "velocity" | "surge";

const raw = (Constants.expoConfig?.extra?.appVariant as string) ?? "clutchtap";
export const APP_VARIANT: Variant =
  raw === "velocity" ? "velocity" : raw === "surge" ? "surge" : "clutchtap";
export const IS_CLUTCHTAP = APP_VARIANT === "clutchtap";
export const IS_VELOCITY = APP_VARIANT === "velocity";
export const IS_SURGE = APP_VARIANT === "surge";
export const VARIANT_GAME_ID = APP_VARIANT;
