import { siShopify, siTiktok, siShopee } from 'simple-icons';
import { cn } from '@/lib/utils';

export type Platform = 'shopify' | 'tiktok' | 'shopee' | 'lazada';

const BRAND_ICONS: Partial<Record<Platform, { path: string; hex: string; title: string }>> = {
  shopify: siShopify,
  tiktok: siTiktok,
  shopee: siShopee,
};

// Lazada isn't in simple-icons (no SVG mark available for a regional brand
// at that size) — falls back to a plain letter badge in its real brand
// color instead of a mismatched generic icon.
const FALLBACK_COLORS: Record<Platform, string> = {
  shopify: '7AB55C',
  tiktok: '000000',
  shopee: 'EE4D2D',
  lazada: 'F57224',
};

interface PlatformIconProps {
  platform: Platform;
  className?: string;
}

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  const icon = BRAND_ICONS[platform];
  const hex = icon?.hex ?? FALLBACK_COLORS[platform];

  if (!icon) {
    return (
      <span
        className={cn('flex items-center justify-center rounded font-bold text-white', className)}
        style={{ backgroundColor: `#${hex}` }}
        aria-label={platform}
        title={platform}
      >
        {platform.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={icon.title} className={className} fill={`#${hex}`}>
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}
