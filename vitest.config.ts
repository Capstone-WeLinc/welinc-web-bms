import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['src/lib/session/**/*.test.ts'],environment:'node'}});
