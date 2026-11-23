import { computed, Injectable, signal } from '@angular/core';
import { Data, emptyData, validateData, withPaymentDefaults } from './domain';
import { assertRevision } from './cloud-data';
import { SupabaseData } from './supabase-data';
const KEY='touchline.data.v1';
@Injectable({providedIn:'root'})
export class Store {
 readonly data=signal<Data>(withPaymentDefaults(emptyData()));
 readonly error=signal('');
 readonly mode=signal<'loading'|'local'|'cloud'|'unconfigured'>('loading');
 readonly ready=signal(false);
 readonly saving=signal(false);
 readonly signingIn=signal(false);
 readonly admin=signal(false);
 readonly user=signal<{email:string}|null>(null);
 readonly revision=signal(0);
 readonly connection=signal('Connecting…');
 readonly passwordRecovery=signal(false);
 readonly canEdit=computed(()=>this.ready() && (this.mode()==='local' || this.admin()));
 readonly role=computed(()=>this.mode()==='local'?'Local notebook':this.admin()?'Administrator':'View only');
 private database?:SupabaseData;
 private generation=0;
 private refreshing=false;
 private blocked=false;
 private localRaw:string|null=null;
 constructor(){void this.initialize();}
 private async initialize(){
  try{
   const response=await fetch(new URL('cloud-config.json',document.baseURI),{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error('The app configuration could not be loaded.');
   const config=await response.json();
   if(!config.enabled){
    if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw new Error('Online sharing has not been configured. Editing is disabled until setup is complete.');
    this.mode.set('local');this.loadLocal();return;
   }
   const type=new URLSearchParams(location.hash.slice(1)).get('type');
   this.passwordRecovery.set(type==='invite' || type==='recovery');
   this.database=new SupabaseData(config.supabase);this.mode.set('cloud');
   this.database.client.auth.onAuthStateChange(event=>{
    if(event==='PASSWORD_RECOVERY')this.passwordRecovery.set(true);
    if(event==='SIGNED_OUT'){this.generation++;this.admin.set(false);this.user.set(null);this.passwordRecovery.set(false);}
    // Keep database requests outside the auth callback's lock.
    if(event==='SIGNED_IN' || event==='SIGNED_OUT' || event==='TOKEN_REFRESHED')setTimeout(()=>void this.refresh(),0);
   });
   await this.refresh();
   setInterval(()=>{if(!document.hidden)void this.refresh();},60000);
   window.addEventListener('online',()=>void this.refresh());
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.refresh();});
  }catch(e){this.mode.set('unconfigured');this.connection.set('Setup required');this.error.set(this.message(e));}
 }
 private loadLocal(){
  try{this.localRaw=localStorage.getItem(KEY);if(this.localRaw){const value:unknown=JSON.parse(this.localRaw);validateData(value);this.data.set(withPaymentDefaults(value));}}
  catch{this.blocked=true;this.error.set('Saved local data could not be read. Export it before restoring a valid backup. Existing storage has not been overwritten.');}
  this.ready.set(true);this.connection.set('Saved on this device');
 }
 async refresh(){
  if(!this.database || this.refreshing || this.saving() || this.signingIn())return;
  this.refreshing=true;const generation=this.generation;
  try{
   const identity=await this.database.identity();
   const record=await this.database.read();
   if(generation!==this.generation)return;
   this.user.set(identity);this.admin.set(!!identity);this.data.set(withPaymentDefaults(record.data));this.revision.set(record.revision);this.ready.set(true);
   this.connection.set('Saved online · refreshes every minute');this.error.set('');
  }catch(e){if(generation!==this.generation)return;this.ready.set(false);this.connection.set('Connection unavailable · retrying');this.error.set(this.message(e));}
  finally{this.refreshing=false;}
 }
 async signIn(email:string,password:string):Promise<boolean>{
  if(!this.database || this.signingIn())return false;
  this.signingIn.set(true);this.generation++;this.error.set('');
  try{
   const identity=await this.database.signIn(email,password);
   const record=await this.database.read();
   this.user.set(identity);this.admin.set(true);this.data.set(withPaymentDefaults(record.data));this.revision.set(record.revision);this.ready.set(true);this.connection.set('Saved online');return true;
  }catch(e){this.error.set(this.message(e));return false;}finally{this.signingIn.set(false);}
 }
 async signOut(){
  if(this.saving() || !this.database)return;
  this.generation++;this.admin.set(false);this.user.set(null);this.passwordRecovery.set(false);
  try{await this.database.signOut();}catch(e){this.error.set(this.message(e));}
  await this.refresh();
 }
 async resetPassword(email:string):Promise<boolean>{
  if(!this.database || this.signingIn())return false;
  this.signingIn.set(true);
  try{await this.database.resetPassword(email,location.origin+location.pathname);return true;}catch(e){this.error.set(this.message(e));return false;}finally{this.signingIn.set(false);}
 }
 async updatePassword(password:string):Promise<boolean>{
  if(!this.database || this.signingIn())return false;
  this.signingIn.set(true);
  try{await this.database.updatePassword(password);this.passwordRecovery.set(false);return true;}catch(e){this.error.set(this.message(e));return false;}finally{this.signingIn.set(false);}
 }
 async save(data:Data,recovery=false,expectedRevision=this.revision()):Promise<boolean>{
  if(!this.canEdit()){this.error.set('Only the administrator can change the shared records.');return false;}
  if(this.saving())return false;
  this.saving.set(true);this.generation++;
  try{
   data=withPaymentDefaults({...data,payments:data.payments??this.data().payments});
   validateData(data);
   if(this.mode()==='local'){
    if(this.blocked && !recovery)throw new Error('Restore a valid backup before saving changes.');
    assertRevision(this.revision(),expectedRevision);
    if(localStorage.getItem(KEY)!==this.localRaw)throw new Error('Local records changed in another tab. Reload this page before saving.');
    const raw=JSON.stringify(data);localStorage.setItem(KEY,raw);this.localRaw=raw;this.data.set(data);this.blocked=false;this.revision.update(n=>n+1);
   }else{
    if(!navigator.onLine)throw new Error('You are offline. Reconnect before saving; your form is still here.');
    const record=await this.database!.save(data,expectedRevision);this.data.set(withPaymentDefaults(record.data));this.revision.set(record.revision);this.connection.set('Saved online');
   }
   this.error.set('');return true;
  }catch(e){this.error.set(this.message(e));return false;}finally{this.saving.set(false);}
 }
 raw(){return this.mode()==='local' && this.blocked?(localStorage.getItem(KEY)??JSON.stringify(this.data())):JSON.stringify(this.data());}
 private message(e:unknown):string{
  const error=e as {name?:string;code?:string;message?:string};
  if(error.code==='invalid_credentials')return 'The email or password is incorrect.';
  if(error.code==='email_not_confirmed')return 'Confirm your email using the link in your inbox, then sign in.';
  if(error.code==='42501')return 'Only the verified organizer account may change these records.';
  if(error.name==='QuotaExceededError')return 'Browser storage is full. Download a backup before clearing storage.';
  if(e instanceof TypeError || ['TimeoutError','AbortError','AuthRetryableFetchError'].includes(error.name || ''))return 'The database could not be reached. Check your connection and try again. If it was paused by the free host, resume it in Supabase. Your form is still here.';
  return typeof error.message==='string'?error.message:'The operation could not be completed.';
 }
}
