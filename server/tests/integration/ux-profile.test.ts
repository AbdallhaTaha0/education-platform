import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createWorld, registerStudent, loginWith, createTestAdmin, TEST_ORIGIN, TEST_PASSWORD, uniqueIp, type IdentityWorld, type Jar } from './identity-helpers.js';
import { createSessionFamily, newSessionTiming } from '../../src/modules/identity/store.js';
let w:IdentityWorld;
beforeAll(async()=>{w=await createWorld();});afterAll(async()=>{await w?.close();});
const patch=(jar:Jar,body:object)=>request(w.app).patch('/auth/profile').set('Origin',TEST_ORIGIN).set('X-Forwarded-For',uniqueIp()).set('Cookie',jar.header()).set('X-Csrf-Token',jar.csrf()).send(body);
describe('owner-approved profile edits and student directory',()=>{
  it('requires authentication, origin and session CSRF',async()=>{
    expect((await request(w.app).patch('/auth/profile').set('Origin',TEST_ORIGIN).send({displayName:'Other'})).status).toBe(401);
    const s=await registerStudent(w.app);
    expect((await request(w.app).patch('/auth/profile').set('Origin',TEST_ORIGIN).set('Cookie',s.jar.header()).send({displayName:'Other'})).status).toBe(403);
    expect((await request(w.app).patch('/auth/profile').set('Origin','https://unapproved.test').set('Cookie',s.jar.header()).set('X-Csrf-Token',s.jar.csrf()).send({displayName:'Other'})).status).toBe(403);
  });
  it('updates only the authenticated name and rejects privilege/identifier edits',async()=>{
    const s=await registerStudent(w.app);const other=await registerStudent(w.app);
    expect((await patch(s.jar,{role:'ADMIN',displayName:'Changed'})).status).toBe(400);
    expect((await patch(s.jar,{email:'new@example.test'})).status).toBe(400);
    expect((await patch(s.jar,{displayName:'x'})).status).toBe(400);
    const result=await patch(s.jar,{displayName:'اسم جديد'});expect(result.status).toBe(200);expect(result.body.data.user).toMatchObject({id:s.user.id,displayName:'اسم جديد',email:s.user.email,role:'STUDENT'});expect(JSON.stringify(result.body)).not.toContain('passwordHash');
    expect((await w.prisma.user.findUniqueOrThrow({where:{id:other.user.id}})).displayName).toBe(other.user.displayName);
  });
  it('rejects wrong current passwords without changing credentials or sessions',async()=>{
    const s=await registerStudent(w.app);const before=await w.prisma.user.findUniqueOrThrow({where:{id:s.user.id}});
    expect((await patch(s.jar,{currentPassword:'incorrect password',password:'new correct horse battery staple'})).status).toBe(401);
    expect((await w.prisma.user.findUniqueOrThrow({where:{id:s.user.id}})).passwordHash).toBe(before.passwordHash);
    expect((await request(w.app).get('/auth/me').set('Cookie',s.jar.header())).status).toBe(200);
  });
  it('changes the password atomically, retains this session and revokes other sessions only',async()=>{
    const s=await registerStudent(w.app);const oldHash=(await w.prisma.user.findUniqueOrThrow({where:{id:s.user.id}})).passwordHash;
    const second=await loginWith(w.app,s.user.email);const other=await registerStudent(w.app);
    const changed=await patch(s.jar,{currentPassword:TEST_PASSWORD,password:'new correct horse battery staple'});expect(changed.status).toBe(200);expect(changed.body.data.revoked).toBe(1);
    expect((await request(w.app).get('/auth/me').set('Cookie',s.jar.header())).status).toBe(200);
    expect((await request(w.app).get('/auth/me').set('Cookie',second.jar.header())).status).toBe(401);
    expect((await request(w.app).get('/auth/me').set('Cookie',other.jar.header())).status).toBe(200);
    expect((await loginWith(w.app,s.user.email)).status).toBe(401);
    expect((await loginWith(w.app,s.user.email,'new correct horse battery staple')).status).toBe(200);
    // A login that verified the old hash before the password transaction must
    // not establish a new session after that transaction commits.
    const timing=newSessionTiming(Date.now());
    await expect(createSessionFamily(w.prisma,{sessionId:timing.sessionId,userId:s.user.id,csrfHash:null,absoluteExpiresAt:timing.absoluteExpiresAt,refreshSecret:timing.refreshSecret,expectedPasswordHash:oldHash})).rejects.toMatchObject({code:'INVALID_CREDENTIALS'});
    expect(await w.prisma.authSession.findUnique({where:{id:timing.sessionId}})).toBeNull();
  });
  it('admits only one concurrent change against the same previous password',async()=>{
    const s=await registerStudent(w.app);const results=await Promise.all(['one','two'].map(tag=>patch(s.jar,{currentPassword:TEST_PASSWORD,password:`new correct horse battery staple ${tag}`})));
    expect(results.filter(r=>r.status===200)).toHaveLength(1);expect([401,409]).toContain(results.find(r=>r.status!==200)?.status);
  });
  it('protects a bounded, filtered student directory and exposes no credentials',async()=>{
    const s=await registerStudent(w.app);expect((await request(w.app).get('/admin/students').set('Cookie',s.jar.header())).status).toBe(403);
    const admin=await createTestAdmin(w,'Directory admin',TEST_PASSWORD);const a=await loginWith(w.app,admin.email);
    const prefix=`directory-${randomUUID()}`;await w.prisma.user.createMany({data:Array.from({length:23},(_,i)=>({email:`${prefix}-${i}@example.test`,phone:`${prefix}-${i}`,displayName:`${prefix} ${i}`,passwordHash:'test-only-no-login',role:'STUDENT' as const}))});
    const first=await request(w.app).get(`/admin/students?q=${prefix}`).set('Cookie',a.jar.header());expect(first.status).toBe(200);expect(first.body.data.students).toHaveLength(20);expect(first.body.data.nextCursor).toBeTruthy();
    const next=await request(w.app).get(`/admin/students?q=${prefix}&cursor=${first.body.data.nextCursor}`).set('Cookie',a.jar.header());expect(next.body.data.students).toHaveLength(3);expect(next.body.data.nextCursor).toBeNull();
    const ids=new Set(first.body.data.students.map((u:{id:string})=>u.id));expect(next.body.data.students.every((u:{id:string})=>!ids.has(u.id))).toBe(true);expect(JSON.stringify(first.body)).not.toContain('passwordHash');expect(JSON.stringify(first.body)).not.toContain('phone');
    expect((await request(w.app).get('/admin/students?cursor=invalid').set('Cookie',a.jar.header())).status).toBe(400);
  });
});
