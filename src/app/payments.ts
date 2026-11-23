import {initialPayments} from './payments-seed.ts';
export interface PaymentMember {id:string;name:string;paid:number|null;}
export interface PaymentWeek {id:string;date:string;amounts:Record<string,number|null>;}
export interface PaymentLedger {unit:string;members:PaymentMember[];weeks:PaymentWeek[];venuePaid:number|null;}
export const createInitialPayments=():PaymentLedger=>structuredClone(initialPayments);
const id=(v:unknown):v is string=>typeof v==='string' && /^[a-zA-Z0-9-]{1,100}$/.test(v);
const text=(v:unknown,max:number)=>typeof v==='string' && !!v.trim() && v.length<=max;
const amount=(v:unknown)=>v===null || (typeof v==='number' && Number.isFinite(v) && v>=0 && v<=1_000_000_000 && Math.abs(v*100-Math.round(v*100))<0.00001);
export function validatePayments(value:unknown):asserts value is PaymentLedger {
 const p=value as PaymentLedger;
 if(!p || p.unit!=='هزار تومان' || !Array.isArray(p.members) || !Array.isArray(p.weeks) || p.members.length>100 || p.weeks.length>500 || !amount(p.venuePaid))throw new Error('The payment table is invalid. Use amounts in thousand tomans, up to two decimal places.');
 const ids=new Set<string>(),names=new Set<string>();
 for(const member of p.members){
  if(!member || !id(member.id) || ids.has(member.id) || !text(member.name,60) || names.has(member.name.trim().toLocaleLowerCase()) || !amount(member.paid))throw new Error('Check payment player names and paid amounts. Names must be unique; amounts must be non-negative with up to two decimals.');
  ids.add(member.id);names.add(member.name.trim().toLocaleLowerCase());
 }
 const weekIds=new Set<string>();
 for(const week of p.weeks){
  if(!week || !id(week.id) || weekIds.has(week.id) || !text(week.date,40) || !week.amounts || Array.isArray(week.amounts) || typeof week.amounts!=='object' || Object.keys(week.amounts).length!==ids.size || Object.entries(week.amounts).some(([key,value])=>!ids.has(key) || !amount(value)))throw new Error('Check each payment date and amount. Leave unknown amounts blank or enter a non-negative number with up to two decimals.');
  weekIds.add(week.id);
 }
}
const cents=(value:number|null)=>Math.round((value??0)*100);
export function paymentTotals(ledger:PaymentLedger){
 const rows:Record<string,number>={},members:Record<string,{charged:number;balance:number}>={};
 let chargeCents=0,paidCents=0;
 for(const week of ledger.weeks){const total=Object.values(week.amounts).reduce<number>((sum,value)=>sum+cents(value),0);rows[week.id]=total/100;chargeCents+=total;}
 for(const member of ledger.members){const charged=ledger.weeks.reduce((sum,week)=>sum+cents(week.amounts[member.id]),0);members[member.id]={charged:charged/100,balance:(cents(member.paid)-charged)/100};paidCents+=cents(member.paid);}
 return {rows,members,charged:chargeCents/100,paid:paidCents/100,balance:(paidCents-chargeCents)/100,cash:ledger.venuePaid===null?null:(paidCents-cents(ledger.venuePaid))/100};
}
