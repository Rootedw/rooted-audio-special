import Link from "next/link";
import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { hasEntitlement } from "../../lib/access";
import { SPECIAL_PRODUCT } from "../../lib/special-sales";
import { readAccountState } from "../../lib/standalone/preferences";
import Journal from "./journal";
import pages from "./content.json";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/auth/login?lang=nl");
  if (!(await hasEntitlement(user, SPECIAL_PRODUCT))) redirect("/shop");
  const state = await readAccountState(user.userId);
  const saved = state["ra-workbook"];
  const answers = Object.fromEntries(
    Object.entries(saved && typeof saved === "object" ? saved : {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
  return (
    <main style={{ maxWidth: 760, margin: "auto", padding: "2rem", color: "#f8edcf" }}>
      <Link href="/">Terug naar het audiobook</Link>
      <h1>Journaling Workbook</h1>
      <p>De Shoraifa Methode</p>
      <Journal pages={pages} initialAnswers={answers} />
    </main>
  );
}
