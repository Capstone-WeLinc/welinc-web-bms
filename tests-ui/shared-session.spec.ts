import { expect,test,type Page } from '@playwright/test';
import { mockCors,refreshAnswer } from './session-fixture';
async function mockApi(page:Page,extra?:(path:string,body:any)=>any){
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:''}));
  await page.route(url=>url.hostname==='localhost'&&url.port==='8000',route=>route.fulfill({contentType:'text/html',body:'<h1>Shared portal</h1>'}));
  await page.route(url=>url.hostname==='localhost'&&url.port==='3000',async route=>{
    const req=route.request();const path=new URL(req.url()).pathname;
    if(req.method()==='OPTIONS')return route.fulfill({headers:mockCors,status:204});
    const custom=extra?.(path,req.postDataJSON());
    if(custom)return route.fulfill({headers:mockCors,...custom});
    if(path==='/bms/session/refresh')return route.fulfill({headers:mockCors,json:refreshAnswer});
    if(path==='/bms/session/logout')return route.fulfill({headers:mockCors,status:204});
    if(path==='/bms/activity-logs')return route.fulfill({headers:mockCors,json:{items:[],total:0,page:1,pageSize:0}});
    if(path==='/auth/activity/catalog')return route.fulfill({headers:mockCors,json:{categories:[],types:[],reasons:[]}});
    if(path==='/auth/profile/activity')return route.fulfill({headers:mockCors,json:{data:[],nextCursor:null}});
    if(path==='/auth/profile/deletion-request')return route.fulfill({headers:mockCors,json:{request:null}});
    return route.fulfill({headers:mockCors,json:[]});
  });
}
test('deep links boot from the session cookie and keep access tokens out of storage',async({page})=>{
  await mockApi(page);await page.goto('/admin/crew',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Crew',exact:true})).toBeVisible();
  const stored=await page.evaluate(()=>Object.keys(localStorage)); // check-system: allow regression asserts credentials are absent from browser storage
  expect(stored).not.toContain('token');
  expect(stored).not.toContain('welinc_user');
  await expect(page.getByRole('button',{name:'Switch system'})).toBeVisible();
  await page.getByRole('button',{name:'Administration menu',exact:true}).click();
  await expect(page.getByRole('button',{name:'User Accounts',exact:true})).toBeVisible();
});
test('sign out ends the shared session and opens the portal logout page',async({page})=>{
  let ended=false;await mockApi(page,path=>{if(path==='/bms/session/logout'){ended=true;return {status:204};}});
  await page.goto('/admin/crew',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/^sign out$/i}).click();
  await page.getByRole('button',{name:/^sign out$/i}).last().click();
  await expect(page).toHaveURL('http://localhost:8000/login?reason=logout');expect(ended).toBe(true);
});
test('public tracking does not start an office session',async({page})=>{
  let refreshed=false;await mockApi(page,path=>{if(path==='/bms/session/refresh')refreshed=true;});
  await page.goto('/track/example?token='+'a'.repeat(64),{waitUntil:'domcontentloaded'}); // check-system: allow signed public tracking capability, not an office token
  await expect(page).toHaveURL(/\/track\/example/);await page.waitForLoadState('domcontentloaded');expect(refreshed).toBe(false);
});
test('account deletion sends its one-use reauthentication token and purpose',async({page})=>{
  let verification:any;let deletion:any;
  await mockApi(page,(path,body)=>{
    if(path==='/auth/profile/verify-password'){verification=body;return {json:{reauthToken:'single-use-test',expiresAt:'2050-01-01T00:00:00Z'}};}
    if(path==='/auth/profile/deletion-request'&&body?.reauthToken){deletion=body;return {status:201,json:{status:'PENDING'}};}
  });
  await page.goto('/admin/profile',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Request Account Deletion',exact:true}).click();
  await page.getByPlaceholder('Enter your password to confirm').fill('test-only-password');await page.getByRole('button',{name:'Yes',exact:true}).click();
  await expect.poll(()=>deletion?.reauthToken).toBe('single-use-test');expect(verification.purpose).toBe('ACCOUNT_DELETION');
});
test('a refused callback returns to the portal once instead of looping',async({page})=>{
  let starts=0;
  await mockApi(page,path=>path==='/bms/session/refresh'?{status:401,json:{code:'SESSION_ENDED'}}:undefined);
  await page.route(url=>url.port==='3000'&&url.pathname==='/bms/session/start',route=>{
    starts++;return route.fulfill({status:302,headers:{location:'http://localhost:8003/admin/crew?callback=refused'}});
  });
  await page.goto('/admin/crew',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL('http://localhost:8000/?error=LOGIN_FAILED');
  expect(starts).toBe(1);
});
test('an admin code requirement stays in BMS and links to portal confirmation',async({page})=>{
  await mockApi(page,path=>path==='/auth/activity'?{status:403,json:{code:'ADMIN_CODE_REQUIRED'}}:undefined);
  await page.goto('/admin/activity-logs',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Accounts',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Confirm your sign in in the portal');
  await expect(page.getByRole('alert').getByRole('link',{name:'Open portal'})).toHaveAttribute('href','http://localhost:8000/admin');
  await expect(page).toHaveURL(/\/admin\/activity-logs$/);
});
