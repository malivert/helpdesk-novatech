"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (error) redirect(`/login?error=${encodeURIComponent("Identifiants incorrects.")}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.signUp({
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
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/login?message=${encodeURIComponent("Compte créé. Consultez votre e-mail pour confirmer l’inscription.")}`);
}
