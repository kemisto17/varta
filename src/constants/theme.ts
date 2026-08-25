export const lightColors = {
  background: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F1F0ED',

  textPrimary: '#171716',
  textSecondary: '#686865',
  textMuted: '#706F6B',

  border: '#D9D8D3',
  borderSubtle: '#EAE9E5',
  icon: '#171716',

  danger: '#B42318',
  dangerSoft: '#F7EAE7',
  success: '#277047',
  successSoft: '#E8F2EB',

  overlay: 'rgba(17, 17, 16, 0.42)',
  imageOverlay: 'rgba(0, 0, 0, 0.75)',
  viewerBackground: '#050505',
  viewerForeground: '#FFFFFF',
  viewerMuted: '#D4D4D8',
  viewerOverlay: 'rgba(24, 24, 27, 0.76)',

  // Existing inverse controls use these aliases until their names are retired.
  black: '#111111',
  white: '#FFFFFF',
} as const;

export type ThemeColors = {
  [Token in keyof typeof lightColors]: string;
};

export const darkColors: ThemeColors = {
  background: '#111110',
  surface: '#191918',
  surfaceElevated: '#232321',
  surfaceMuted: '#151514',

  textPrimary: '#F3F2EE',
  textSecondary: '#AAA9A4',
  textMuted: '#82817D',

  border: '#3A3936',
  borderSubtle: '#292826',
  icon: '#F3F2EE',

  danger: '#FF9A91',
  dangerSoft: '#351E1C',
  success: '#78C79B',
  successSoft: '#173124',

  overlay: 'rgba(0, 0, 0, 0.66)',
  imageOverlay: 'rgba(0, 0, 0, 0.8)',
  viewerBackground: '#050505',
  viewerForeground: '#FFFFFF',
  viewerMuted: '#D4D4D8',
  viewerOverlay: 'rgba(24, 24, 27, 0.82)',

  black: '#111111',
  white: '#171716',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};
