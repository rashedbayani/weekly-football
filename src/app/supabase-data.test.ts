import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseData,validateSupabaseConfig} from './supabase-data.ts';
import {emptyData,demoData} from './domain.ts';
const config={url:'https://stdegteinpejtvsfgjbk.supabase.co',publishableKey:'sb_publishable_test'};
test('configuration rejects secret keys and arbitrary credential destinations',()=>{
 for(const bad of [{...config,url:'https://evil.example'},{...config,url:config.url+'.evil.example'},{...config,publishableKey:'sb_secret_bad'}])assert.throws(()=>validateSupabaseConfig(bad));
 assert.doesNotThrow(()=>validateSupabaseConfig(config));
});
test('another email cannot attempt administrator login or password reset',async()=>{
 const db=new SupabaseData(config);
 await assert.rejects(db.signIn('friend@example.com','anything'),/organizer/);
 await assert.rejects(db.resetPassword('friend@example.com','https://example.com'),/organizer/);
 await assert.rejects(db.updatePassword('short'),/12 characters/);
});
test('anonymous readers do not acquire administrator identity',async()=>{
 const db=new SupabaseData(config);assert.equal(await db.identity(),null);
});
test('save submits an atomic revision condition and accepts server revision',async(t)=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const data=demoData();data.players[0].name='راشد';
 t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{calls.push({url:String(url),init});return Response.json([{payload:JSON.stringify(data),revision:8}]);});
 const db=new SupabaseData(config),result=await db.save(data,7);
 assert.equal(result.revision,8);assert.deepEqual(result.data,data);
 assert.equal(calls.length,1);const call=calls[0],url=new URL(call.url);
 assert.equal(call.init.method,'PATCH');assert.equal(url.searchParams.get('revision'),'eq.7');assert.equal(url.searchParams.get('id'),'eq.1');
 assert.deepEqual(Object.keys(JSON.parse(String(call.init.body))),['payload']);
});
test('stale updates fail without claiming a save or retrying',async(t)=>{
 let count=0;t.mock.method(globalThis,'fetch',async()=>{count++;return Response.json([]);});
 await assert.rejects(new SupabaseData(config).save(emptyData(),2),/changed.*expired/);assert.equal(count,1);
});
test('database access denials and invalid payloads cannot report success',async(t)=>{
 let count=0;t.mock.method(globalThis,'fetch',async()=>{count++;return Response.json({message:'permission denied',code:'42501'},{status:403});});
 const db=new SupabaseData(config);
 await assert.rejects(db.save(emptyData(),1),{code:'42501'});
 const data=demoData();data.matches[0].a.score=-1;await assert.rejects(db.save(data,1));assert.equal(count,1);
});
