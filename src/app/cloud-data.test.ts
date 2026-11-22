import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoData,emptyData} from './domain.ts';
import {encodeData,decodeRecord,assertRevision} from './cloud-data.ts';

test('valid cloud envelopes round-trip with revision intact',()=>{const data=demoData();assert.deepEqual(decodeRecord({payload:encodeData(data),revision:7}),{data,revision:7});});
test('invalid payloads and revisions fail without exposing a partial dataset',()=>{
 for(const bad of [null,{payload:'{}',revision:1},{payload:'bad JSON',revision:1},{payload:encodeData(emptyData()),revision:0},{payload:encodeData(emptyData()),revision:1.5}])assert.throws(()=>decodeRecord(bad));
});
test('stale drafts cannot overwrite newer records',()=>{assert.doesNotThrow(()=>assertRevision(3,3));assert.throws(()=>assertRevision(4,3),/another tab or device/);assert.throws(()=>assertRevision(1,0));});
test('oversized multibyte data is rejected before cloud writes',()=>{
 const data=emptyData();for(let i=0;i<1000;i++)data.players.push({id:String(i),name:'Player '+i,position:'Any position',active:true,notes:'⚽'.repeat(400)});
 assert.throws(()=>encodeData(data),/800 KB/);
});
