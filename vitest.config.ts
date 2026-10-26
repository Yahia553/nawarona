import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

// التستات بتشتغل جوه workerd نفسه (زي Cloudflare بالظبط) على D1 و R2 محليين
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations('./migrations'),
          ADMIN_PASSWORD: 'test-admin-password',
          SESSION_SECRET: 'test-session-secret-0123456789abcdef',
          KEY_PEPPER: 'test-key-pepper-0123456789abcdef',
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
