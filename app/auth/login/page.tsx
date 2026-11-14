import AccountForm from '../account-form';
import {accountLanguage,safeReturnPath} from '../../../lib/standalone/auth-policy';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const p=await searchParams;return <AccountForm mode="login" lang={accountLanguage(p.lang)} returnTo={safeReturnPath(p.return_to)} verificationError={p.error==='verification'}/>;}
