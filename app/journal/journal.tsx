"use client";

import { useEffect, useRef, useState } from "react";

type Page = { page: number; blocks: string[] };

export default function Journal({ pages, initialAnswers }: {
  pages: Page[];
  initialAnswers: Record<string, string>;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [status, setStatus] = useState("");
  const lastSaved = useRef(initialAnswers);
  const queue = useRef(Promise.resolve());

  function save(snapshot: Record<string, string>) {
    setStatus("Bezig met opslaan…");
    queue.current = queue.current.then(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "ra-workbook", value: snapshot }),
        });
        if (!response.ok) throw new Error("Save failed");
        lastSaved.current = snapshot;
        setStatus("Opgeslagen");
      } catch {
        setStatus("Opslaan mislukt. Probeer opnieuw.");
      }
    });
  }

  useEffect(() => {
    if (answers === lastSaved.current) return;
    const timer = window.setTimeout(() => save(answers), 750);
    return () => window.clearTimeout(timer);
  }, [answers]);

  const page = pages[index];
  const completedPages = pages.filter(item =>
    Object.entries(answers).some(([key, value]) => key.startsWith(`page-${item.page}-`) && value.trim())
  ).length;
  function field(id: string, label: string) {
    return (
      <label key={id} style={{ display: "grid", gap: ".4rem", marginBlock: "1rem" }}>
        {label}
        <textarea style={{ width: "100%", padding: ".75rem", border: "1px solid #b39862", borderRadius: ".5rem", background: "#fffaf0", color: "#10251a" }} rows={4} value={answers[id] ?? ""} onChange={(event) => {
          const value = event.target.value;
          setAnswers((previous) => ({ ...previous, [id]: value }));
        }} />
      </label>
    );
  }

  return (
    <>
      <label>Werkboekpagina <select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
        {pages.map((item, position) => <option key={item.page} value={position}>Pagina {item.page}</option>)}
      </select></label>
      <p>{completedPages} van {pages.length} pagina’s met antwoorden</p>
      <article key={page.page} style={{ background: "#f6eedf", color: "#10251a", padding: "clamp(1rem, 4vw, 2rem)", borderRadius: "1rem", marginBlock: "1rem", lineHeight: 1.65 }}>
        {page.blocks[0] && !(page.page > 3 && /(?:[?:…]|\.{3})$/.test(page.blocks[0].trim())) && <h2>{page.blocks[0]}</h2>}
        {page.blocks.map((block, position) =>
          page.page > 3 && /(?:[?:…]|\.{3})$/.test(block.trim())
            ? field(`page-${page.page}-prompt-${position}`, block)
            : position === 0 ? null : <p key={position}>{block}</p>
        )}
        {page.page > 3 && field(`page-${page.page}-notes`, "Mijn reflectie")}
      </article>
      <button type="button" onClick={() => save(answers)}>Opslaan</button>
      <p role="status">{status}</p>
      <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Vorige pagina</button>
      <button type="button" disabled={index === pages.length - 1} onClick={() => setIndex(index + 1)}>Volgende pagina</button>
    </>
  );
}
