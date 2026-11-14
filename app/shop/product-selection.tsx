"use client";
import { useRef, useState } from 'react';
import { AUDIOBOOK_PRODUCT, DEEPENING_PRODUCT, PRODUCTS, type ProductId } from '../../lib/products';
import { accountPurchasePath, type PurchaseIntent } from '../../lib/purchase-intent';
import { quoteSelection } from './actions';
type Offer = { id: ProductId; image: string; name: string; label: string; title: string; paragraphs: string[]; includes: string[]; button: string };

export default function ProductSelection({ lang, initial, initialQuote, salesOpen, payFirst = false }: { lang: 'nl' | 'en'; initial: PurchaseIntent | null; initialQuote: Awaited<ReturnType<typeof quoteSelection>> | null; salesOpen: boolean; payFirst?: boolean }) {
  const nl = lang === 'nl';
  const [selected, setSelected] = useState<ProductId | null>(initial?.productId || null);
  const [coupon, setCoupon] = useState(initial?.couponCode || '');
  const [quote, setQuote] = useState<{ amount: string; code: string } | null>(initialQuote?.amount && initialQuote.code && !initialQuote.error ? { amount: initialQuote.amount, code: initialQuote.code } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialQuote?.error ? (initialQuote.error === 'COUPON_EXPIRED' ? (nl ? 'Deze kortingscode is verlopen.' : 'This discount code has expired.') : (nl ? 'Deze kortingscode is niet geldig. Controleer de code.' : 'This discount code is not valid. Please check it.')) : '');
  const revision = useRef(0);
  const normalized = coupon.trim().toUpperCase();
  const validQuote = quote?.code === normalized ? quote : null;
  const total = validQuote?.amount || (selected ? PRODUCTS[selected].amount : null);
  const ready = Boolean(selected && (!normalized || validQuote) && !busy);
  const intent: PurchaseIntent | null = selected ? { productId: selected, couponCode: normalized, lang } : null;
  const continuePath = intent ? (payFirst ? '/checkout?' + new URLSearchParams({ purchase: intent.productId, coupon: intent.couponCode, lang }).toString() : accountPurchasePath(intent)) : '/shop';
  function invalidate() { revision.current += 1; setQuote(null); setError(''); setBusy(false); }
  async function apply() {
    if (!selected || !normalized || busy) return;
    const current = ++revision.current; setBusy(true); setError(''); setQuote(null);
    try {
      const result = await quoteSelection(selected, normalized);
      if (current !== revision.current) return;
      if (result.amount && result.code && !result.error) setQuote({ amount: result.amount, code: result.code });
      else setError(result.error === 'COUPON_EXPIRED' ? (nl ? 'Deze kortingscode is verlopen.' : 'This discount code has expired.') : (nl ? 'Deze kortingscode is niet geldig. Controleer de code.' : 'This discount code is not valid. Please check it.'));
    } catch { if (current === revision.current) setError(nl ? 'Controleren lukt nu niet. Probeer opnieuw.' : 'Unable to check right now. Please try again.'); }
    finally { if (current === revision.current) setBusy(false); }
  }
  function languageLink(next: string) {
    const query = new URLSearchParams({ lang: next });
    if (selected) query.set('purchase', selected);
    if (normalized) query.set('coupon', normalized);
    return '/shop?' + query.toString();
  }
  function choose(productId: ProductId, advance = false) {
    invalidate(); setSelected(productId);
    if (advance) window.requestAnimationFrame(() => document.getElementById('purchase-summary')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  const offers: Offer[] = [
    {
      id: AUDIOBOOK_PRODUCT,
      image: '/assets/go-blueprint-cover.jpeg',
      name: 'GO BLUEPRINT · AUDIOBOOK',
      label: nl ? 'DE LUISTERERVARING' : 'THE LISTENING EXPERIENCE',
      title: nl ? 'Laat het verhaal binnenkomen.' : 'Let the story in.',
      paragraphs: nl ? [
        'Luister naar mijn verhaal en ontdek wat het in jouw eigen verhaal raakt. Over verlangen naar liefde, jezelf verlaten om gekozen te worden en de weg terug naar wie je bent.',
        'Luister in jouw tempo. Pauzeer waar iets binnenkomt. Keer terug naar de woorden die je nog even bij je wilt houden.',
      ] : [
        'Listen to my story and discover what it touches in your own. About longing for love, abandoning yourself to be chosen, and finding your way back to who you are.',
        'Listen at your own pace. Pause when something lands. Return to the words you want to keep close for a little longer.',
      ],
      includes: nl ? [
        'Het voorwoord en alle 13 hoofdstukken',
        '2 uur en 12 minuten audio, ingesproken door Shoraifa Maayen',
        'Korte regulatieoefeningen om tussendoor te landen',
        'Je eigen luisteromgeving met opgeslagen luisterpositie, favorieten en privéreflecties',
      ] : [
        'The foreword and all 13 chapters',
        '2 hours and 12 minutes of audio, narrated by Shoraifa Maayen in Dutch',
        'Short regulation exercises to help you ground along the way',
        'Your own listening space with saved progress, favourites and private reflections',
      ],
      button: nl ? 'IK KIES HET AUDIOBOOK' : 'I CHOOSE THE AUDIOBOOK',
    },
    {
      id: DEEPENING_PRODUCT,
      image: '/assets/go-blueprint-deepening.jpeg',
      name: 'GO BLUEPRINT · DEEPENING BUNDLE',
      label: nl ? 'HET VERHAAL + JOUW VERDIEPING' : 'THE STORY + YOUR DEEPER JOURNEY',
      title: nl ? 'Geef wat je raakt de ruimte om te veranderen.' : 'Give what moves you room to change.',
      paragraphs: nl ? [
        'Soms herken je jezelf in een verhaal en voel je: hier wil ik bij blijven. Hier ligt iets waar ik niet opnieuw aan voorbij wil gaan.',
        'De Deepening Bundle brengt je van luisteren naar onderzoeken. Wat heb jij geleerd over liefde? Waar blijf je wachten op iets van een ander? En wat wil je vanaf nu anders meenemen in je leven?',
        'Je ontvangt het volledige audiobook, aangevuld met drie bonusaudio’s en het GO BLUEPRINT Workbook: een persoonlijke plek om te schrijven, patronen te herkennen en woorden te geven aan wat in jou zichtbaar wordt.',
      ] : [
        'Sometimes you recognise yourself in a story and feel: I want to stay with this. There is something here I do not want to pass by again.',
        'The Deepening Bundle takes you from listening to exploring. What have you learned about love? Where are you still waiting for something from someone else? And what do you want to carry differently from now on?',
        'Receive the complete audiobook, three bonus audios and the GO BLUEPRINT Workbook: a personal place to write, recognise patterns and give words to what becomes visible within you.',
      ],
      includes: nl ? [
        'Alles uit het Audiobook',
        '3 bonusaudio’s over afsluiting, aangeleerde liefde en wie jij wilt worden',
        'Het digitale GO BLUEPRINT Workbook, direct online invulbaar',
        'Je antwoorden automatisch bewaard, zodat je later verder kunt',
        'Een invulbare PDF en printversie',
        'In totaal 2 uur en 27 minuten audio',
      ] : [
        'Everything included in the Audiobook',
        '3 bonus audios about closure, learned love and who you want to become',
        'The digital GO BLUEPRINT Workbook, ready to complete online',
        'Your answers saved automatically, ready for you to return',
        'A fillable PDF and a print edition',
        '2 hours and 27 minutes of audio in total',
      ],
      button: nl ? 'IK KIES DE DEEPENING BUNDLE' : 'I CHOOSE THE DEEPENING BUNDLE',
    },
  ];
  return <main className="app purchase-selection" lang={lang}>
    <div className="purchase-selection-inner">
      <header className="purchase-masthead">
        <a className="purchase-logo-link" href="/shop" aria-label="Rooted Within · ROOTED AUDIO"><img className="purchase-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" width="600" height="332" fetchPriority="high" /></a>
        <div className="purchase-masthead-bottom"><span>ROOTED AUDIO</span><nav aria-label={nl ? 'Taal' : 'Language'}><a href={languageLink('nl')} lang="nl" aria-current={nl ? 'page' : undefined}>NL</a><span aria-hidden="true"> / </span><a href={languageLink('en')} lang="en" aria-current={!nl ? 'page' : undefined}>EN</a></nav></div>
      </header>
      <section className="purchase-hero" aria-labelledby="purchase-title">
        <p className="purchase-eyebrow">SHORAIFA MAAYEN · PUBLICATION 01</p>
        <h1 id="purchase-title">GO BLUEPRINT</h1>
        <p className="purchase-tagline">An audiobook you enter.</p>
        <div className="purchase-hero-divider" aria-hidden="true"><span />✦<span /></div>
        <h2>{nl ? <>Sommige verhalen luister je.<br /><em>Andere openen iets in jou.</em></> : <>Some stories you listen to.<br /><em>Others open something within you.</em></>}</h2>
        <div className="purchase-introduction">
          <p>{nl ? 'Je dacht dat het over hen ging. De liefde. De verbinding. Het verlies. Tot je begon te zien wat het allemaal in jou aanraakte.' : 'You thought it was about them. The love. The connection. The loss. Until you began to see what it was touching within you.'}</p>
          <p>{nl ? 'GO BLUEPRINT neemt je mee door liefde, hechting, oude wonden en de patronen waarin je jezelf soms kwijtraakt. Met ruimte om te voelen, te bewegen, te schrijven en terug te keren naar jezelf.' : 'GO BLUEPRINT takes you through love, attachment, old wounds and the patterns in which you sometimes lose yourself. With space to feel, move, write and return to yourself.'}</p>
        </div>
        <a className="purchase-explore" href="#kies-je-ervaring">{nl ? 'ONTDEK JOUW ERVARING' : 'DISCOVER YOUR EXPERIENCE'} <span aria-hidden="true">↓</span></a>
        {!salesOpen && <p className="purchase-closed" role="status"><span aria-hidden="true" />{nl ? 'De verkoop is nog niet geopend.' : 'Sales have not opened yet.'}</p>}
      </section>
      <section id="kies-je-ervaring" className="purchase-choices" aria-labelledby="purchase-choice-title">
        <div className="purchase-section-heading"><p className="purchase-eyebrow">{nl ? 'JOUW REIS, JOUW TEMPO' : 'YOUR JOURNEY, YOUR PACE'}</p><h2 id="purchase-choice-title">{nl ? <>Kies hoe jij deze reis<br /><em>wilt ervaren.</em></> : <>Choose how you want<br /><em>to experience this journey.</em></>}</h2></div>
        <ol className="purchase-steps" aria-label={nl ? 'De aankooproute' : 'Your purchase journey'}><li aria-current="step"><span>01</span>{nl ? 'Kies je ervaring' : 'Choose your experience'}</li><li><span>02</span>{payFirst ? (nl ? 'Veilig betalen' : 'Secure payment') : (nl ? 'Je account' : 'Your account')}</li><li><span>03</span>{payFirst ? (nl ? 'Account activeren' : 'Activate account') : (nl ? 'Veilig betalen' : 'Secure payment')}</li></ol>
        <fieldset className="purchase-options">
          <legend className="purchase-sr-only">{nl ? 'Kies je product' : 'Choose your product'}</legend>
          {offers.map((offer, index) => <article key={offer.id} className={'purchase-option' + (selected === offer.id ? ' selected' : '')}>
            <div className="purchase-option-top"><span className="purchase-eyebrow">{offer.label}</span><input type="radio" name="product" value={offer.id} checked={selected === offer.id} onChange={() => choose(offer.id)} aria-labelledby={'offer-name-' + index} /></div>
            <button type="button" className="purchase-art" onClick={() => choose(offer.id)} aria-label={(nl ? 'Kies ' : 'Choose ') + offer.name}><img src={offer.image} alt={offer.name + (nl ? ' · officiële cover' : ' · official cover')} width="700" height="900" loading="lazy" /></button>
            <div className="purchase-option-content"><h3 id={'offer-name-' + index} className="purchase-product-name">{offer.name}</h3><p className="purchase-offer-title">{offer.title}</p><div className="purchase-offer-copy">{offer.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              <div className="purchase-includes"><p className="purchase-eyebrow">{nl ? 'DIT ONTVANG JE' : 'WHAT YOU RECEIVE'}</p><ul>{offer.includes.map(item => <li key={item}><span aria-hidden="true">✦</span>{item}</li>)}</ul></div>
              <div className="purchase-offer-bottom"><p className="purchase-option-price">€{nl ? PRODUCTS[offer.id].amount.replace('.', ',') : PRODUCTS[offer.id].amount}<span>{nl ? 'eenmalig' : 'one-time payment'}</span></p><button type="button" className={'purchase-select-button' + (selected === offer.id ? ' is-selected' : '')} aria-pressed={selected === offer.id} onClick={() => choose(offer.id, true)}>{selected === offer.id ? <><span aria-hidden="true">✓ </span>{nl ? 'GEKOZEN' : 'SELECTED'} · {offer.id === AUDIOBOOK_PRODUCT ? 'AUDIOBOOK' : 'DEEPENING BUNDLE'}</> : offer.button}<span aria-hidden="true">↗</span></button></div>
            </div>
          </article>)}
        </fieldset>
      </section>
      <aside className="purchase-upgrade-note"><span className="purchase-note-symbol" aria-hidden="true">↗</span><div><h2>{nl ? 'Begin waar jij nu bent.' : 'Begin where you are.'}</h2><p>{nl ? 'Kies je eerst het Audiobook en wil je later verder verdiepen? Dan kun je binnen hetzelfde account upgraden voor €6,96. Je luisterpositie en persoonlijke reflecties blijven behouden.' : 'Choose the Audiobook first and feel ready to go deeper later? Upgrade within the same account for €6.96. Your listening position and personal reflections stay with you.'}</p></div></aside>
      <section id="purchase-summary" className="purchase-summary" aria-labelledby="purchase-summary-title">
        <div className="purchase-summary-intro"><p className="purchase-eyebrow">{nl ? 'NEEM DE VOLGENDE STAP' : 'TAKE THE NEXT STEP'}</p><h2 id="purchase-summary-title">{nl ? 'Jouw keuze.' : 'Your selection.'}</h2><p>{nl ? (payFirst ? 'Heb je een kortingscode? Vul die hieronder in. Je ziet het aangepaste bedrag voordat je betaalt. Je account activeer je na betaling.' : 'Heb je een kortingscode? Vul die hieronder in. Je ziet het aangepaste bedrag voordat je een account aanmaakt en betaalt.') : (payFirst ? 'Have a discount code? Enter it below to see your total before payment. Activate your account after paying.' : 'Have a discount code? Enter it below. You will see your updated total before creating an account and paying.')}</p></div>
        <div className="purchase-summary-details">
          {selected && <p className="purchase-selected-name">{PRODUCTS[selected].name}</p>}
          <label htmlFor="selection-coupon">{nl ? 'Kortingscode (optioneel)' : 'Discount code (optional)'}</label>
          <div className="purchase-coupon-row"><input id="selection-coupon" autoComplete="off" autoCapitalize="characters" maxLength={80} value={coupon} onChange={(event) => { invalidate(); setCoupon(event.target.value); }} /><button type="button" className="purchase-code-button" disabled={!selected || !normalized || busy} onClick={() => void apply()}>{busy ? (nl ? 'CONTROLEREN…' : 'CHECKING…') : (nl ? 'CODE TOEPASSEN' : 'APPLY CODE')}</button></div>
          {error && <p role="alert">{error}</p>}
          <div className="purchase-total" aria-live="polite">{total ? <><div>{nl ? 'Totaal' : 'Total'}{validQuote && <small>{total === '0.00' ? (nl ? '100% korting toegepast' : '100% discount applied') : (nl ? '15% korting toegepast' : '15% discount applied')}</small>}</div><strong>€{nl ? total.replace('.', ',') : total}</strong></> : <p>{nl ? 'Kies hierboven je ervaring.' : 'Choose your experience above.'}</p>}</div>
          {normalized && !validQuote && !busy && <p className="purchase-summary-hint">{nl ? 'Pas je code toe voordat je verdergaat, of maak het veld leeg.' : 'Apply your code before continuing, or clear the field.'}</p>}
          {ready && intent ? <a className="purchase-continue" href={continuePath}>{payFirst ? (nl ? 'VERDER · VEILIG BETALEN' : 'CONTINUE · SECURE PAYMENT') : (nl ? 'VERDER · ACCOUNT AANMAKEN' : 'CONTINUE · CREATE ACCOUNT')}<span aria-hidden="true">↗</span></a> : <button className="purchase-continue" disabled>{payFirst ? (nl ? 'VERDER · VEILIG BETALEN' : 'CONTINUE · SECURE PAYMENT') : (nl ? 'VERDER · ACCOUNT AANMAKEN' : 'CONTINUE · CREATE ACCOUNT')}<span aria-hidden="true">↗</span></button>}
          <p className="purchase-summary-hint">{nl ? (payFirst ? 'Eerst betalen. Daarna ontvang je de activatiemail voor je eigen luisterplek.' : 'Je keuze en korting gaan met je mee. Na je account volgt het betaaloverzicht.') : (payFirst ? 'Pay first. Your account activation email follows after successful payment.' : 'Your selection and discount stay with you. Your payment summary follows your account.')}</p>
          <a className="purchase-login" href={intent ? accountPurchasePath(intent, 'login') : '/auth/login?lang=' + lang}>{nl ? 'Heb je al een account? Log in.' : 'Already have an account? Sign in.'}</a>
        </div>
      </section>
      <footer className="purchase-footer"><p>The blueprint was always leading you home.</p><span>ROOTED AUDIO · ROOTED WITHIN</span></footer>
    </div>
  </main>;
}
