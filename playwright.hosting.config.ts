import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests-hosting',workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:8113',...devices['Desktop Chrome']},
 webServer:{command:'node tests-hosting/serve-dist.mjs',url:'http://127.0.0.1:8113',reuseExistingServer:false},
});
