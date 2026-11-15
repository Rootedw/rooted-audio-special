import Link from "next/link";
import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { hasEntitlement } from "../../lib/access";
import { SPECIAL_PRODUCT } from "../../lib/special-sales";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/auth/login?lang=nl&return_to=%2Fjournal");
  if (!(await hasEntitlement(user, SPECIAL_PRODUCT))) redirect("/shop");

  return (
    <main className="app onboarding">
      <section className="onboarding-card">
        <p className="kicker">ROOTED AUDIO SPECIAL</p>
        <h1>Journaling Workbook</h1>
        <p className="onboarding-copy">De Shoraifa Methode · PDF · 31 pagina’s</p>
        <a className="btn enter-btn" href="/api/workbook/special">Download het werkboek (PDF)</a>
        <Link className="btn ghost" href="/">Terug naar het audiobook</Link>
      </section>
    </main>
  );
}
