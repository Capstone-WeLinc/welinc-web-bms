import { apiProblem } from '../../lib/api-shapes';
import { useEffect,useState } from 'react';
import { api } from '../../lib/api';
import { eventLabel,type EventCatalog,type AccountEvent } from '../../lib/account-activity';
type WorkEvent={id:string;action:string;userName:string;email:string;role?:string;createdAt:string;ipAddress?:string};
export default function ActivityLogs(){
  const [tab,setTab]=useState<'work'|'accounts'>('work');const [work,setWork]=useState<WorkEvent[]>([]);const [accounts,setAccounts]=useState<AccountEvent[]>([]);
  const [catalog,setCatalog]=useState<EventCatalog>();const [cursor,setCursor]=useState<string|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [search,setSearch]=useState('');const [category,setCategory]=useState('');const [type,setType]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');
  useEffect(()=>{void api.get<EventCatalog>('/auth/activity/catalog',{sessionCall:true}).then(res=>setCatalog(res.data)).catch(()=>{});},[]);
  const load=async(more=false)=>{setLoading(true);setError('');try{
    if(tab==='work'){const {data}=await api.get('/activity-logs');setWork(data.items);}
    else{const {data}=await api.get<{data:AccountEvent[];nextCursor:string|null}>('/auth/activity',{params:{limit:50,...(more&&cursor?{cursor}:{}),...(search.length>=2?{q:search}:{}),...(category?{category}:{}),...(type?{type}:{}),...(from?{from}:{}),...(to?{to}:{})}});setAccounts(old=>more?[...old,...data.data]:data.data);setCursor(data.nextCursor);}
  }catch(error:unknown){setError(apiProblem(error).code==='ADMIN_CODE_REQUIRED'?'Confirm your sign in in the portal to view account activity.':'Activity could not be loaded. Please retry.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[tab,category,type,from,to]);
  const rows=tab==='accounts'?accounts.map(event=>({id:event.id,action:eventLabel(catalog,event,true),userName:event.user?.name??'',email:event.user?.email??'',createdAt:event.at??event.createdAt??'',ipAddress:event.address})):work.filter(row=>!search || [row.action,row.userName,row.email].some(text=>text.toLowerCase().includes(search.toLowerCase()))).filter(row=>(!from || row.createdAt.slice(0,10)>=from)&&(!to || row.createdAt.slice(0,10)<=to));
  return <main className="space-y-6 p-6"><h1 className="text-2xl font-semibold">Activity logs</h1><nav className="flex gap-3" aria-label="Activity source"><button aria-pressed={tab==='work'} onClick={()=>setTab('work')}>BMS work</button><button aria-pressed={tab==='accounts'} onClick={()=>setTab('accounts')}>Accounts</button></nav>
    <form className="flex flex-wrap gap-3" onSubmit={event=>{event.preventDefault();void load();}}><input aria-label="Search activity" placeholder="Search name, email or action" className="rounded border p-2" value={search} onChange={event=>setSearch(event.target.value)}/>{tab==='accounts'&&<><select aria-label="Category" value={category} onChange={event=>{setCategory(event.target.value);setType('');}}><option value="">All categories</option>{catalog?.categories.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select><select aria-label="Event type" value={type} onChange={event=>setType(event.target.value)}><option value="">All events</option>{catalog?.types.filter(item=>!category||item.category===category).map(item=><option key={item.code} value={item.code}>{item.labelAdmin}</option>)}</select></>}<input aria-label="From" type="date" value={from} onChange={event=>setFrom(event.target.value)}/><input aria-label="To" type="date" value={to} onChange={event=>setTo(event.target.value)}/><button disabled={loading}>Search</button></form>
    {error&&<p role="alert">{error} <a href={`${import.meta.env.VITE_PORTAL_URL}/admin`} target="_blank" rel="noreferrer">Open portal</a></p>}
    <table className="w-full text-left"><thead><tr>{['Time','Person','Event','Address'].map(label=><th key={label} className="border-b p-3">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td className="p-3">{new Date(row.createdAt).toLocaleString()}</td><td>{row.userName}<small className="block">{row.email}</small></td><td>{row.action}</td><td>{row.ipAddress}</td></tr>)}</tbody></table>
    {loading&&<p role="status">Loading activity...</p>}{!loading&&!rows.length&&!error&&<p>No activity found.</p>}{tab==='accounts'&&cursor&&<button disabled={loading} onClick={()=>void load(true)}>Show more</button>}
  </main>;
}
