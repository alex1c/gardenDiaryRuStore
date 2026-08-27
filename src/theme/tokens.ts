/**
 * Design tokens — calm garden/dacha light theme without visual kitsch.
 * Soft sage greens and warm neutrals; readable sizes for 40+ users.
 */

export const colors = {
  /** Primary interactive / brand sage. */
  primary: '#3B6B4F',
  primaryMuted: '#5F8F6E',
  primarySoft: '#E3EFE6',

  text: '#1F2A24',
  textSecondary: '#4A5A50',
  textMuted: '#7A8A80',
  error: '#B42318',

  background: '#F7F9F4',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2EA',

  border: '#D5DDD4',
  danger: '#B42318',
  warning: '#B54708',
  success: '#2F6B45',
} as const;

/** Spacing scale in density-independent pixels. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  button: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Minimum recommended touch target for primary controls. */
export const touchTarget = {
  min: 48,
} as const;

export const tokens = {
  colors,
  spacing,
  typography,
  radii,
  touchTarget,
} as const;

export default tokens;
