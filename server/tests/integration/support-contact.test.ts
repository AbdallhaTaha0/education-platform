import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createWorld, registerStudent, loginWith, createTestAdmin, TEST_ORIGIN, TEST_PASSWORD, type IdentityWorld, type Jar } from './identity-helpers.js';

let w: IdentityWorld; let admin: Jar;
beforeAll(async () => { w = await createWorld(); const user = await createTestAdmin(w, 'Support admin', TEST_PASSWORD); admin = (await loginWith(w.app, user.email, TEST_PASSWORD)).jar; });
afterAll(async () => { await w?.close(); });
const read = () => request(w.app).get('/support/contact');
const save = (jar: Jar, body: object) => request(w.app).put('/support/contact').set('Origin', TEST_ORIGIN).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(body);

describe('owner-editable public support contacts', () => {
  it('publishes the owner-provided migration seed without requiring login or exposing private data', async () => {
    const result = await read(); expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.data.contact).toEqual({email: 'aliibrahim3600@gmail.com', phone: '+201062419263', version: 1});
  });
  it('rejects anonymous/student writes and admin writes without valid origin/session CSRF', async () => {
    const body = {email: 'support@example.test', phone: '01062419263', version: 1};
    expect((await request(w.app).put('/support/contact').set('Origin',TEST_ORIGIN).send(body)).status).toBe(401);
    const student = await registerStudent(w.app); expect((await save(student.jar,body)).status).toBe(403);
    expect((await request(w.app).put('/support/contact').set('Origin',TEST_ORIGIN).set('Cookie',admin.header()).send(body)).status).toBe(403);
    expect((await request(w.app).put('/support/contact').set('Origin','https://unapproved.test').set('Cookie',admin.header()).set('X-Csrf-Token',admin.csrf()).send(body)).status).toBe(403);
    expect((await read()).body.data.contact.version).toBe(1);
  });
  it('rejects malformed, unsafe and unknown input without changing contacts', async () => {
    const base = {email: 'support@example.test',phone: '01062419263',version: 1};
    for (const body of [{...base,email:'x\r\n@example.test'},{...base,email:'not-an-email'},{...base,phone:'javascript:alert(1)'},{...base,version:0},{...base,version:'1'},{...base,role:'ADMIN'}]) expect((await save(admin,body)).status).toBe(400);
    expect((await read()).body.data.contact.version).toBe(1);
  });
  it('persists normalized changes across app instances and fences concurrent stale edits', async () => {
    const version = (await read()).body.data.contact.version;
    const edits = await Promise.all([save(admin,{email:' NEW-SUPPORT@example.test ',phone:'01062419263',version}),save(admin,{email:'other-support@example.test',phone:'+201062419263',version})]);
    expect(edits.map(r=>r.status).sort()).toEqual([200,409]);
    const accepted = edits.find(r=>r.status===200)!; expect(accepted.body.data.contact.phone).toBe('+201062419263'); expect(accepted.body.data.contact.version).toBe(2);
    const other = await createWorld(); try { expect((await request(other.app).get('/support/contact')).body.data.contact).toEqual(accepted.body.data.contact); } finally { await other.close(); }
    expect((await save(admin,{email:'stale@example.test',phone:'01062419263',version})).status).toBe(409);
    expect((await read()).body.data.contact).toEqual(accepted.body.data.contact);
  });
});
