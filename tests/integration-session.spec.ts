import { test,expect } from '@playwright/test';
test('real portal sign-in restores a BMS deep link and shared sign-out',async({page})=>{
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:''}));
  await page.goto('/cs/bookings?integration=deep-link',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/localhost:8000/);
  await page.getByRole('textbox',{name:'Email or username',exact:true}).fill('bms.cs@welinc.com');
  await page.locator('#login-password').fill('cs1234');
  await page.locator('#login-submit').click();
  await expect(page).toHaveURL('http://localhost:8003/cs/bookings?integration=deep-link');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const stored=await page.evaluate(()=>Object.keys(localStorage)); // check-system: allow regression asserts credentials are absent from browser storage
  expect(stored).not.toContain('token');expect(stored).not.toContain('welinc_user');
  await page.getByRole('button',{name:/^sign out$/i}).click();
  await page.getByRole('button',{name:/^sign out$/i}).last().click();
  await expect(page).toHaveURL('http://localhost:8000/login?reason=logout');
});
