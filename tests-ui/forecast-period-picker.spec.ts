import { mockCors,refreshAnswer } from './session-fixture';
import { expect,test,type Page } from '@playwright/test';
async function openForecast(page:Page){
  await page.clock.setFixedTime(new Date('2026-11-10T04:00:00Z'));
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:''}));
  await page.route(url=>url.pathname.startsWith('/bms/')||url.pathname.startsWith('/auth/'),async route=>{
    const path=new URL(route.request().url()).pathname.replace(/^\/bms(?=\/(?!config))/,'');
    if(path==='/session/refresh')return route.fulfill({headers:mockCors,json:refreshAnswer});
    if(path==='/session/status')return route.fulfill({headers:mockCors,json:{sessionExpiresAt:refreshAnswer.sessionExpiresAt}});
    if(path==='/approvals/counts')return route.fulfill({headers:mockCors,json:{total:0}});
    return route.fulfill({headers:mockCors,json:route.request().method()==='GET'?[]:{}});
  });
  await page.goto('/admin/reports',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'AI Demand Forecast',exact:true}).click();
  return page.getByRole('combobox',{name:'Search forecast periods'});
}
test('typing filters the forecast periods and Enter picks the match',async({page})=>{
  const picker=await openForecast(page);await picker.click();
  await expect(page.getByRole('option')).toHaveText(['Next 7 days','Next 30 days','Next 90 days']);
  await picker.fill('week');await expect(page.getByRole('option')).toHaveText(['Next 7 days']);
  await picker.press('Enter');await expect(picker).toHaveValue('Next 7 days');
  await expect(page.getByRole('option')).toHaveCount(0);
});
test('search matches numbers and words like quarter',async({page})=>{
  const picker=await openForecast(page);await picker.fill('quarter');
  await expect(page.getByRole('option')).toHaveText(['Next 90 days']);
  await picker.fill('30');await expect(page.getByRole('option')).toHaveText(['Next 30 days']);
  await picker.fill('xyz');await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.getByText(/No period matches/)).toBeVisible();
  await picker.press('Escape');await expect(picker).toHaveValue('Next 30 days');
});
test('clicking an option picks it and reopening starts with an empty search',async({page})=>{
  const picker=await openForecast(page);await picker.fill('90');
  await page.getByRole('option',{name:'Next 90 days'}).click();
  await expect(picker).toHaveValue('Next 90 days');await picker.click();
  await expect(picker).toHaveValue('');await expect(page.getByRole('option')).toHaveCount(3);
});
