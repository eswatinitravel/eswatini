export const themes = [
  ...['rose', 'mint', 'sky', 'sand', 'lilac'].map(n => ({ id: `light-${n}`, mode: 'light' })),
  ...['midnight', 'ember', 'forest', 'violet', 'ocean'].map(n => ({ id: `dark-${n}`, mode: 'dark' }))
];
export const DEFAULT_THEME = 'dark-midnight';
