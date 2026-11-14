import AccountForm from '../../account-form';
import { accountLanguage } from '../../../../lib/standalone/auth-policy';
import { payFirstEnabled } from '../../../../lib/guest-payment-policy';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!payFirstEnabled()) redirect('/shop');
  return <AccountForm mode="activate" lang={accountLanguage((await searchParams).lang)} />;
}
