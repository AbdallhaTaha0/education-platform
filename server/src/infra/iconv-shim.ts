import { StringDecoder } from 'node:string_decoder';

export function getDecoder(encoding = 'utf8') {
  const normalized = encoding.toLowerCase().replace('-', '');
  if (normalized !== 'utf8' && normalized !== 'utf16le' && normalized !== 'ascii' && normalized !== 'latin1') {
    throw new Error(`Encoding not recognized: ${encoding}`);
  }
  const decoder = new StringDecoder(normalized as BufferEncoding);
  return {
    write(buf: Buffer): string {
      return decoder.write(buf);
    },
    end(): string {
      return decoder.end();
    },
  };
}

export function encodingExists(encoding = 'utf8'): boolean {
  const normalized = encoding.toLowerCase().replace('-', '');
  return normalized === 'utf8' || normalized === 'utf16le' || normalized === 'ascii' || normalized === 'latin1';
}

export function decode(buf: Buffer, encoding = 'utf8'): string {
  return getDecoder(encoding).write(buf);
}

export function encode(str: string, encoding = 'utf8'): Buffer {
  return Buffer.from(str, encoding as BufferEncoding);
}

export default { getDecoder, encodingExists, decode, encode };
