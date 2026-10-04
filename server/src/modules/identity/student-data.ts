import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import { ApiError } from './errors.js';
import { normalizePhone } from './validation.js';

export interface StudentDataKeys { encryption: Buffer; index: Buffer }
export function parseStudentDataKeys(env: NodeJS.ProcessEnv): StudentDataKeys | undefined {
  const names = ['STUDENT_DATA_ENCRYPTION_KEY_B64', 'STUDENT_DATA_INDEX_KEY_B64'] as const;
  if (names.every(name => !env[name])) return undefined;
  const keys = names.map(name => {
    const value = env[name] ?? '';
    if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error(`Invalid ${name}: expected a base64 32-byte key.`);
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32 || key.toString('base64') !== value) throw new Error(`Invalid ${name}: expected a base64 32-byte key.`);
    return key;
  });
  if (keys[0]!.equals(keys[1]!)) throw new Error('Student encryption and index keys must differ.');
  return { encryption: keys[0]!, index: keys[1]! };
}
export function normalizeNationalId(raw: unknown): string {
  const id = typeof raw === 'string' ? raw.trim().replace(/[٠-٩۰-۹]/g, d => String('٠١٢٣٤٥٦٧٨٩'.includes(d) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) : '';
  if (!/^\d{14}$/.test(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a 14-digit Egyptian national ID.', { field: 'nationalId' });
  return id;
}
export function protectNationalId(raw: unknown, keys: StudentDataKeys | undefined, userId: string) {
  const id = normalizeNationalId(raw);
  if (!keys) throw new ApiError(503, 'STUDENT_DATA_UNCONFIGURED', 'Student registration is temporarily unavailable.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keys.encryption, iv);
  cipher.setAAD(Buffer.from(`student-national-id:v1:${userId}`));
  const data = Buffer.concat([cipher.update(id, 'utf8'), cipher.final()]);
  return {
    nationalIdCipher: `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`,
    nationalIdFingerprint: createHmac('sha256', keys.index).update(`student-national-id:v1:${id}`).digest('hex'),
    nationalIdLast4: id.slice(-4),
  };
}
export const SCHOOL_YEARS = ['SECONDARY_1','SECONDARY_2'] as const;
export const GOVERNORATES = ['CAIRO','GIZA','ALEXANDRIA','DAKAHLIA','RED_SEA','BEHEIRA','FAYOUM','GHARBIA','ISMAILIA','MENOUFIA','MINYA','QALYUBIA','NEW_VALLEY','SUEZ','ASWAN','ASSIUT','BENI_SUEF','PORT_SAID','DAMIETTA','SHARQIA','SOUTH_SINAI','KAFR_EL_SHEIKH','MATROUH','LUXOR','QENA','NORTH_SINAI','SOHAG','OTHER'] as const;
export function validateStudentDetails(body: Record<string, unknown>, required: boolean) {
  const data: { parentPhone?: string; schoolYear?: string; governorate?: string; schoolName?: string | null } = {};
  for (const field of ['parentPhone','schoolYear','governorate','schoolName'] as const) {
    if (body[field] === undefined && (!required || field === 'schoolName')) continue;
    if (field === 'parentPhone') {
      try { data.parentPhone = normalizePhone(body[field]); }
      catch { throw new ApiError(400, 'VALIDATION_ERROR', 'Parent/guardian phone is invalid.', { field }); }
    } else if (field === 'schoolName') {
      if (body[field] !== null && typeof body[field] !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', 'School name is invalid.', { field });
      const value = typeof body[field] === 'string' ? body[field].trim() : '';
      if (value.length > 150) throw new ApiError(400, 'VALIDATION_ERROR', 'School name is too long.', { field });
      data.schoolName = value || null;
    } else {
      const allowed: readonly string[] = field === 'schoolYear' ? SCHOOL_YEARS : GOVERNORATES;
      if (typeof body[field] !== 'string' || !allowed.includes(body[field] as string)) throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid value.', { field });
      data[field] = body[field] as string;
    }
  }
  return data;
}
