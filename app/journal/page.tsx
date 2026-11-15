import WorkbookCover from "../workbook-cover";
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
    <main className="edition-page">
      <section className="edition-panel">
        <div className="edition-brand"><img className="edition-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" width={1685} height={933} /></div>
        <div className="edition-art edition-art--single"><div><WorkbookCover /></div></div>
        <div>
          <p className="edition-label">Rooted Audio Special · Limited Edition</p>
          <h1>Journaling Workbook</h1>
          <p>De Shoraifa Methode · PDF · 31 pagina’s</p>
          <div className="edition-actions">
            <a className="btn" href="/api/workbook/special">Download het werkboek (PDF)</a>
            <Link className="btn ghost" href="/">Terug naar het audiobook</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
