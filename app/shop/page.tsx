import Link from "next/link";
import { SPECIAL_PRODUCT, specialSalesOpen } from "../../lib/special-sales";
import "./shop.css";
import WorkbookCover from "../workbook-cover";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="edition-page">
      <section className="edition-panel">
        <div className="edition-art">
          <img src="/assets/go-blueprint-cover.jpeg" alt="Go Blueprint audiobookcover" />
          <div><WorkbookCover /></div>
        </div>
        <div>
          <p className="edition-label">27th Birthday Limited Edition</p>
          <h1>Rooted Audio Special</h1>
          <p>Luister naar GO BLUEPRINT en neem daarna de tijd voor de reflectievragen en oefeningen uit het Journaling Workbook van De Shoraifa Methode.</p>
          <p className="edition-price"><s>€32,94</s><strong>€24,05</strong></p>
          <div className="edition-actions">
            {specialSalesOpen() ? <Link className="btn" href={`/checkout?purchase=${SPECIAL_PRODUCT}&coupon=ROOTED27&lang=nl`}>Kies ROOTED AUDIO SPECIAL</Link> : <p>De verjaardagsactie is gesloten.</p>}
            <Link className="btn ghost" href="/auth/login?lang=nl">Inloggen</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
