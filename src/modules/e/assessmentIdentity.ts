export function stableValue(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(stableValue).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stableValue(v)).join(',')+'}';
  return JSON.stringify(value)??'null';
}
export async function shaValue(value:unknown):Promise<string>{
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableValue(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
