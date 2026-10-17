"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { UserProfile } from "./types";

// الملف الشخصي للمستخدم المسجل (أستاذ / مفتش / مشرف) من جلسة المتصفح
export function useProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile((data as UserProfile) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, profile, reload: load };
}
