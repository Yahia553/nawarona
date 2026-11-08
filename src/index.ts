// نورونا: Worker واحد. الملفات الـ static (public/) بتتخدم قبله، وده بيرد على الباقي.
import { Hono } from 'hono';
import { api } from './routes/api';
import { pages, notFoundPage } from './routes/pages';
import { adminApi, adminPage } from './routes/admin';
import { coupleApi, couplePage } from './routes/couple';
import { mediaRoute } from './routes/media';
import { payApi, payPage } from './routes/pay';
import { HTML_HEADERS, notice } from './lib/html';

const app = new Hono<{ Bindings: Env }>();

app.route('/api/admin', adminApi);
app.route('/api/d', coupleApi);
app.route('/api/pay', payApi);
app.route('/api', api);
app.route('/admin', adminPage);
app.route('/d', couplePage);
app.route('/pay', payPage);
app.route('/media', mediaRoute);
app.route('/', pages);

app.notFound(c => c.req.path.startsWith('/api/') ? c.json({ error: 'مش موجود' }, 404) : notFoundPage());

app.onError((err, c) => {
  console.error(err);
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'حصلت مشكلة، جرّبوا تاني' }, 500);
  return new Response(notice({ title: 'نورونا', heading: 'حصلت مشكلة', text: 'جرّبوا تفتحوا اللينك تاني كمان شوية.' }), { status: 500, headers: HTML_HEADERS });
});

export default app;
