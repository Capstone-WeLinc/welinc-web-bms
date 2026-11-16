import type { Page } from '@playwright/test';
export function gatewayUrl(path:string){return 'http://localhost:3000'+(path.startsWith('/bms/')?path:'/bms'+path);}
/** Test API calls obtain a fresh access token through the browser context's HttpOnly cookie. */
export async function sessionToken(page:Page){
  const response=await page.request.post(gatewayUrl('/session/refresh'),{headers:{Origin:'http://localhost:8003','Content-Type':'application/json','Sec-Fetch-Site':'same-site'},data:{}});
  if(!response.ok())throw new Error(`BMS test session refresh failed (${response.status()})`);
  return (await response.json()).accessToken as string;
}
