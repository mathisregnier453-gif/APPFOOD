// Direction artistique : vert sauge, fond blanc cassé, texte gris très foncé.
export const colors = {
  sage: '#7A9A7E',
  sageDark: '#5C7A60',
  sageLight: '#DCE7DC',
  sageMist: '#EEF3EC',
  background: '#F7F5F0',
  surface: '#FFFFFF',
  text: '#1F2421',
  textMuted: '#6B716C',
  textFaint: '#9BA19C',
  border: '#E6E3DC',
  warning: '#C98A2E',
  warningBg: '#FBF0DD',
  danger: '#B5524A',
  dangerBg: '#F7E3E0',
  info: '#4F7A96',
  infoBg: '#E3EDF3',
  overlay: 'rgba(31, 36, 33, 0.4)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6, color: colors.text },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  micro: { fontSize: 11, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1F2421',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#2E4431',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
