import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData, playerStats, validateData } from './domain.ts';
import type { Data, Match, Player } from './domain.ts';
const players:Player[] = ['Alex','Sam','Riley'].map((name,i)=>({id:String(i),name,position:'Any position',notes:'',active:true}));
const match=(id:string,date:string,aIds:string[],bIds:string[],aScore:number,bScore:number):Match=>({id,date,venue:'',notes:'',a:{name:'Green',score:aScore,players:aIds.map(playerId=>({playerId,goals:0,assists:0}))},b:{name:'Orange',score:bScore,players:bIds.map(playerId=>({playerId,goals:0,assists:0}))}});
const season=():Data=>({version:1,players:structuredClone(players),matches:[match('1','2026-01-01',['0'],['1'],2,0),match('2','2026-01-08',['1'],['0'],0,1),match('3','2026-01-15',['1'],['2'],1,0),match('4','2026-01-22',['0'],['1'],2,2),match('5','2026-01-29',['1'],['0'],3,0),match('6','2026-02-05',['0'],['2'],1,0)]});
test('counts results across changing teams, skips absences, and computes streaks chronologically',()=>{
 const d=season();d.matches.reverse();validateData(d);const s=playerStats(d)[0];
 assert.equal(s.played,5);assert.equal(s.wins,3);assert.equal(s.draws,1);assert.equal(s.losses,1);assert.equal(s.winRate,60);assert.equal(s.attendance,83);assert.equal(s.bestWinStreak,2);assert.equal(s.currentWinStreak,1);assert.equal(s.goalDifference,1);assert.deepEqual(s.form,['W','W','D','L','W']);
});
test('absence preserves current streak, draw and loss reset it',()=>{
 const d=season();d.matches=d.matches.slice(0,3);assert.equal(playerStats(d)[0].currentWinStreak,2);
 d.matches.push(season().matches[3]);assert.equal(playerStats(d)[0].currentWinStreak,0);
 d.matches.push(season().matches[4]);assert.equal(playerStats(d)[0].currentWinStreak,0);
});
test('editing and deleting past results recalculates totals and best streak',()=>{
 const d=season();d.matches[3].a.score=3;d.matches[4].b.score=4;const edited=playerStats(d)[0];assert.equal(edited.wins,5);assert.equal(edited.bestWinStreak,5);
 d.matches.splice(0,1);const removed=playerStats(d)[0];assert.equal(removed.wins,4);assert.equal(removed.bestWinStreak,4);assert.equal(removed.winRate,100);
});
test('unplayed and archived players remain safe and retain history',()=>{
 const d=season();d.players[0].active=false;d.players.push({...players[0],id:'new',name:'New'});const s=playerStats(d);assert.equal(s[0].played,5);assert.equal(s[3].played,0);assert.equal(s[3].winRate,0);assert.equal(s[3].bestWinStreak,0);
});
test('rejects duplicate lineup members, unknown players, and empty teams',()=>{
 for(const change of [(d:Data)=>d.matches[0].b.players.push({...d.matches[0].a.players[0]}),(d:Data)=>d.matches[0].a.players[0].playerId='missing',(d:Data)=>d.matches[0].b.players=[]]){const d=season();change(d);assert.throws(()=>validateData(d));}
});
test('rejects invalid scores, excessive contributions, impossible and future dates',()=>{
 for(const change of [(d:Data)=>d.matches[0].a.score=-1,(d:Data)=>d.matches[0].a.score=1.5,(d:Data)=>d.matches[0].a.players[0].goals=3,(d:Data)=>d.matches[0].a.players[0].assists=3,(d:Data)=>d.matches[0].date='2026-02-30',(d:Data)=>d.matches[0].date='2999-01-01']){const d=season();change(d);assert.throws(()=>validateData(d));}
});
test('validates backup schema and duplicate IDs',()=>{assert.throws(()=>validateData({version:2,players:[],matches:[]}));assert.throws(()=>validateData(null));const d=season();d.players.push(d.players[0]);assert.throws(()=>validateData(d));});
test('sample data and JSON round trip remain valid',()=>{const d=demoData();validateData(d);const roundTrip=JSON.parse(JSON.stringify(d));validateData(roundTrip);assert.deepEqual(playerStats(roundTrip),playerStats(d));});
