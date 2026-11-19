import { useEffect } from 'react';
export default function ForgotPassword(){useEffect(()=>{window.location.replace(`${import.meta.env.VITE_PORTAL_URL}/forgot-password`);},[]);return <p>Opening account recovery...</p>;}
