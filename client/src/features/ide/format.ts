import { format } from 'prettier/standalone';
import babel from 'prettier/plugins/babel';
import estree from 'prettier/plugins/estree';

export async function formatJavaScript(source: string): Promise<string> {
  return format(source, { parser: 'babel', plugins: [babel, estree], tabWidth: 2, printWidth: 80, semi: true, embeddedLanguageFormatting: 'off' });
}
