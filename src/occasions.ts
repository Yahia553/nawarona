// نسخة السيرفر من جدول المناسبات اللي في public/assets/invite.js (OCC).
// السيرفر محتاج منها بس: أسامي المواعيد، عدد صيغ الكلام، وكلمة الدعوة في معاينة الواتساب.
// لو غيّرت المناسبات في invite.js غيّرها هنا كمان.

export type Occasion = 'katb' | 'hennawed' | 'engage' | 'henna' | 'wedding';

export const OCCASIONS: Record<Occasion, { name: string; events: string[]; wordings: number; done: string }> = {
  katb: { name: 'كتب كتاب', events: ['عقد القران'], wordings: 3, done: 'تم عقد القران' },
  hennawed: { name: 'حنة وفرح', events: ['ليلة الحنة', 'حفل الزفاف'], wordings: 3, done: 'تم الزفاف' },
  engage: { name: 'خطوبة', events: ['حفل الخطوبة'], wordings: 3, done: 'تمت الخطوبة' },
  henna: { name: 'حنة', events: ['ليلة الحنة'], wordings: 2, done: 'خلصت ليلة الحنة' },
  wedding: { name: 'فرح', events: ['حفل الزفاف'], wordings: 3, done: 'تم الزفاف' },
};

export const isOccasion = (v: unknown): v is Occasion => typeof v === 'string' && Object.hasOwn(OCCASIONS, v);

export const TEMPLATES = ['royal', 'rose', 'katb', 'night', 'white', 'henna', 'ring', 'garden'] as const;
export type Template = (typeof TEMPLATES)[number];
export const isTemplate = (v: unknown): v is Template => typeof v === 'string' && (TEMPLATES as readonly string[]).includes(v);

// صورة معاينة الواتساب لكل قالب (JPG عشان الواتساب مش بيعرض webp دايمًا)
export const ogImage = (tpl: string) => `/img/og/${isTemplate(tpl) ? tpl : 'royal'}.jpg`;
