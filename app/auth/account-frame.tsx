import type { ReactNode } from 'react';
import { Bookmark, Headphones, PenLine } from 'lucide-react';
import { DEEPENING_PRODUCT, type ProductId } from '../../lib/products';

export type AccountMode = 'login' | 'register' | 'reset' | 'password' | 'recovery' | 'signout' | 'checkout' | 'activate';
export default function AccountFrame({ lang, mode, languageLinks, productId, children }: {
  lang: 'nl' | 'en'; mode: AccountMode; languageLinks?: { nl: string; en: string }; productId?: ProductId; children: ReactNode;
}) {
  const nl = lang === 'nl';
  const registering = mode === 'register' || mode === 'activate';
  const recovering = ['reset', 'password', 'recovery'].includes(mode);
  const cover = productId === DEEPENING_PRODUCT ? '/assets/go-blueprint-deepening.jpeg' : '/assets/go-blueprint-cover.jpeg';
  return <main className="rooted-account" lang={lang}>
    <div className="ra-container">
      <header className="ra-masthead">
        <a href={'/shop?lang=' + lang} className="ra-logo-link" aria-label="Rooted Within · ROOTED AUDIO"><img className="ra-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" width="1685" height="933" fetchPriority="high" /></a>
        <div className="ra-masthead-right"><span>ROOTED AUDIO</span>{languageLinks && <nav aria-label={nl ? 'Taal' : 'Language'}><a href={languageLinks.nl} lang="nl" aria-current={nl ? 'page' : undefined}>Nederlands</a><span aria-hidden="true"> / </span><a href={languageLinks.en} lang="en" aria-current={!nl ? 'page' : undefined}>English</a></nav>}</div>
      </header>
      <div className="ra-layout">
        <section className="ra-story" aria-label={nl ? 'Jouw luisterervaring' : 'Your listening experience'}>
          <p className="ra-eyebrow">{nl ? 'EEN PLEK OM TERUG TE KEREN' : 'A PLACE TO RETURN TO'}</p>
          <h2>{registering ? (nl ? <>Maak ruimte<br /><em>voor jezelf.</em></> : <>Make room<br /><em>for yourself.</em></>) : recovering ? (nl ? <>De weg terug<br /><em>naar jouw luisterplek.</em></> : <>Your way back<br /><em>to your listening space.</em></>) : (nl ? <>Welkom in jouw<br /><em>luisterwereld.</em></> : <>Welcome to your<br /><em>listening world.</em></>)}</h2>
          <p className="ra-story-description">{registering ? (nl ? 'Een eigen plek voor jouw hoofdstukken, inzichten en momenten van herkenning. Helemaal in jouw tempo.' : 'Your own place for chapters, insights and moments of recognition. Entirely at your own pace.') : recovering ? (nl ? 'Je account brengt je terug naar je hoofdstukken, opgeslagen luisterpositie en persoonlijke reflecties.' : 'Your account brings you back to your chapters, saved listening position and personal reflections.') : (nl ? 'Ga verder waar je gebleven was. Bij de woorden die je raakten, de inzichten die bleven en de ruimte voor jezelf.' : 'Continue where you left off. With the words that moved you, the insights that stayed and the space you make for yourself.')}</p>
          <div className="ra-story-art"><div className="ra-cover-frame"><img src={cover} alt={productId === DEEPENING_PRODUCT ? 'GO BLUEPRINT · Deepening Bundle' : 'GO BLUEPRINT · Audiobook'} width="1024" height="1536" /></div><div className="ra-art-caption"><span aria-hidden="true">✦</span><p>An audiobook<br />you enter.</p><small>BY SHORAIFA MAAYEN</small></div></div>
          <ul className="ra-features"><li><Headphones size={16} aria-hidden="true" />{nl ? 'Luisteren in jouw tempo' : 'Listen at your own pace'}</li><li><Bookmark size={16} aria-hidden="true" />{nl ? 'Je luisterpositie bewaard' : 'Your listening position saved'}</li><li><PenLine size={16} aria-hidden="true" />{nl ? 'Ruimte voor privéreflecties' : 'Space for private reflections'}</li></ul>
        </section>
        <section className="ra-panel" aria-label={mode === 'checkout' ? (nl ? 'Je bestelling' : 'Your order') : (nl ? 'Je account' : 'Your account')}>{children}</section>
      </div>
      <footer className="ra-footer"><p>The blueprint was always leading you home.</p><span>ROOTED AUDIO · BY ROOTED WITHIN</span></footer>
    </div>
  </main>;
}
