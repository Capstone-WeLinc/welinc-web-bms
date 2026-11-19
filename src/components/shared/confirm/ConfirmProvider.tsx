import {useEffect,useSyncExternalStore} from 'react';
import {useLocation} from 'react-router-dom';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '../../ui/Dialog';
import {confirmStore} from './confirm';
/** One reference confirmation queue, rendered using the existing BMS dialog. */
export function ConfirmProvider(){
 const request=useSyncExternalStore(confirmStore.subscribe,confirmStore.getCurrent,confirmStore.getCurrent);
 const location=useLocation();
 useEffect(()=>confirmStore.attachProvider(),[]);
 useEffect(()=>{confirmStore.cancelAll();},[location.pathname,location.search]);
 if(!request)return null;
 const {id,options,opener}=request;
 return <Dialog open onOpenChange={open=>{if(!open)confirmStore.settle(id,false);}}>
  <DialogContent className="max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onCloseAutoFocus={event=>{event.preventDefault();if(opener?.isConnected)opener.focus();}}>
   <DialogTitle className="text-lg font-semibold text-slate-900">{options.title}</DialogTitle>
   <DialogDescription className="text-sm text-slate-600">{options.description}</DialogDescription>
   <div className="mt-4 flex justify-end gap-3">
    <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={()=>confirmStore.settle(id,false)}>{options.cancelText??'Cancel'}</button>
    <button className="rounded-xl bg-[#1a1f6e] px-4 py-2 text-sm font-semibold text-white" onClick={()=>confirmStore.settle(id,true)}>{options.confirmText??'Confirm'}</button>
   </div>
  </DialogContent>
 </Dialog>;
}
