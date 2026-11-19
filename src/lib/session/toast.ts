import { toast } from 'sonner';
export function showToast(message:string,tone:string){if(tone==='error')toast.error(message);else toast(message);}
