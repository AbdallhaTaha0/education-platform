import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { PublicDataProvider, readPublicData } from './seo/publicData';
import { publicHref } from './seo/paths';
// Self-hosted fonts (fontsource, OFL-licensed): no runtime third-party fetch.
// Latin display + Arabic weights needed by the type scale; nothing else.
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-500.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import '@fontsource/noto-sans-arabic/arabic-700.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const publicData = readPublicData();
let preferredLang: 'ar' | 'en' = publicData?.lang ?? 'ar';
try { if ((!publicData || window.location.hash) && localStorage.getItem('edu-platform-lang') === 'en') preferredLang = 'en'; } catch { /* Storage is optional. */ }
const legacyTarget = publicHref(window.location.hash, preferredLang);
if (window.location.hash && legacyTarget !== window.location.hash) {
  window.location.replace(legacyTarget);
} else {
  const application = <StrictMode><PublicDataProvider data={publicData}><App /></PublicDataProvider></StrictMode>;
  if (publicData && !window.location.hash) hydrateRoot(root, application);
  else createRoot(root).render(application);
}
