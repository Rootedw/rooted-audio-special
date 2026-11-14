import { redirect } from "next/navigation";
import { getVerifiedAccount } from "../lib/standalone/auth-server";
// Compatibility names preserve existing callers during staged migration.
// No ChatGPT identity header is trusted in this standalone build.
export type ChatGPTUser = {userId:string;displayName:string;email:string;fullName:string|null};
export const getChatGPTUser = getVerifiedAccount;
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser>{
 const user=await getVerifiedAccount(); if(user)return user; redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo:string){return "/auth/login?return_to="+encodeURIComponent(safePath(returnTo));}
export function chatGPTSignOutPath(){return "/auth/signout";}
function safePath(value:string){return value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\")?value:"/";}
