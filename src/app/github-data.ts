import { assertRevision,decodeRecord,encodeData } from './cloud-data.ts';
import type { Data } from './domain.ts';
export interface GithubConfig {owner:string;repository:string;ownerId:number;branch:string;path:string;}
export interface GithubRecord {data:Data;revision:number;sha:string;}
export function validateGithubConfig(config:GithubConfig):void{
 if(!config || !/^[a-z\d][a-z\d-]{0,38}$/i.test(config.owner) || !/^[\w.-]{1,100}$/.test(config.repository) || !Number.isSafeInteger(config.ownerId) || config.ownerId<1 || config.branch!=='main' || config.path!=='docs/data/season.json')throw new Error('The shared repository settings are incomplete.');
}
export function toBase64(text:string):string{let binary='';for(const byte of new TextEncoder().encode(text))binary+=String.fromCharCode(byte);return btoa(binary);}
export function fromBase64(text:string):string{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
export class GithubData {
 private token='';
 readonly config:GithubConfig;
 private transport:typeof fetch;
 constructor(config:GithubConfig,transport:typeof fetch=fetch){validateGithubConfig(config);this.config=config;this.transport=transport;}
 private get root(){return `https://api.github.com/repos/${this.config.owner}/${this.config.repository}`;}
 private get file(){return `${this.root}/contents/${this.config.path}`;}
 private async request(url:string,init:RequestInit={}){
  const response=await this.transport(url,{...init,cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${this.token}`,'X-GitHub-Api-Version':'2022-11-28',...init.headers}});
  if(!response.ok){
   if(response.status===409 || response.status===422)throw new Error('These records changed in another tab or device. Close this form and refresh the records before trying again.');
   if(response.status===401 || response.status===403)throw new Error('GitHub denied access. Check that your token is valid and has Contents: Read and write for this repository. A rate limit can also temporarily block requests.');
   if(response.status===404)throw new Error('The repository or records could not be accessed. Check the repository selected for your token.');
   throw new Error(`GitHub could not complete the request (${response.status}). Refresh the records to check whether your last save completed.`);
  }
  return response.json();
 }
 async signIn(token:string):Promise<GithubRecord>{
  this.token=token.trim();
  if(!this.token.startsWith('github_pat_')){this.token='';throw new Error('Use a fine-grained GitHub personal access token limited to this repository.');}
  try{
   const user=await this.request('https://api.github.com/user');
   if(user.id!==this.config.ownerId)throw new Error('Only the owner’s GitHub account can edit this season.');
   const repo=await this.request(this.root);
   if(repo.owner?.id!==this.config.ownerId || !repo.permissions?.push)throw new Error('This account does not own the shared repository.');
   return await this.read();
  }catch(e){this.signOut();throw e;}
 }
 signOut(){this.token='';}
 async read():Promise<GithubRecord>{
  if(!this.token)throw new Error('Sign in as administrator first.');
  const file=await this.request(`${this.file}?ref=${encodeURIComponent(this.config.branch)}`);
  if(file.type!=='file' || file.encoding!=='base64' || typeof file.content!=='string' || !/^[a-f0-9]{40,64}$/.test(file.sha))throw new Error('The online records could not be read. Nothing was overwritten.');
  return {...decodeRecord(JSON.parse(fromBase64(file.content))),sha:file.sha};
 }
 async save(data:Data,expectedRevision:number,sha:string):Promise<GithubRecord>{
  if(!this.token)throw new Error('Sign in as administrator first.');
  const payload=encodeData(data);
  const current=await this.read();assertRevision(current.revision,expectedRevision);
  if(current.sha!==sha)throw new Error('The online file changed. Refresh the records before trying again.');
  const revision=expectedRevision+1;
  const document=JSON.stringify({payload,revision});
  if(new TextEncoder().encode(document).length>950000)throw new Error('This season exceeds the online file size limit. Download a backup before starting a new season.');
  const result=await this.request(this.file,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update Touchline season',content:toBase64(document),sha,branch:this.config.branch})});
  if(!result.content?.sha)throw new Error('GitHub did not confirm this save. Refresh to check the latest records.');
  return {data,revision,sha:result.content.sha};
 }
}
