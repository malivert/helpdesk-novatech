"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect(`/login?error=${encodeURIComponent("Supabase n’est pas configuré. Utilisez le mode démonstration.")}`);
  let authenticationError: { message: string } | null = null;
  try {
    const result = await supabase.auth.signInWithPassword({
      email: text(formData, "email"),
      password: text(formData, "password"),
    });
    authenticationError = result.error;
  } catch {
    redirect(`/login?error=${encodeURIComponent("Supabase est momentanément inaccessible. Utilisez le mode démonstration.")}`);
  }
  if (authenticationError) redirect(`/login?error=${encodeURIComponent("Identifiants incorrects.")}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect(`/login?error=${encodeURIComponent("Supabase n’est pas configuré. Utilisez le mode démonstration.")}`);
  const origin = (await headers()).get("origin") ?? "";
  let registrationError: { message: string } | null = null;
  try {
    const result = await supabase.auth.signUp({
      email: text(formData, "email"),
      password: text(formData, "password"),
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          full_name: text(formData, "fullName"),
          department: text(formData, "department"),
        },
      },
    });
    registrationError = result.error;
  } catch {
    redirect(`/login?error=${encodeURIComponent("Supabase est momentanément inaccessible. Utilisez le mode démonstration.")}`);
  }
  if (registrationError) redirect(`/login?error=${encodeURIComponent(registrationError.message)}`);
  redirect(`/login?message=${encodeURIComponent("Compte créé. Consultez votre e-mail pour confirmer l’inscription.")}`);
}
