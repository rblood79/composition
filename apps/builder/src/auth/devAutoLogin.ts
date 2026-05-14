import { supabase } from "../env/supabase.client";

export const isDevAutoLoginEnabled = (): boolean =>
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV === "true";

export const tryDevAutoSignIn = async (): Promise<boolean> => {
  const email = import.meta.env.VITE_DEV_EMAIL;
  const password = import.meta.env.VITE_DEV_PASSWORD;
  if (!email || !password) {
    console.warn(
      "[dev-auto-login] VITE_ENABLE_DEV=true 이지만 VITE_DEV_EMAIL / VITE_DEV_PASSWORD 가 비어 있음",
    );
    return false;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[dev-auto-login] failed:", error.message);
    return false;
  }
  return true;
};
