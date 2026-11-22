import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Data, demoData, Match, Player, playerStats, POSITIONS, Stats, today, validateData } from './domain';
import { Store } from './store';
type Page = 'Overview' | 'Matches' | 'Players' | 'Insights' | 'Backup & data';
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.html'})
export class App {
 readonly store = inject(Store);
 readonly data = this.store.data;
 readonly stats = computed(() => playerStats(this.data()));
 readonly matches = computed(() => [...this.data().matches].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));
 readonly totalGoals = computed(() => this.data().matches.reduce((n,m) => n+m.a.score+m.b.score,0));
 readonly leaders = computed(() => [...this.stats()].filter(p=>p.played).sort((a,b)=>b.wins-a.wins || b.goals-a.goals).slice(0,5));
 get pages():Page[]{return this.store.canEdit()?['Overview','Matches','Players','Insights','Backup & data']:['Overview','Matches','Players','Insights'];}
 readonly positions = POSITIONS;
 page = signal<Page>('Overview');
 search = ''; matchSearch = ''; sort = 'wins'; minGames = 1; showArchived = false;
 notice = signal(''); formError = ''; modal: 'player'|'match'|'profile'|'matchView'|'login'|null = null;
 adminToken='';
 private draftRevision=0; private importRevision=0;
 playerDraft: Player = this.blankPlayer(); matchDraft: Match = this.blankMatch();
 assignments: Record<string,string> = {}; goals: Record<string,number> = {}; assists: Record<string,number> = {};
 profileId = ''; pendingImport: Data|null = null;
 @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
 blankPlayer(): Player { return {id:crypto.randomUUID(),name:'',position:'Any position',notes:'',active:true}; }
 blankMatch(): Match { return {id:crypto.randomUUID(),date:today(),venue:'',notes:'',a:{name:'Team Green',score:0,players:[]},b:{name:'Team Orange',score:0,players:[]}}; }
 navigate(page: Page) { this.page.set(page); this.search = ''; this.notice.set(''); window.scrollTo({top:0}); }
 initials(name: string) { return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(); }
 name(id: string) { return this.data().players.find(p=>p.id===id)?.name ?? 'Unknown player'; }
 get filteredPlayers() { return this.stats().filter(s=>(this.showArchived || s.player.active) && s.player.name.toLowerCase().includes(this.search.toLowerCase())); }
 get filteredMatches() { const q=this.matchSearch.toLowerCase(); return this.matches().filter(m=>`${m.a.name} ${m.b.name} ${m.venue} ${m.date} ${[...m.a.players,...m.b.players].map(p=>this.name(p.playerId)).join(' ')}`.toLowerCase().includes(q)); }
 get ranked() { const key = this.sort as 'wins'|'goals'|'assists'|'winRate'|'played'|'currentWinStreak'|'bestWinStreak'; return [...this.stats()].filter(s=>s.played>=this.minGames && s.player.name.toLowerCase().includes(this.search.toLowerCase())).sort((a,b)=>b[key]-a[key] || b.played-a.played || a.player.name.localeCompare(b.player.name)); }
 get chartPlayers() { return this.ranked.slice(0,6); }
 get trendMatches() {return this.matches().slice(0,8).reverse();}
 get maxMatchGoals() {return Math.max(1,...this.trendMatches.map(m=>m.a.score+m.b.score));}
 get bestStreak() {return [...this.stats()].sort((a,b)=>b.bestWinStreak-a.bestWinStreak)[0];}
 get profile(): Stats|undefined { return this.stats().find(s=>s.player.id===this.profileId); }
 get profileMatches() { return this.matches().filter(m=>[...m.a.players,...m.b.players].some(p=>p.playerId===this.profileId)); }
 get selectablePlayers() { return this.data().players.filter(p=>p.active || this.assignments[p.id]); }
 count(side:string) { return Object.values(this.assignments).filter(v=>v===side).length; }
 open(type:'player'|'match'|'profile'|'matchView'|'login') { this.formError=''; this.modal=type; this.dialog.nativeElement.showModal(); }
 close() { this.adminToken=''; this.dialog.nativeElement.close(); this.modal=null; }
 editPlayer(player?:Player) { if(!this.store.canEdit())return;this.draftRevision=this.store.revision();this.playerDraft=player?structuredClone(player):this.blankPlayer(); this.open('player'); }
 async savePlayer() {
  if(!this.store.canEdit() || this.store.saving())return;
  const p={...this.playerDraft,name:this.playerDraft.name.trim()};
  if (!p.name) { this.formError='Enter a player name.'; return; }
  if (this.data().players.some(x=>x.id!==p.id && x.name.toLowerCase()===p.name.toLowerCase())) {this.formError='That name already exists. Add a surname or nickname to tell players apart.';return;}
  const players=this.data().players.some(x=>x.id===p.id)?this.data().players.map(x=>x.id===p.id?p:x):[...this.data().players,p];
  if(await this.store.save({...this.data(),players},false,this.draftRevision)) { this.close(); this.notice.set(`${p.name} saved.`); } else this.formError=this.store.error();
 }
 async archive(player:Player) { if(await this.store.save({...this.data(),players:this.data().players.map(p=>p.id===player.id?{...p,active:!p.active}:p)})) this.notice.set(player.active?'Player archived. Their match history is preserved.':'Player restored to the active squad.'); }
 editMatch(match?:Match) {
  if(!this.store.canEdit()){if(match){this.matchDraft=structuredClone(match);this.open('matchView');}return;}
  this.draftRevision=this.store.revision();
  this.matchDraft=match?structuredClone(match):this.blankMatch(); this.assignments={};this.goals={};this.assists={};
  for(const side of ['a','b'] as const) for(const p of this.matchDraft[side].players) {this.assignments[p.playerId]=side;this.goals[p.playerId]=p.goals;this.assists[p.playerId]=p.assists;}
  this.open('match');
 }
 async saveMatch() {
  if(!this.store.canEdit() || this.store.saving())return;
  const m=structuredClone(this.matchDraft);
  for(const side of ['a','b'] as const) m[side].players=this.data().players.filter(p=>this.assignments[p.id]===side).map(p=>({playerId:p.id,goals:this.goals[p.id] ?? 0,assists:this.assists[p.id] ?? 0}));
  const matches=this.data().matches.some(x=>x.id===m.id)?this.data().matches.map(x=>x.id===m.id?m:x):[...this.data().matches,m];
  if(await this.store.save({...this.data(),matches},false,this.draftRevision)) {this.close();this.notice.set('Match saved. Player insights are up to date.');} else this.formError=this.store.error();
 }
 async deleteMatch(m:Match) { if(!this.store.canEdit() || this.store.saving())return;if(confirm(`Delete ${m.a.name} vs ${m.b.name} on ${m.date}? This removes the result from every player’s stats.`) && await this.store.save({...this.data(),matches:this.data().matches.filter(x=>x.id!==m.id)},false,this.draftRevision)) {this.close();this.notice.set('Match deleted.');}else this.formError=this.store.error(); }
 showProfile(id:string) {this.profileId=id;this.open('profile');}
 result(m:Match,id:string) {const isA=m.a.players.some(p=>p.playerId===id); const diff=isA?m.a.score-m.b.score:m.b.score-m.a.score;return diff>0?'W':diff<0?'L':'D';}
 exportData() {try {const blob=new Blob([this.store.raw()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`touchline-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.notice.set('Backup downloaded. Keep it somewhere safe.');}catch{this.notice.set('Browser storage could not be read.');} }
 async importData(event:Event) {
  if(!this.store.canEdit())return;this.importRevision=this.store.revision();
  const input=event.target as HTMLInputElement;const file=input.files?.[0];this.pendingImport=null;if(!file)return;
  try {if(file.size>10_000_000)throw new Error('Choose a backup smaller than 10 MB.');const value:unknown=JSON.parse(await file.text());validateData(value);this.pendingImport=value;this.notice.set('Backup validated. Review the counts below before restoring.');}
  catch(e) {this.notice.set(e instanceof SyntaxError?'This file is not valid JSON.':e instanceof Error?e.message:'Could not read this backup.');}finally{input.value='';}
 }
 async restore() {if(this.pendingImport && await this.store.save(this.pendingImport,true,this.importRevision)){this.pendingImport=null;this.notice.set('Backup restored successfully.');}}
 async loadDemo() {if(this.store.mode()==='local' && !this.data().players.length && !this.data().matches.length && await this.store.save(demoData()))this.notice.set('Sample season loaded. You can remove it in Backup & data.');}
 async clearDemo() {if(!this.data().players.every(p=>p.id.startsWith('demo-')) || !this.data().matches.every(m=>m.id.startsWith('demo-'))) {this.notice.set('Your own records are present, so sample data cannot be cleared automatically.');return;}if(confirm('Remove the sample season?') && await this.store.save({version:1,players:[],matches:[]}))this.notice.set('Sample season removed. Ready for your players.');}
 async login(){const token=this.adminToken;this.adminToken='';if(await this.store.signIn(token)){this.close();this.notice.set('Administrator access enabled for this tab.');}else this.formError=this.store.error();}
 async signOut(){this.pendingImport=null;this.page.set('Overview');await this.store.signOut();}
 async share(){try{await navigator.clipboard.writeText(location.origin+location.pathname);this.notice.set('View-only link copied. Your friends can open it without signing in.');}catch{this.notice.set('Share this address: '+location.origin+location.pathname);}}
 get onlyDemo() {return this.data().players.length>0 && this.data().players.every(p=>p.id.startsWith('demo-')) && this.data().matches.every(m=>m.id.startsWith('demo-'));}
 get editingExistingMatch() {return this.data().matches.some(m=>m.id===this.matchDraft.id);}
 readonly maxDate=today();
}
