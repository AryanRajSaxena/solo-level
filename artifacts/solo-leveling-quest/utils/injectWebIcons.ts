import { Platform } from 'react-native';
import { FEATHER_FONT_DATA_URI } from './featherFontBase64';

export function injectWebIcons(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  const STYLE_ID = 'solo-leveling-feather-font';
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.type = 'text/css';
  style.textContent = `
@font-face {
  font-family: 'feather';
  src: url('${FEATHER_FONT_DATA_URI}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Feather';
  src: url('${FEATHER_FONT_DATA_URI}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.head?.appendChild(style);
    });
  }
}

// Auto-run on web immediately upon module load
injectWebIcons();
