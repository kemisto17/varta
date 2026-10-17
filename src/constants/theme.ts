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

  primaryActionBackground: '#171716',
  primaryActionForeground: '#FFFFFF',

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

  primaryActionBackground: '#F3F2EE',
  primaryActionForeground: '#171716',

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

export const warmColors: ThemeColors = {
  background: '#FBF6EE',
  surface: '#FFFDF8',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F3EADF',

  textPrimary: '#2A211B',
  textSecondary: '#76685C',
  textMuted: '#8C7B6C',

  border: '#E2D6C8',
  borderSubtle: '#EEE5DA',
  icon: '#2A211B',

  primaryActionBackground: '#2A211B',
  primaryActionForeground: '#FFFDF8',

  danger: '#B42318',
  dangerSoft: '#F7EAE7',
  success: '#277047',
  successSoft: '#E8F2EB',

  overlay: 'rgba(42, 33, 27, 0.42)',
  imageOverlay: 'rgba(0, 0, 0, 0.75)',
  viewerBackground: '#050505',
  viewerForeground: '#FFFFFF',
  viewerMuted: '#D4D4D8',
  viewerOverlay: 'rgba(24, 24, 27, 0.76)',

  black: '#2A211B',
  white: '#FFFDF8',
};

export const oceanColors: ThemeColors = {
  background: '#F2F7FB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#E5EFF7',

  textPrimary: '#102A43',
  textSecondary: '#486581',
  textMuted: '#627D98',

  border: '#BCCCDC',
  borderSubtle: '#D9E7F0',
  icon: '#102A43',

  primaryActionBackground: '#0B4F6C',
  primaryActionForeground: '#FFFFFF',

  danger: '#B42318',
  dangerSoft: '#F7EAE7',
  success: '#277047',
  successSoft: '#E8F2EB',

  overlay: 'rgba(16, 42, 67, 0.42)',
  imageOverlay: 'rgba(0, 0, 0, 0.75)',
  viewerBackground: '#050505',
  viewerForeground: '#FFFFFF',
  viewerMuted: '#D4D4D8',
  viewerOverlay: 'rgba(24, 24, 27, 0.76)',

  black: '#102A43',
  white: '#FFFFFF',
};

export const forestColors: ThemeColors = {
  background: '#F3F7F2',
  surface: '#FCFEFB',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#E4EEE2',

  textPrimary: '#17351F',
  textSecondary: '#4D6753',
  textMuted: '#667C6B',

  border: '#C5D7C5',
  borderSubtle: '#DEE9DC',
  icon: '#17351F',

  primaryActionBackground: '#1F5B37',
  primaryActionForeground: '#FFFFFF',

  danger: '#B42318',
  dangerSoft: '#F7EAE7',
  success: '#277047',
  successSoft: '#E8F2EB',

  overlay: 'rgba(23, 53, 31, 0.42)',
  imageOverlay: 'rgba(0, 0, 0, 0.75)',
  viewerBackground: '#050505',
  viewerForeground: '#FFFFFF',
  viewerMuted: '#D4D4D8',
  viewerOverlay: 'rgba(24, 24, 27, 0.76)',

  black: '#17351F',
  white: '#FFFFFF',
};

export const warmDarkColors: ThemeColors = {
  ...darkColors,
  background: '#17120F',
  surface: '#211A16',
  surfaceElevated: '#2A211C',
  surfaceMuted: '#1C1613',
  textPrimary: '#F7EBDD',
  textSecondary: '#C7B6A5',
  textMuted: '#A49180',
  border: '#554539',
  borderSubtle: '#332923',
  icon: '#F7EBDD',
  primaryActionBackground: '#F2D7B8',
  primaryActionForeground: '#2A211B',
  dangerSoft: '#3B201B',
  successSoft: '#193025',
  overlay: 'rgba(12, 8, 6, 0.72)',
  black: '#17120F',
  white: '#2A211B',
};

export const oceanDarkColors: ThemeColors = {
  ...darkColors,
  background: '#071823',
  surface: '#0D2230',
  surfaceElevated: '#123044',
  surfaceMuted: '#091E2B',
  textPrimary: '#E3F2FC',
  textSecondary: '#A6C5D9',
  textMuted: '#7FA4BA',
  border: '#315268',
  borderSubtle: '#1A384B',
  icon: '#E3F2FC',
  primaryActionBackground: '#9ED8F5',
  primaryActionForeground: '#082333',
  dangerSoft: '#3A2022',
  successSoft: '#15352E',
  overlay: 'rgba(2, 11, 17, 0.74)',
  black: '#071823',
  white: '#082333',
};

export const forestDarkColors: ThemeColors = {
  ...darkColors,
  background: '#0C1810',
  surface: '#13241A',
  surfaceElevated: '#1B3022',
  surfaceMuted: '#102016',
  textPrimary: '#E5F3E7',
  textSecondary: '#ADCAAF',
  textMuted: '#86A38A',
  border: '#395842',
  borderSubtle: '#223B2A',
  icon: '#E5F3E7',
  primaryActionBackground: '#A8DDB4',
  primaryActionForeground: '#12301A',
  dangerSoft: '#39211D',
  successSoft: '#173523',
  overlay: 'rgba(4, 12, 6, 0.74)',
  black: '#0C1810',
  white: '#12301A',
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
