import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AbuMascot } from "@/components/brand";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="main main--bare" style={{ alignItems: "center", textAlign: "center", paddingTop: 64 }}>
      <AbuMascot width={150} className="anim-float" />
      <h1>{t("title")}</h1>
      <p className="muted">{t("text")}</p>
      <Link href="/" className="btn btn--primary">{t("back")}</Link>
    </main>
  );
}
