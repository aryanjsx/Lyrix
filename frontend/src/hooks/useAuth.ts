import { useCallback, useEffect } from "react";
import { useLyrixStore } from "@/store";
import {
  logout as apiLogout,
  getGoogleLoginUrl,
} from "@/services/authApi";
import { identifyUser, resetUser } from "@/services/telemetry";

export function useAuth() {
  const user = useLyrixStore((s) => s.user);
  const clearUser = useLyrixStore((s) => s.clearUser);

  const login = useCallback(() => {
    try {
      sessionStorage.setItem(
        "lyrix_return_path",
        window.location.pathname + window.location.search
      );
    } catch { /* sessionStorage unavailable */ }
    window.location.href = getGoogleLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearUser();
    resetUser();
  }, [clearUser]);

  useEffect(() => {
    if (user.profile) {
      identifyUser(user.profile.id);
    }
  }, [user.profile]);

  return {
    isLoggedIn: user.isLoggedIn,
    profile: user.profile,
    mode: user.mode,
    login,
    logout,
  };
}
