import Link from "next/link";
import { SPECIAL_PRODUCT, specialSalesOpen } from "../../lib/special-sales";
import "./shop.css";
import WorkbookCover from "../workbook-cover";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="edition-page">
      <section className="edition-panel">
        <div className="edition-brand"><img className="edition-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" width={1685} height={933} fetchPriority="high" /></div>
        <div className="edition-art">
          <img src="/assets/go-blueprint-cover.jpeg" alt="Go Blueprint audiobookcover" />
          <div><WorkbookCover /></div>
        </div>
        <div>
          <p className="edition-label">Limited Edition</p>
          <h1>Rooted Audio Special</h1>
          <p>Deze Limited Edition bundelt twee zelfstandige producten van Rooted Within.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.4rem", display: "grid", gap: ".8rem" }}>
            <li><strong style={{ color: "var(--edition-gold)" }}>GO BLUEPRINT · Audiobook</strong><br />Het voorwoord en 13 hoofdstukken, ingesproken door Shoraifa Maayen.</li>
            <li><strong style={{ color: "var(--edition-gold)" }}>Journaling Workbook · De Shoraifa Methode</strong><br />Een zelfstandig werkboek met reflectievragen en schrijfoefeningen, als downloadbare PDF.</li>
          </ul>
          <p className="edition-price"><s>€32,94</s><strong>€24,05</strong></p>
          <div className="edition-actions">
            {specialSalesOpen() ? <Link className="btn" href={`/checkout?purchase=${SPECIAL_PRODUCT}&coupon=ROOTED27&lang=nl`}>Kies ROOTED AUDIO SPECIAL</Link> : <p>De Limited Edition is momenteel niet te bestellen.</p>}
            <Link className="btn ghost" href="/auth/login?lang=nl">Inloggen</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
