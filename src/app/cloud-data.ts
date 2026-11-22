import { validateData } from './domain.ts';
import type { Data } from './domain.ts';
export const MAX_CLOUD_BYTES = 800_000;
export interface CloudRecord { payload: string; revision: number; }

export function encodeData(data: Data): string {
 validateData(data);
 const payload=JSON.stringify(data);
 if(new TextEncoder().encode(payload).length>MAX_CLOUD_BYTES) throw new Error('This season is too large for one cloud record (800 KB). Download a backup before starting a new season.');
 return payload;
}
export function decodeRecord(value: unknown): {data:Data;revision:number} {
 const record=value as CloudRecord;
 if(!record || typeof record.payload!=='string' || !Number.isSafeInteger(record.revision) || record.revision<1) throw new Error('The saved online records could not be read. No data was overwritten.');
 const data:unknown=JSON.parse(record.payload);validateData(data);
 return {data,revision:record.revision};
}
export function assertRevision(actual:number,expected:number):void {
 if(actual!==expected) throw new Error('These records changed in another tab or device. Close this form and reopen it to use the latest data. Your changes have not overwritten anything.');
}
