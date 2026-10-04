import { format } from 'prettier/standalone';
import babel from 'prettier/plugins/babel';
import estree from 'prettier/plugins/estree';
import html from 'prettier/plugins/html';
import postcss from 'prettier/plugins/postcss';

export async function formatJavaScript(source: string): Promise<string> {
  return format(source, { parser: 'babel', plugins: [babel, estree], tabWidth: 2, printWidth: 80, semi: true, embeddedLanguageFormatting: 'off' });
}
export async function formatSource(source: string, language: string): Promise<string> {
  if (language === 'javascript') return formatJavaScript(source);
  if (language === 'python') return (await import('./python-format')).formatPython(source);
  if (language !== 'html' && language !== 'css') throw new Error('FORMAT_UNSUPPORTED');
  return format(source, { parser: language, plugins: [html, postcss], tabWidth: 2, printWidth: 80, embeddedLanguageFormatting: 'off' });
}
