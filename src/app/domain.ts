import {createInitialPayments,validatePayments} from './payments.ts';
import type {PaymentLedger} from './payments.ts';
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any position'] as const;
export interface Player { id: string; name: string; position: string; notes: string; active: boolean; }
export interface Appearance { playerId: string; goals: number; assists: number; }
export interface Team { name: string; score: number; players: Appearance[]; }
export interface Match { id: string; date: string; venue: string; notes: string; a: Team; b: Team; }
export interface Data { version: 1; players: Player[]; matches: Match[]; payments?:PaymentLedger; }
export function withPaymentDefaults(data:Data):Data {return {...data,payments:data.payments??createInitialPayments()};}
export interface Stats { player: Player; played: number; wins: number; draws: number; losses: number; goals: number; assists: number; goalDifference: number; winRate: number; attendance: number; currentWinStreak: number; bestWinStreak: number; form: string[]; }
export const emptyData = (): Data => ({ version: 1, players: [], matches: [] });
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const integer = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 999;
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
export function validateData(value: unknown): asserts value is Data {
 const d = value as Data;
 if (!d || d.version !== 1 || !Array.isArray(d.players) || !Array.isArray(d.matches)) throw new Error('This is not a supported Touchline backup.');
 if (d.players.length > 2000 || d.matches.length > 10000) throw new Error('This backup exceeds the supported size.');
 if(d.payments!==undefined)validatePayments(d.payments);
 const ids = new Set<string>();
 for (const p of d.players) {
  if (!p || !text(p.id,100,true) || ids.has(p.id) || !text(p.name,60,true) || !POSITIONS.includes(p.position as typeof POSITIONS[number]) || !text(p.notes,500) || typeof p.active !== 'boolean') throw new Error('A player record is invalid or duplicated.');
  ids.add(p.id);
 }
 const matchIds = new Set<string>();
 for (const m of d.matches) {
  if (!m || !text(m.id,100,true) || matchIds.has(m.id) || !text(m.date,10,true) || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !Number.isFinite(Date.parse(m.date+'T12:00:00Z')) || new Date(m.date+'T12:00:00Z').toISOString().slice(0,10) !== m.date || m.date > today() || !text(m.venue,100) || !text(m.notes,1000)) throw new Error('Check the match date and details. Results cannot be dated in the future.');
  matchIds.add(m.id);
  const selected = new Set<string>();
  for (const team of [m.a,m.b]) {
   if (!team || !text(team.name,40,true) || !integer(team.score) || !Array.isArray(team.players) || team.players.length < 1) throw new Error('Each team needs a name, a valid score, and at least one player.');
   let goals = 0, assists = 0;
   for (const p of team.players) {
    if (!p || !ids.has(p.playerId) || selected.has(p.playerId) || !integer(p.goals) || !integer(p.assists)) throw new Error('Players must exist, appear on only one team, and have non-negative whole-number stats.');
    selected.add(p.playerId); goals += p.goals; assists += p.assists;
   }
   if (goals > team.score || assists > team.score) throw new Error('Recorded player goals and assists cannot exceed their team’s score. Leave untracked goals unassigned.');
  }
  if (m.a.name.trim().toLowerCase() === m.b.name.trim().toLowerCase()) throw new Error('Give the two teams different names.');
 }
}
export function playerStats(data: Data): Stats[] {
 const matches = [...data.matches].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
 return data.players.map(player => {
  const s: Stats = { player, played:0, wins:0, draws:0, losses:0, goals:0, assists:0, goalDifference:0, winRate:0, attendance:0, currentWinStreak:0, bestWinStreak:0, form:[] };
  for (const m of matches) {
   const inA = m.a.players.find(p => p.playerId === player.id);
   const appearance = inA ?? m.b.players.find(p => p.playerId === player.id);
   if (!appearance) continue;
   const own = inA ? m.a : m.b, opponent = inA ? m.b : m.a;
   s.played++; s.goals += appearance.goals; s.assists += appearance.assists; s.goalDifference += own.score - opponent.score;
   const result = own.score > opponent.score ? 'W' : own.score === opponent.score ? 'D' : 'L';
   if (result === 'W') s.wins++; else if (result === 'D') s.draws++; else s.losses++;
   s.currentWinStreak = result === 'W' ? s.currentWinStreak + 1 : 0;
   s.bestWinStreak = Math.max(s.bestWinStreak,s.currentWinStreak);
   s.form.push(result);
  }
  s.winRate = s.played ? Math.round(s.wins / s.played * 100) : 0;
  s.attendance = matches.length ? Math.round(s.played / matches.length * 100) : 0;
  s.form = s.form.slice(-5); return s;
 });
}
export function demoData(): Data {
 const names = ['Alex Morgan','Sam Wilson','Jamie Parker','Jordan Lee','Riley Davis','Charlie King','Taylor Reed','Casey Brooks','Morgan Ellis','Drew Hayes'];
 const players = names.map((name,i): Player => ({id:`demo-p${i}`,name,position:POSITIONS[i%5],notes:'',active:true}));
 const matches = Array.from({length:6},(_,i): Match => {
  const date = new Date(); date.setDate(date.getDate() - (5-i)*7 - 1);
  const roster = players.map((p,j) => ({playerId:p.id,goals:j === i%5 ? 2:0,assists:0}));
  const a = roster.filter((_,j) => (j+i)%2===0), b = roster.filter((_,j) => (j+i)%2!==0);
  const scoreA = [4,2,3,5,2,4][i], scoreB = [2,2,4,3,1,3][i];
  a.forEach((p,j) => {p.goals=j===0?2:0; p.assists=j===1?1:0;}); b.forEach((p,j) => {p.goals=j===0?1:0; p.assists=j===1?1:0;});
  return {id:`demo-m${i}`, date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,venue:'Riverside pitch',notes:i===5?'A close one right to the final whistle.':'',a:{name:'Forest FC',score:scoreA,players:a},b:{name:'Sunset United',score:scoreB,players:b}};
 });
 return {version:1,players,matches};
}
