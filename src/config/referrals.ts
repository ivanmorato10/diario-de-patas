/** Indicar o app: patinhas para quem indica quando o amigo cria o diário e guarda a primeira foto. */
export const REFERRAL_XP = 20;
export const REFERRAL_MONTHLY_CAP = 5;
export const REFERRAL_COOKIE = "ddp_ref";
export const isReferralCode = (c: string) => /^[A-Z2-9]{6}$/.test(c);
