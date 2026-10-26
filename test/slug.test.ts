import { describe, expect, it } from 'vitest';
import { baseSlug, pickSlug, RESERVED, slugify, SLUG_RE } from '../src/lib/slug';
import { createOrder, invitation } from './helpers';

describe('slugify (نفس تحويل الواجهة)', () => {
  it('بيحوّل الأسامي العربي', () => {
    expect(slugify('أحمد')).toBe('ahmd');
    expect(slugify('سارة')).toBe('sara');
    expect(slugify('خالد')).toBe('khald');
    expect(baseSlug('أحمد', 'سارة')).toBe('ahmd-sara');
  });
  it('بيشيل أي رموز وبيقصّر التكرار', () => {
    expect(slugify('<img src=x>')).toBe('imgsrcx');
    expect(slugify('ممممم')).toBe('mm');
    expect(slugify('!!!')).toBe('name');
    expect(SLUG_RE.test(baseSlug('عبد الرحمن', 'منّة'))).toBe(true);
  });
  it('pickSlug بيزوّد رقم لو اللينك مستخدم، ومش بيدّي كلمة محجوزة', () => {
    expect(pickSlug('ahmd-sara', new Set())).toBe('ahmd-sara');
    expect(pickSlug('ahmd-sara', new Set(['ahmd-sara']))).toBe('ahmd-sara-2');
    expect(pickSlug('ahmd-sara', new Set(['ahmd-sara', 'ahmd-sara-2']))).toBe('ahmd-sara-3');
    for (const r of RESERVED) expect(pickSlug(r, new Set())).toBe(`${r}-2`);
  });
});

describe('اللينكات في الطلبات الحقيقية', () => {
  it('نفس الأسامي في طلبين، وفي باقة واحدة، بياخدوا لينكات مختلفة', async () => {
    const a = await createOrder({ invitations: [invitation({ groom: 'كريم', bride: 'هنا' })] });
    const b = await createOrder({ invitations: [invitation({ groom: 'كريم', bride: 'هنا' }), invitation({ groom: 'كريم', bride: 'هنا', occasion: 'katb', template: 'katb' })] });
    const slugs = [...a.invitations, ...b.invitations].map(i => i.slug);
    expect(slugs[0]).toBe('krym-hna');
    expect(new Set(slugs).size).toBe(3);
    expect(slugs).toEqual(['krym-hna', 'krym-hna-2', 'krym-hna-3']);
  });
});
