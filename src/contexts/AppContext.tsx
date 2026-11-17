import SessionMonitor from '../components/SessionMonitor';
/* eslint-disable react-refresh/only-export-components */
import React,{createContext,useContext,useState,useEffect,useCallback} from 'react';
import type { User } from '../lib/types';
import { getCurrentUser } from '../lib/auth';
import { boot } from '../lib/session/session';
import { signOutFlow } from '../lib/session/signOutFlow';
import { useAuthStore } from '../store/authStore';
interface AppContextType{user:User|null;setUser:(user:User|null)=>void;logout:()=>void;darkMode:boolean;toggleDarkMode:()=>void;sidebarCollapsed:boolean;toggleSidebar:()=>void;}
const AppContext=createContext<AppContextType|null>(null);
let bootTask:Promise<void>|null=null;
export function AppProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<User|null>(getCurrentUser);
  const state=useAuthStore(s=>s);
  const [darkMode,setDarkMode]=useState(()=>localStorage.getItem('welinc_theme')==='dark');
  const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>localStorage.getItem('welinc_sidebar')==='collapsed');
  const publicPage=window.location.pathname.startsWith('/track/') || window.location.pathname==='/forgot-password';
  useEffect(()=>{let previous=useAuthStore.getState().user;return useAuthStore.subscribe(()=>{const current=useAuthStore.getState().user;if(current!==previous){previous=current;setUser(getCurrentUser());}});},[]);
  useEffect(()=>{if(!publicPage){bootTask??=boot();void bootTask;}},[publicPage]);
  useEffect(()=>{document.documentElement.classList.toggle('dark',darkMode);},[darkMode]);
  const toggleDarkMode=useCallback(()=>setDarkMode(old=>{localStorage.setItem('welinc_theme',old?'light':'dark');return !old;}),[]);
  const toggleSidebar=useCallback(()=>setSidebarCollapsed(old=>{localStorage.setItem('welinc_sidebar',old?'expanded':'collapsed');return !old;}),[]);
  const logout=useCallback(()=>{void signOutFlow({ask:true});},[]);
  const content=publicPage || state.status==='ready'?<>{children}<SessionMonitor/></>:state.status==='unavailable'?<main className="p-8"><h1>Sign-in service unavailable</h1><button onClick={()=>{bootTask=boot();}}>Retry</button></main>:<main className="p-8" aria-live="polite">Checking your session...</main>;
  return <AppContext.Provider value={{user,setUser,logout,darkMode,toggleDarkMode,sidebarCollapsed,toggleSidebar}}>{content}</AppContext.Provider>;
}
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('useApp must be inside AppProvider');return value;}
