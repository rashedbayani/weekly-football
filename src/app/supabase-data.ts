import {createClient} from '@supabase/supabase-js';
import type {SupabaseClient} from '@supabase/supabase-js';
import {decodeRecord,encodeData} from './cloud-data.ts';
import type {Data} from './domain.ts';
export interface SupabaseConfig {url:string;publishableKey:string;}
export const ADMIN_EMAIL='rashed.bayani@gmail.com';
export function validateSupabaseConfig(config:SupabaseConfig){
 if(!config || !/^https:\/\/[a-z0-9]{10,40}\.supabase\.co$/.test(config.url) || typeof config.publishableKey!=='string' || !config.publishableKey.startsWith('sb_publishable_'))throw new Error('The online database settings are incomplete.');
}
export class SupabaseData {
 readonly client:SupabaseClient;
 constructor(config:SupabaseConfig){
  validateSupabaseConfig(config);
  this.client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,init)=>fetch(url,{...init,signal:init?.signal??AbortSignal.timeout(20000)})}});
 }
 async identity():Promise<{email:string}|null>{
  const {data:stored,error:storedError}=await this.client.auth.getSession();if(storedError)throw storedError;
  if(!stored.session)return null;
  const {data,error}=await this.client.auth.getUser();if(error)throw error;
  const allowed=await this.client.rpc('touchline_can_edit');if(allowed.error)throw allowed.error;
  return allowed.data===true && data.user?.email?.toLowerCase()===ADMIN_EMAIL?{email:ADMIN_EMAIL}:null;
 }
 async signIn(email:string,password:string){
  if(email.trim().toLowerCase()!==ADMIN_EMAIL)throw new Error('Only the organizer’s email can sign in here.');
  const {error}=await this.client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;
  const identity=await this.identity();
  if(!identity){await this.signOut();throw new Error('This account does not have administrator access.');}
  return identity;
 }
 async signOut(){const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;}
 async read(){
  const {data,error}=await this.client.from('touchline_season').select('payload,revision').eq('id',1).abortSignal(AbortSignal.timeout(20000)).single();
  if(error)throw error;return decodeRecord(data);
 }
 async save(data:Data,expectedRevision:number){
  const payload=encodeData(data);
  const result=await this.client.from('touchline_season').update({payload}).eq('id',1).eq('revision',expectedRevision).select('payload,revision').abortSignal(AbortSignal.timeout(20000)).maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw new Error('These records changed in another tab, or your editing session expired. Close this form and refresh the records before trying again.');
  return decodeRecord(result.data);
 }
 async resetPassword(email:string,redirectTo:string){
  if(email.trim().toLowerCase()!==ADMIN_EMAIL)throw new Error('Enter the organizer’s email address.');
  const {error}=await this.client.auth.resetPasswordForEmail(ADMIN_EMAIL,{redirectTo});if(error)throw error;
 }
 async updatePassword(password:string){
  if(password.length<12)throw new Error('Choose a password with at least 12 characters.');
  const {error}=await this.client.auth.updateUser({password});if(error)throw error;
 }
}
