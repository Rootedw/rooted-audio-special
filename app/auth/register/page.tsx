import AccountForm from '../account-form';
import {accountLanguage,safeReturnPath} from '../../../lib/standalone/auth-policy';
import { redirect } from 'next/navigation';
import { readPurchaseIntent } from '../../../lib/purchase-intent';
import { payFirstEnabled } from '../../../lib/guest-payment-policy';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const p=await searchParams;const lang=accountLanguage(p.lang);const intent=readPurchaseIntent(p.return_to);if(!intent)redirect('/shop?lang='+lang);if(payFirstEnabled())redirect('/checkout?'+new URLSearchParams({purchase:intent.productId,lang,coupon:intent.couponCode}).toString());return <AccountForm mode="register" lang={lang} returnTo={safeReturnPath(p.return_to)}/>;}
