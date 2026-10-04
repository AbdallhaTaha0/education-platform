import init, { format } from '@wasm-fmt/ruff_fmt/vite';

/** Browser-worker only: parses/formats source, never executes Python. */
export async function formatPython(source: string): Promise<string> {
  if (source.length > 32768) throw new Error('FORMAT_LIMIT');
  await init();
  const result = format(source, 'student.py', {
    indent_style: 'space', indent_width: 4, line_width: 88,
    line_ending: 'lf', quote_style: 'double',
  });
  if (result.length > 32768) throw new Error('FORMAT_LIMIT');
  return result;
}
