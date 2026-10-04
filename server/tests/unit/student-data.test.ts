import { describe, expect, it } from 'vitest';
import { createDecipheriv, randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import { normalizeNationalId, parseStudentDataKeys, protectNationalId, validateStudentDetails } from '../../src/modules/identity/student-data.js';
import { createLogger, sanitizeForLog } from '../../src/logger.js';
const keys = { encryption: randomBytes(32), index: randomBytes(32) };
describe('private student data', () => {
 it('normalizes Arabic and Persian digits without inferring personal characteristics',()=>{expect(normalizeNationalId(' ٢٩٩٠١٠١٠١٢٣٤٥٦ ')).toBe('29901010123456');expect(normalizeNationalId('۲۹۹۰۱۰۱۰۱۲۳۴۵۶')).toBe('29901010123456');});
 it.each([null,12345678901234,'123','2990101012345x','299-01010123456'])('rejects non-14-digit-string input %s',raw=>expect(()=>normalizeNationalId(raw)).toThrow('14-digit'));
 it('uses random authenticated ciphertext and a stable keyed uniqueness fingerprint',()=>{
  const id='29901010123456',a=protectNationalId(id,keys,'student-a'),b=protectNationalId(id,keys,'student-b');expect(a.nationalIdCipher).not.toBe(b.nationalIdCipher);expect(a.nationalIdFingerprint).toBe(b.nationalIdFingerprint);expect(a.nationalIdLast4).toBe('3456');expect(JSON.stringify(a)).not.toContain(id);
  const [,iv,tag,data]=a.nationalIdCipher.split('.');const decipher=createDecipheriv('aes-256-gcm',keys.encryption,Buffer.from(iv!,'base64'));decipher.setAAD(Buffer.from('student-national-id:v1:student-a'));decipher.setAuthTag(Buffer.from(tag!,'base64'));expect(Buffer.concat([decipher.update(Buffer.from(data!,'base64')),decipher.final()]).toString()).toBe(id);
  const wrong=createDecipheriv('aes-256-gcm',keys.encryption,Buffer.from(iv!,'base64'));wrong.setAAD(Buffer.from('student-national-id:v1:student-b'));wrong.setAuthTag(Buffer.from(tag!,'base64'));wrong.update(Buffer.from(data!,'base64'));expect(()=>wrong.final()).toThrow();
 });
 it('fails closed without storage keys',()=>expect(()=>protectNationalId('29901010123456',undefined,'x')).toThrow('unavailable'));
 it('requires complete distinct canonical keys, without echoing values',()=>{
  expect(parseStudentDataKeys({})).toBeUndefined();const a=keys.encryption.toString('base64'),b=keys.index.toString('base64');expect(parseStudentDataKeys({STUDENT_DATA_ENCRYPTION_KEY_B64:a,STUDENT_DATA_INDEX_KEY_B64:b})!.index).toEqual(keys.index);
  expect(()=>parseStudentDataKeys({STUDENT_DATA_ENCRYPTION_KEY_B64:a})).toThrow('STUDENT_DATA_INDEX_KEY_B64');expect(()=>parseStudentDataKeys({STUDENT_DATA_ENCRYPTION_KEY_B64:a,STUDENT_DATA_INDEX_KEY_B64:a})).toThrow('must differ');expect(()=>parseStudentDataKeys({STUDENT_DATA_ENCRYPTION_KEY_B64:'secret-bad-value'})).toThrow(/^Invalid STUDENT_DATA_ENCRYPTION_KEY_B64:/);
 });
 it('requires guardian/education details, bounds school names, allows shared and international contacts',()=>{
  expect(validateStudentDetails({parentPhone:'٠١٠١٢٣٤٥٦٧٨',schoolYear:'SECONDARY_1',governorate:'CAIRO'},true).parentPhone).toBe('+201012345678');expect(validateStudentDetails({parentPhone:'+442079460123'},false).parentPhone).toBe('+442079460123');expect(validateStudentDetails({schoolName:''},false)).toEqual({schoolName:null});expect(()=>validateStudentDetails({},true)).toThrow();expect(()=>validateStudentDetails({schoolYear:'bogus'},false)).toThrow();expect(()=>validateStudentDetails({schoolName:'x'.repeat(151)},false)).toThrow();
 });
 it('redacts IDs and guardian phones from structured logging and audit sanitization',()=>{
  const nationalId='29901010123456',parentPhone='+201012345678';let output='';const stream=new Writable({write(chunk,_encoding,done){output+=chunk;done();}});const logger=createLogger('info',stream);logger.info({nationalId,parentPhone,req:{body:{nationalId,parentPhone}},profile:{nationalIdCipher:'private-cipher',nationalIdFingerprint:'private-hash'}},'dummy');expect(output).not.toContain(nationalId);expect(output).not.toContain(parentPhone);expect(output).not.toContain('private-cipher');expect(output).toContain('[Redacted]');expect(sanitizeForLog({nationalId,parentPhone,national_id:nationalId})).toEqual({nationalId:'[Redacted]',parentPhone:'[Redacted]',national_id:'[Redacted]'});
 });
});
