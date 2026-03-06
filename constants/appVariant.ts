import Constants from "expo-constants";

type Variant = "clutchtap" | "velocity";

const raw = (Constants.expoConfig?.extra?.appVariant as string) ?? "clutchtap";
export const APP_VARIANT: Variant = raw === "velocity" ? "velocity" : "clutchtap";
export const IS_CLUTCHTAP = APP_VARIANT === "clutchtap";
export const IS_VELOCITY = APP_VARIANT === "velocity";
export const VARIANT_GAME_ID = APP_VARIANT;
