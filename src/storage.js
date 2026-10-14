const NS='btc4h-breakout-v1.3.0-REGIME';
const inMemory=new Map();
function read(key){
 try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return inMemory.get(key)||null;}
}
function write(key,val){
 try{localStorage.setItem(key,JSON.stringify(val));}catch{inMemory.set(key,val);}
}
export function getFrozen(date){return read(`${NS}:freeze:${date}`);}
export function storeFrozen(date,snapshot){
 const key=`${NS}:freeze:${date}`,old=read(key);
 // Immutable, even if market data subsequently changes.
 if(old)return old;
 const record={...snapshot,storedAt:Date.now()};write(key,record);return record;
}
export function getSettlement(date){return read(`${NS}:settle:${date}`);}
export function storeSettlement(date,result){
 const key=`${NS}:settle:${date}`,old=read(key);
 if(old)return old;
 write(key,result);return result;
}
export function recentFrozenDates(){
 const result=[];
 try{for(let i=0;i<localStorage.length;i++){
  const k=localStorage.key(i);if(k?.startsWith(`${NS}:freeze:`))result.push(k.split(':').at(-1));
 }}catch{};
 return result.sort().reverse().slice(0,15);
}
