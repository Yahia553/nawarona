// الأسعار في مكان واحد. الواجهة بتقراها من /api/config
// دعوة الحنة والفرح (hennawed) بتتحسب دعوة واحدة.

export const BUNDLES: Record<1 | 2 | 3, number> = { 1: 299, 2: 449, 3: 598 };
export const ADDON_PER_INVITATION = 199;

export type Package = keyof typeof BUNDLES;
export const isPackage = (v: unknown): v is Package => v === 1 || v === 2 || v === 3;

export const orderTotal = (pkg: Package, addon: boolean) => BUNDLES[pkg] + (addon ? ADDON_PER_INVITATION * pkg : 0);
