import { ArrowUpRight } from 'lucide-react';
import { signOutAccount } from '../actions';
import { accountLanguage } from '../../../lib/standalone/auth-policy';
import AccountFrame from '../account-frame';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const nl = accountLanguage((await searchParams).lang) === 'nl';
  return <AccountFrame lang={nl ? 'nl' : 'en'} mode="signout"><div className="ra-form-heading"><p className="ra-eyebrow">ROOTED AUDIO · YOUR SPACE</p><h1>{nl ? 'Tot jouw volgende luistermoment.' : 'Until your next listening moment.'}</h1><p>{nl ? 'Log uit op alle apparaten. Je kunt later opnieuw inloggen en verdergaan met je bewaarde luisterpositie en teksten.' : 'Sign out on all devices. Sign in again later to continue with your saved listening position and writing.'}</p></div><form action={signOutAccount} className="ra-account-form"><input type="hidden" name="lang" value={nl?'nl':'en'}/><button className="ra-primary">{nl ? 'Uitloggen op alle apparaten' : 'Sign out on all devices'}<ArrowUpRight size={19} aria-hidden="true" /></button></form><div className="ra-form-bottom"><a href="/">{nl ? 'Terug naar mijn luisterplek' : 'Back to my listening space'}</a></div></AccountFrame>;
}
