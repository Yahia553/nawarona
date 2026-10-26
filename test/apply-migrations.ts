import { applyD1Migrations, env } from 'cloudflare:test';

// بيعمل الجداول قبل كل ملف تستات (لو اتعملت قبل كده مش بيكررها)
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
