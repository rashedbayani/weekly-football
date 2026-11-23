import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialPayments,paymentTotals,validatePayments} from './payments.ts';
import {emptyData,validateData,withPaymentDefaults} from './domain.ts';
import {decodeRecord,encodeData} from './cloud-data.ts';

test('imported workbook reconciles by week, player and cash',()=>{
 const ledger=createInitialPayments();validatePayments(ledger);const t=paymentTotals(ledger);
 assert.equal(ledger.members.length,17);assert.equal(ledger.weeks.length,25);
 assert.deepEqual(ledger.weeks.slice(0,9).map(w=>t.rows[w.id]),[1800,1950,1650,1800,1800,1800,1800,2100,1800]);
 assert.equal(t.charged,16500);assert.equal(t.paid,30050);assert.equal(t.balance,13550);assert.equal(t.cash,-9950);
 assert.equal(t.members['member-1'].balance,750);assert.equal(t.members['member-2'].balance,-150);assert.equal(t.members['member-11'].balance,0);
});
test('later weeks, added weeks and paid amounts recalculate every dependent total',()=>{
 const ledger=createInitialPayments();ledger.weeks[24].amounts['member-1']=150;
 ledger.weeks.push({id:'new-week',date:'۲۹ اسفند',amounts:Object.fromEntries(ledger.members.map(m=>[m.id,m.id==='member-1'?75:null]))});
 ledger.members[0].paid=1750;ledger.venuePaid=39000;validatePayments(ledger);
 const t=paymentTotals(ledger);assert.equal(t.members['member-1'].balance,625);assert.equal(t.charged,16725);assert.equal(t.paid,30150);assert.equal(t.cash,-8850);
});
test('blank entries remain distinct from zeros through cloud and backup round trips',()=>{
 const d=withPaymentDefaults(emptyData()),ledger=d.payments!;
 assert.equal(ledger.weeks[9].amounts['member-1'],null);assert.equal(ledger.weeks[0].amounts['member-8'],0);
 const roundTrip=decodeRecord({payload:encodeData(d),revision:8}).data;assert.deepEqual(roundTrip,d);
 ledger.venuePaid=null;assert.equal(paymentTotals(ledger).cash,null);
});
test('decimals sum exactly and balances may be negative',()=>{
 const ledger={unit:'هزار تومان',members:[{id:'a',name:'A',paid:0.3}],weeks:[{id:'w1',date:'One',amounts:{a:0.1}},{id:'w2',date:'Two',amounts:{a:0.2}}],venuePaid:0.4};
 validatePayments(ledger);const t=paymentTotals(ledger);assert.equal(t.balance,0);assert.equal(t.cash,-0.1);assert.equal(t.charged,0.3);
});
test('rejects malformed amounts, duplicate identities and mismatched member columns',()=>{
 for(const invalid of [-1,Infinity,NaN,0.123,'150',undefined,1_000_000_001]){const l=createInitialPayments();l.weeks[0].amounts['member-1']=invalid as number;assert.throws(()=>validatePayments(l));}
 for(const mutate of [(l:ReturnType<typeof createInitialPayments>)=>{l.members.push(l.members[0]);},(l:ReturnType<typeof createInitialPayments>)=>{l.members[1].name=l.members[0].name;},(l:ReturnType<typeof createInitialPayments>)=>{delete l.weeks[0].amounts['member-1'];},(l:ReturnType<typeof createInitialPayments>)=>{l.weeks[0].amounts['unknown']=5;},(l:ReturnType<typeof createInitialPayments>)=>{l.weeks[0].date='';}]){const l=createInitialPayments();mutate(l);assert.throws(()=>validateData({...emptyData(),payments:l}));}
});
test('legacy records gain an independent starting ledger without changing football records',()=>{
 const old=emptyData();validateData(old);const hydrated=withPaymentDefaults(old);assert.deepEqual(hydrated.players,old.players);assert.deepEqual(hydrated.matches,old.matches);
 hydrated.payments!.members[0].paid=1;assert.equal(withPaymentDefaults(emptyData()).payments!.members[0].paid,1650);
 assert.equal(withPaymentDefaults(hydrated).payments!.members[0].paid,1);
});
