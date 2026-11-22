import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GithubData,toBase64,fromBase64,validateGithubConfig} from './github-data.ts';
import {demoData,emptyData} from './domain.ts';
const config={owner:'rashedbayani',repository:'weekly-football',ownerId:82253861,branch:'main',path:'docs/data/season.json'};
const sha='a'.repeat(40),nextSha='b'.repeat(40);
const file=(revision=1,hash=sha)=>({type:'file',encoding:'base64',sha:hash,content:toBase64(JSON.stringify({payload:JSON.stringify(emptyData()),revision}))});
function mock(replies:unknown[]){
 const calls:{url:string;init:RequestInit}[]=[];
 const transport=(async(url:string|URL|Request,init:RequestInit={})=>{calls.push({url:String(url),init});const reply=replies.shift();if(reply===undefined)throw new Error('Unexpected request');return reply instanceof Response?reply:Response.json(reply);}) as typeof fetch;
 return {transport,calls};
}
const owner={id:config.ownerId},repo={owner,permissions:{push:true}};
test('Unicode names and notes survive GitHub encoding',()=>{const value='راشد ⚽ José \\ "hello"';assert.equal(fromBase64(toBase64(value)),value);});
test('invalid config cannot redirect credentials to another host',()=>{assert.throws(()=>validateGithubConfig({...config,owner:'evil.test/a'}));assert.throws(()=>validateGithubConfig({...config,path:'../token'}));});
test('anonymous writes and classic broad tokens never make network requests',async()=>{const m=mock([]),api=new GithubData(config,m.transport);await assert.rejects(api.save(emptyData(),1,sha),/Sign in/);await assert.rejects(api.signIn('ghp_broad'),/fine-grained/);assert.equal(m.calls.length,0);});
test('a different GitHub user cannot enter administrator mode',async()=>{const m=mock([{id:123}]),api=new GithubData(config,m.transport);await assert.rejects(api.signIn('github_pat_test'),/Only the owner/);await assert.rejects(api.read(),/Sign in/);assert.equal(m.calls.length,1);});
test('repository ownership and write permission are checked',async()=>{for(const denied of [{owner:{id:4},permissions:{push:true}},{owner,permissions:{push:false}}]){const m=mock([owner,denied]),api=new GithubData(config,m.transport);await assert.rejects(api.signIn('github_pat_test'),/does not own/);assert.equal(m.calls.length,2);}});
test('owner save uses the last SHA and increments revision, sending credentials only to GitHub',async()=>{
 const m=mock([owner,repo,file(),file(),{content:{sha:nextSha}}]),api=new GithubData(config,m.transport);await api.signIn('github_pat_test');
 const data=demoData();data.players[0].name='راشد';const result=await api.save(data,1,sha);
 assert.equal(result.revision,2);assert.equal(result.sha,nextSha);
 const write=m.calls.at(-1)!;assert.equal(write.init.method,'PUT');const body=JSON.parse(String(write.init.body));assert.equal(body.sha,sha);assert.equal(body.branch,'main');assert.equal(JSON.parse(JSON.parse(fromBase64(body.content)).payload).players[0].name,'راشد');
 for(const call of m.calls){assert.equal(new URL(call.url).origin,'https://api.github.com');assert.equal(call.init.credentials,'omit');assert.equal(call.init.redirect,'error');}
 api.signOut();await assert.rejects(api.save(data,2,nextSha),/Sign in/);
});
test('stale revisions and changed file hashes never perform an update',async()=>{for(const remote of [file(2),file(1,nextSha)]){const m=mock([owner,repo,file(),remote]),api=new GithubData(config,m.transport);await api.signIn('github_pat_test');await assert.rejects(api.save(emptyData(),1,sha),/changed/);assert.ok(m.calls.every(c=>c.init.method!=='PUT'));}});
test('a racing GitHub update is reported as a conflict',async()=>{const m=mock([owner,repo,file(),file(),new Response('{}',{status:409})]),api=new GithubData(config,m.transport);await api.signIn('github_pat_test');await assert.rejects(api.save(emptyData(),1,sha),/another tab/);});
test('invalid match data is rejected before any write',async()=>{const m=mock([owner,repo,file()]),api=new GithubData(config,m.transport);await api.signIn('github_pat_test');const data=demoData();data.matches[0].a.score=-1;await assert.rejects(api.save(data,1,sha));assert.equal(m.calls.length,3);});
