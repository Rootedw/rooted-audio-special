import {createAccountClient} from './auth-server';
export async function readAccountState(userId:string){
 const client=await createAccountClient();
 const {data,error}=await client.from('ra_user_preferences').select('preference_key,value').eq('user_id',userId);
 if(error)throw new Error('Storage unavailable');
 return Object.fromEntries((data||[]).map(row=>[row.preference_key,row.value]));
}
export async function writeAccountState(userId:string,key:string,value:unknown){
 const client=await createAccountClient();
 const {error}=await client.from('ra_user_preferences').upsert({user_id:userId,preference_key:key,value,updated_at:new Date().toISOString()},{onConflict:'user_id,preference_key'});
 if(error)throw new Error('Storage unavailable');
}
export async function readAccountEntitlements(userId:string){
 const client=await createAccountClient();
 const {data,error}=await client.from('ra_entitlements').select('product_id').eq('user_id',userId);
 if(error)throw new Error('Product access unavailable');
 return (data||[]).map(row=>row.product_id as string);
}
