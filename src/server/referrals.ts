/**
 * Indicar o app. Cada pessoa tem um código (link /?ref=CODIGO). O proxy guarda o código num cookie;
 * quando alguém NOVO cria o primeiro diário, a indicação é registrada; quando essa pessoa guarda a
 * primeira foto, o cachorro de quem indicou ganha patinhas (confirm_referral, com limite por mês).
 */
import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { XP_MONTH_GOAL } from "@/config/credits";
import { REFERRAL_COOKIE, REFERRAL_MONTHLY_CAP, REFERRAL_XP, isReferralCode } from "@/config/referrals";
import { adminClient } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supa: SupabaseClient; user: User };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const NEW_ACCOUNT_MS = 7 * 86_400_000; // só conta como indicada uma conta criada há pouco

async function ensureCode(userId: string): Promise<string> {
  const admin = adminClient();
  const { data } = await admin.from("profiles").select("referral_code").eq("user_id", userId).maybeSingle();
  if ((data as any)?.referral_code) return (data as any).referral_code;
  for (let i = 0; i < 6; i++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const { error } = await admin.from("profiles").upsert({ user_id: userId, referral_code: code }, { onConflict: "user_id" });
    if (!error) return code;
  }
  throw new Error("referral code");
}

/** Tela "Indicar o app": código e quantas pessoas já vieram. */
export async function referralInfo(ctx: Ctx) {
  const code = await ensureCode(ctx.user.id);
  const { data } = await ctx.supa.from("referrals").select("confirmed_at, xp_amount").eq("referrer_id", ctx.user.id);
  const rows = (data ?? []) as any[];
  return {
    code,
    joined: rows.length,
    confirmed: rows.filter((r) => r.confirmed_at).length,
    xpEarned: rows.reduce((s, r) => s + (r.xp_amount ?? 0), 0),
    xpPerFriend: REFERRAL_XP,
    monthlyCap: REFERRAL_MONTHLY_CAP,
  };
}

/** Ao criar o primeiro diário: registra quem indicou (se veio por um link e a conta é nova). */
export async function attachReferral(ctx: Ctx) {
  try {
    const raw = (await cookies()).get(REFERRAL_COOKIE)?.value?.toUpperCase();
    if (!raw || !isReferralCode(raw)) return;
    if (Date.now() - Date.parse(ctx.user.created_at) > NEW_ACCOUNT_MS) return;
    const admin = adminClient();
    const { data: ref } = await admin.from("profiles").select("user_id").eq("referral_code", raw).maybeSingle();
    const referrer = (ref as any)?.user_id;
    if (!referrer || referrer === ctx.user.id) return;
    await admin.from("referrals").insert({ referrer_id: referrer, referred_id: ctx.user.id }); // único por pessoa indicada
  } catch (e) {
    console.error("indicação não registrada:", e instanceof Error ? e.message : e);
  }
}

/** Ao guardar uma foto: confirma a indicação pendente (barato quando não há nenhuma). */
export async function confirmReferral(ctx: Ctx) {
  try {
    const admin = adminClient();
    const { data: pending } = await admin.from("referrals").select("id").eq("referred_id", ctx.user.id).is("confirmed_at", null).maybeSingle();
    if (!pending) return;
    const { data: dog } = await admin.rpc("confirm_referral", { p_referred: ctx.user.id, p_amount: REFERRAL_XP, p_cap: REFERRAL_MONTHLY_CAP });
    // As patinhas da indicação contam para o presente do mês de quem indicou.
    if (dog) await admin.rpc("grant_monthly_xp_credit_dog", { p_dog: dog, p_goal: XP_MONTH_GOAL });
  } catch (e) {
    console.error("indicação não confirmada:", e instanceof Error ? e.message : e);
  }
}
