import Link from "next/link";
import { SPECIAL_PRODUCT, specialSalesOpen } from "../../lib/special-sales";
import "./shop.css";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main style={{ minHeight: "100svh", background: "#071b13", color: "#f6eedf", padding: "clamp(2rem, 7vw, 7rem)" }}>
      <p style={{ letterSpacing: ".24em", color: "#e5c58a" }}>ROOTED WITHIN</p>
      <h1 style={{ color: "#e5c58a", fontSize: "clamp(2.5rem, 8vw, 7rem)", lineHeight: 1 }}>ROOTED AUDIO SPECIAL</h1>
      <p>GO BLUEPRINT Audiobook · Voorwoord en 13 hoofdstukken</p>
      <p>Interactief Journaling Workbook · De Shoraifa Methode</p>
      <p><s>€32,94</s> <strong>€24,05</strong> · 27% verjaardagskorting</p>
      {specialSalesOpen() ? (
        <Link href={`/checkout?purchase=${SPECIAL_PRODUCT}&coupon=ROOTED27&lang=nl`}>Kies ROOTED AUDIO SPECIAL</Link>
      ) : <p>De verjaardagsactie is gesloten.</p>}
      <p><Link href="/auth/login?lang=nl">Inloggen</Link></p>
    </main>
  );
}
