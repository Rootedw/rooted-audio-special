import type { ReactNode } from 'react';
import { Bookmark, Headphones, PenLine } from 'lucide-react';
import type { ProductId } from '../../lib/products';
import WorkbookCover from '../workbook-cover';

export type AccountMode = 'login' | 'register' | 'reset' | 'password' | 'recovery' | 'signout' | 'checkout' | 'activate';
export default function AccountFrame({ lang, mode, languageLinks, children }: {
  lang: 'nl' | 'en'; mode: AccountMode; languageLinks?: { nl: string; en: string }; productId?: ProductId; children: ReactNode;
}) {
  const nl = lang === 'nl';
  const registering = mode === 'register' || mode === 'activate';
  const recovering = ['reset', 'password', 'recovery'].includes(mode);
  return <main className="rooted-account" lang={lang}>
    <div className="ra-container">
      <header className="ra-masthead">
        <a href={'/shop?lang=' + lang} className="ra-logo-link" aria-label="Rooted Within · ROOTED AUDIO"><img className="ra-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" width="1685" height="933" fetchPriority="high" /></a>
        <div className="ra-masthead-right"><span>ROOTED AUDIO SPECIAL</span>{languageLinks && <nav aria-label={nl ? 'Taal' : 'Language'}><a href={languageLinks.nl} lang="nl" aria-current={nl ? 'page' : undefined}>Nederlands</a><span aria-hidden="true"> / </span><a href={languageLinks.en} lang="en" aria-current={!nl ? 'page' : undefined}>English</a></nav>}</div>
      </header>
      <div className="ra-layout">
        <section className="ra-story" aria-label={nl ? 'Jouw luisterervaring' : 'Your listening experience'}>
          <p className="ra-eyebrow">{nl ? 'EEN PLEK OM TERUG TE KEREN' : 'A PLACE TO RETURN TO'}</p>
          <h2>{registering ? (nl ? <>Maak ruimte<br /><em>voor jezelf.</em></> : <>Make room<br /><em>for yourself.</em></>) : recovering ? (nl ? <>De weg terug<br /><em>naar jouw luisterplek.</em></> : <>Your way back<br /><em>to your listening space.</em></>) : (nl ? <>Welkom in jouw<br /><em>luisterwereld.</em></> : <>Welcome to your<br /><em>listening world.</em></>)}</h2>
          <p className="ra-story-description">{registering ? (nl ? 'Een eigen plek voor jouw hoofdstukken, inzichten en momenten van herkenning. Helemaal in jouw tempo.' : 'Your own place for chapters, insights and moments of recognition. Entirely at your own pace.') : recovering ? (nl ? 'Je account brengt je terug naar je hoofdstukken, opgeslagen luisterpositie en persoonlijke reflecties.' : 'Your account brings you back to your chapters, saved listening position and personal reflections.') : (nl ? 'Ga verder waar je gebleven was. Bij de woorden die je raakten, de inzichten die bleven en de ruimte voor jezelf.' : 'Continue where you left off. With the words that moved you, the insights that stayed and the space you make for yourself.')}</p>
          <div className="edition-art ra-bundle-covers" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <img src="/assets/go-blueprint-cover.jpeg" alt="GO BLUEPRINT · Audiobook" fetchPriority="high" loading="eager" width={1024} height={1536} style={{ display: "block", width: "100%", maxWidth: 180, height: "auto", margin: "0 auto" }} />
              <figcaption style={{ marginTop: ".6rem", color: "var(--edition-gold)" }}>GO BLUEPRINT · Audiobook</figcaption>
            </figure>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <WorkbookCover />
              <figcaption style={{ marginTop: ".6rem", color: "var(--edition-gold)" }}>Journaling Workbook · De Shoraifa Methode</figcaption>
            </figure>
          </div>
          <ul className="ra-features"><li><Headphones size={16} aria-hidden="true" />{nl ? 'Luisteren in jouw tempo' : 'Listen at your own pace'}</li><li><Bookmark size={16} aria-hidden="true" />{nl ? 'Je luisterpositie bewaard' : 'Your listening position saved'}</li><li><PenLine size={16} aria-hidden="true" />{nl ? 'Ruimte voor privéreflecties' : 'Space for private reflections'}</li></ul>
        </section>
        <section className="ra-panel" aria-label={mode === 'checkout' ? (nl ? 'Je bestelling' : 'Your order') : (nl ? 'Je account' : 'Your account')}>{children}</section>
      </div>
      <footer className="ra-footer"><p>The blueprint was always leading you home.</p><span>ROOTED AUDIO · BY ROOTED WITHIN</span></footer>
    </div>
  </main>;
}
