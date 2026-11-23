import {Component,computed,effect,HostListener,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Store} from './store';
import {createInitialPayments,paymentTotals,validatePayments} from './payments';
import type {PaymentLedger} from './payments';

@Component({selector:'app-payments',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./payments-page.html',styleUrl:'./payments-page.css'})
export class PaymentsPage {
 readonly store=inject(Store);
 readonly draft=signal<PaymentLedger|null>(null);
 readonly ledger=computed(()=>this.draft()??this.store.data().payments??createInitialPayments());
 readonly totals=computed(()=>paymentTotals(this.ledger()));
 readonly message=signal('');
 readonly error=signal('');
 readonly dirty=computed(()=>!!this.draft() && JSON.stringify(this.draft())!==this.original);
 private original='';
 revision=0;
 constructor(){effect(()=>{if(this.store.mode()==='cloud' && !this.store.admin()){this.draft.set(null);}});}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.dirty()){event.preventDefault();event.returnValue='';}}
 edit(){if(!this.store.canEdit())return;this.revision=this.store.revision();this.original=JSON.stringify(this.ledger());this.draft.set(structuredClone(this.ledger()));this.message.set('');this.error.set('');}
 cancel(){if(this.store.saving())return;if(this.dirty() && !confirm('Discard your unsaved payment changes?'))return;this.draft.set(null);this.error.set('');}
 change(update:(draft:PaymentLedger)=>void){if(!this.store.canEdit() || this.store.saving() || !this.draft())return;const next=structuredClone(this.draft()!);update(next);this.draft.set(next);this.error.set('');}
 setAmount(weekId:string,memberId:string,value:number|null){this.change(d=>{d.weeks.find(w=>w.id===weekId)!.amounts[memberId]=value;});}
 setDate(id:string,date:string){this.change(d=>{d.weeks.find(w=>w.id===id)!.date=date;});}
 setName(id:string,name:string){this.change(d=>{d.members.find(m=>m.id===id)!.name=name;});}
 setPaid(id:string,value:number|null){this.change(d=>{d.members.find(m=>m.id===id)!.paid=value;});}
 setVenuePaid(value:number|null){this.change(d=>{d.venuePaid=value;});}
 addWeek(){const id=crypto.randomUUID();this.change(d=>{if(d.weeks.length>=500)return;d.weeks.push({id,date:'',amounts:Object.fromEntries(d.members.map(m=>[m.id,null]))});});setTimeout(()=>document.getElementById('payment-week-'+id)?.focus(),0);}
 addMember(){const id=crypto.randomUUID();this.change(d=>{if(d.members.length>=100)return;d.members.push({id,name:'',paid:null});for(const w of d.weeks)w.amounts[id]=null;});setTimeout(()=>document.getElementById('payment-member-'+id)?.focus(),0);}
 removeWeek(id:string){if(!this.store.canEdit() || this.store.saving())return;const w=this.ledger().weeks.find(w=>w.id===id);if(confirm('Remove '+(w?.date||'this week')+' and its amounts?'))this.change(d=>{d.weeks=d.weeks.filter(w=>w.id!==id);});}
 removeMember(id:string){if(!this.store.canEdit() || this.store.saving())return;const m=this.ledger().members.find(m=>m.id===id);if(confirm('Remove '+(m?.name||'this player')+' and all their payment entries?'))this.change(d=>{d.members=d.members.filter(m=>m.id!==id);for(const w of d.weeks)delete w.amounts[id];});}
 async save(){
  if(!this.store.canEdit() || this.store.saving() || !this.draft())return;
  const payments=structuredClone(this.draft()!);payments.members.forEach(m=>m.name=m.name.trim());payments.weeks.forEach(w=>w.date=w.date.trim());
  try{validatePayments(payments);}catch(e){this.error.set(e instanceof Error?e.message:'Check the payment table.');return;}
  if(await this.store.save({...this.store.data(),payments},false,this.revision)){this.draft.set(null);this.error.set('');this.message.set(this.store.mode()==='cloud'?'Payment table saved. Everyone can see the updated amounts.':'Payment table saved on this device.');}else this.error.set(this.store.error());
 }
 format(value:number|null){return value===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);}
}
