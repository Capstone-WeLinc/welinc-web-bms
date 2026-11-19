import {test,expect} from '@playwright/test';
import {refreshAnswer} from '../tests-ui/session-fixture';

test('production assets restore a deep link under the shipped security headers',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  Object.assign(window,{cspViolations:[] as string[]});
  document.addEventListener('securitypolicyviolation',event=>{
   (window as unknown as {cspViolations:string[]}).cspViolations.push(event.violatedDirective+':'+event.blockedURI);
  });
 });
 await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:''}));
 await page.route(url=>['api.welinc.app','staging-api.welinc.app'].includes(url.hostname),route=>{
  const headers={'access-control-allow-origin':'http://127.0.0.1:8113','access-control-allow-credentials':'true','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  const pathname=new URL(route.request().url()).pathname;
  if(pathname==='/bms/session/refresh')return route.fulfill({headers,json:refreshAnswer});
  if(pathname==='/bms/session/status')return route.fulfill({headers,json:{sessionExpiresAt:refreshAnswer.sessionExpiresAt}});
  return route.fulfill({headers,json:[]});
 });
 const response=await page.goto('/admin/crew?hosting=deep-link');
 expect(response?.status()).toBe(200);
 expect(response?.headers()['x-content-type-options']).toBe('nosniff');
 expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
 await expect(page.getByRole('heading',{name:'Crew',exact:true})).toBeVisible();
 await expect(page).toHaveURL(/\/admin\/crew\?hosting=deep-link$/);
 expect(await page.evaluate(()=>(window as unknown as {cspViolations:string[]}).cspViolations)).toEqual([]);
 expect(errors).toEqual([]);
});
