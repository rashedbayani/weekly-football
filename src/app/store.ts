import { computed, Injectable, signal } from '@angular/core';
import { Data, emptyData, validateData } from './domain';
import { assertRevision, decodeRecord, encodeData } from './cloud-data';
import { GithubData } from './github-data';
import type { GithubRecord } from './github-data';

const KEY='touchline.data.v1';
@Injectable({providedIn:'root'})
export class Store {
 readonly data=signal<Data>(emptyData());
 readonly error=signal('');
 readonly mode=signal<'loading'|'local'|'cloud'|'unconfigured'>('loading');
 readonly ready=signal(false);
 readonly saving=signal(false);
 readonly signingIn=signal(false);
 readonly admin=signal(false);
 readonly user=signal<{login:string}|null>(null);
 readonly revision=signal(0);
 readonly connection=signal('Connecting…');
 readonly canEdit=computed(()=>this.ready() && (this.mode()==='local' || this.admin()));
 readonly role=computed(()=>this.mode()==='local'?'Local notebook':this.admin()?'Administrator':'View only');
 private github?:GithubData;
 private sha='';
 private generation=0;
 private refreshing=false;
 private blocked=false;
 private localRaw:string|null=null;
 constructor(){void this.initialize();}
 private async initialize(){
  try {
   const response=await fetch(new URL('cloud-config.json',document.baseURI),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('The app configuration could not be loaded.');
   const config=await response.json();
   if(!config.enabled){
    if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw new Error('Online sharing has not been configured. Editing is disabled until setup is complete.');
    this.mode.set('local');this.loadLocal();return;
   }
   this.github=new GithubData(config.github);this.mode.set('cloud');await this.refresh();
   setInterval(()=>{if(!document.hidden)void this.refresh();},60000);
   window.addEventListener('online',()=>void this.refresh());
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.refresh();});
  }catch(e){this.mode.set('unconfigured');this.connection.set('Setup required');this.error.set(this.message(e));}
 }
 private loadLocal(){
  try{this.localRaw=localStorage.getItem(KEY);if(this.localRaw){const parsed:unknown=JSON.parse(this.localRaw);validateData(parsed);this.data.set(parsed);}}
  catch{this.blocked=true;this.error.set('Saved local data could not be read. Export it before restoring a valid backup. Existing storage has not been overwritten.');}
  this.ready.set(true);this.connection.set('Saved on this device');
 }
 private apply(record:GithubRecord){this.data.set(record.data);this.revision.set(record.revision);this.sha=record.sha;this.ready.set(true);}
 async refresh(){
  if(this.mode()!=='cloud' || this.refreshing || this.saving() || this.signingIn())return;
  this.refreshing=true;const generation=this.generation;
  try{
   if(this.admin()){
    const record=await this.github!.read();if(generation!==this.generation)return;this.apply(record);
   }else{
    const url=new URL('data/season.json',document.baseURI);url.searchParams.set('v',String(Date.now()));
    const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Shared records are temporarily unavailable. Please try Refresh records again.');
    const record=decodeRecord(await response.json());if(generation!==this.generation)return;
    if(record.revision>=this.revision()){this.data.set(record.data);this.revision.set(record.revision);}
    this.ready.set(true);
   }
   this.connection.set(this.admin()?'Saved online · public updates may take a few minutes':'Published records · refreshes every minute');this.error.set('');
  }catch(e){if(generation!==this.generation)return;this.ready.set(false);this.connection.set('Connection unavailable · retrying');this.error.set(this.message(e));}
  finally{this.refreshing=false;}
 }
 async signIn(token:string):Promise<boolean>{
  if(!this.github || this.signingIn())return false;
  this.signingIn.set(true);this.generation++;this.error.set('');
  try{
   const record=await this.github.signIn(token);this.apply(record);this.admin.set(true);this.user.set({login:this.github.config.owner});this.connection.set('Saved online · public updates may take a few minutes');return true;
  }catch(e){this.error.set(this.message(e));return false;}finally{this.signingIn.set(false);}
 }
 async signOut(){
  if(this.saving())return;this.generation++;this.github?.signOut();this.admin.set(false);this.user.set(null);this.sha='';this.ready.set(false);this.data.set(emptyData());this.revision.set(0);
  await this.refresh();
 }
 async save(data:Data,recovery=false,expectedRevision=this.revision()):Promise<boolean>{
  if(!this.canEdit()){this.error.set('Only the administrator can change the shared records.');return false;}
  if(this.saving())return false;
  this.saving.set(true);this.generation++;
  try{
   validateData(data);
   if(this.mode()==='local'){
    if(this.blocked && !recovery)throw new Error('Restore a valid backup before saving changes.');
    assertRevision(this.revision(),expectedRevision);
    if(localStorage.getItem(KEY)!==this.localRaw)throw new Error('Local records changed in another tab. Reload this page before saving.');
    const raw=JSON.stringify(data);localStorage.setItem(KEY,raw);this.localRaw=raw;this.data.set(data);this.blocked=false;this.revision.update(n=>n+1);
   }else{
    if(!navigator.onLine)throw new Error('You are offline. Reconnect before saving; your form is still here.');
    encodeData(data);
    this.apply(await this.github!.save(data,expectedRevision,this.sha));this.connection.set('Saved online · public updates may take a few minutes');
   }
   this.error.set('');return true;
  }catch(e){this.error.set(this.message(e));return false;}finally{this.saving.set(false);}
 }
 raw(){return this.mode()==='local'?(localStorage.getItem(KEY)??JSON.stringify(this.data())):JSON.stringify(this.data());}
 private message(e:unknown):string{
  if(e instanceof Error && e.name==='QuotaExceededError')return 'Browser storage is full. Download a backup before clearing storage.';
  if(e instanceof TypeError || (e instanceof Error && ['TimeoutError','AbortError'].includes(e.name)))return 'The online service could not be reached. Check your connection and refresh the records to check whether the last save completed. Your unsaved form is still here.';
  return e instanceof Error?e.message:'The operation could not be completed.';
 }
}
