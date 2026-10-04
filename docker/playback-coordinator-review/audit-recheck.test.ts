import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createLearningWorld, type LearningWorld } from './learning-helpers.js';
import { releaseStudentDevice, reconcilePendingReleaseAudits } from '../../src/modules/learning/devices/service.js';

let world: LearningWorld;
beforeAll(async()=>{world=await createLearningWorld();});
afterAll(async()=>{await world?.fixture.stop();await world?.close();});
const rows=(ref:string,action:string)=>world.prisma.auditEvent.findMany({where:{entityId:world.studentId,action,metadata:{path:['deviceReference'],equals:ref}}});

it('reproduces a false release audit inferred from a truncated inspection',async()=>{
  const ref=randomUUID();
  world.fixture.seedDevice(world.studentId,ref,{status:'ACTIVE',activePlayback:false});
  await world.prisma.auditEvent.create({data:{actorUserId:world.adminUser.id,entityType:'User',entityId:world.studentId,action:'DEVICE_RELEASE_REQUESTED',metadata:{deviceReference:ref}}});
  const incomplete={inspectUserDevices:async()=>({devices:[],truncated:true,maxDevices:2})};
  await reconcilePendingReleaseAudits(world.prisma,incomplete as never,world.adminUser.id,world.studentId,world.studentId);
  expect(await rows(ref,'DEVICE_RELEASE')).toHaveLength(1);
  const real=await world.drm.inspectUserDevices(world.studentId);
  expect(real.devices.some(d=>d.reference===ref)).toBe(true);
  console.log('DEFECT: DEVICE_RELEASE recorded although reference still exists; absence in truncated result was treated as proof.');
});

it('reproduces reconciliation attributing admin A release to admin B',async()=>{
  const ref=randomUUID();
  world.fixture.seedDevice(world.studentId,ref,{status:'ACTIVE',activePlayback:false});
  const outage={...world.prisma,auditEvent:{...world.prisma.auditEvent,create:(args:any)=>args.data.action==='DEVICE_RELEASE'?Promise.reject(new Error('synthetic outcome outage')):world.prisma.auditEvent.create(args)}};
  const first=await releaseStudentDevice(outage as never,world.drm,world.adminUser.id,world.studentId,ref,Date.now());
  expect(first.auditPending).toBe(true);
  const adminB=await world.prisma.user.create({data:{displayName:'Synthetic reconciliation admin',email:`coordinator-${randomUUID()}@example.test`,phone:`019${Date.now()}`,passwordHash:'synthetic-unused-password-hash',role:'ADMIN'}});
  await reconcilePendingReleaseAudits(world.prisma,world.drm,adminB.id,world.studentId,world.studentId);
  const intent=(await rows(ref,'DEVICE_RELEASE_REQUESTED'))[0]!;
  const outcome=(await rows(ref,'DEVICE_RELEASE'))[0]!;
  expect(intent.actorUserId).toBe(world.adminUser.id);
  expect(outcome.actorUserId).toBe(adminB.id);
  console.log('DEFECT: reconciliation changes the recorded release actor from originating ADMIN A to reconciling ADMIN B.');
});

it('reproduces two successful outcome audits for simultaneous requests',async()=>{
  const ref=randomUUID();
  world.fixture.seedDevice(world.studentId,ref,{status:'ACTIVE',activePlayback:false});
  let intentReaders=0;
  let releaseReaders!:()=>void;
  const intentGate=new Promise<void>(resolve=>{releaseReaders=resolve;});
  let releaseFirstWrite!:()=>void;
  const outcomeGate=new Promise<void>(resolve=>{releaseFirstWrite=resolve;});
  const proxy={...world.prisma,auditEvent:{...world.prisma.auditEvent,
    findFirst:async(args:any)=>{
      const result=await world.prisma.auditEvent.findFirst(args);
      if(args.where?.metadata?.equals===ref && args.where.action==='DEVICE_RELEASE_REQUESTED' && result===null){
        intentReaders++;if(intentReaders===2)releaseReaders();await intentGate;
      }
      if(args.where?.metadata?.equals===ref && args.where.action==='DEVICE_RELEASE' && result===null)releaseFirstWrite();
      return result;
    },
    create:async(args:any)=>{
      if(args.data.action==='DEVICE_RELEASE' && args.data.metadata?.deviceReference===ref)await outcomeGate;
      return world.prisma.auditEvent.create(args);
    },
  }};
  await Promise.all([1,2].map(()=>releaseStudentDevice(proxy as never,world.drm,world.adminUser.id,world.studentId,ref,Date.now())));
  expect(await rows(ref,'DEVICE_RELEASE_REQUESTED')).toHaveLength(2);
  expect(await rows(ref,'DEVICE_RELEASE')).toHaveLength(2);
  console.log('DEFECT: scheduled concurrent reads produce two intent rows and two DEVICE_RELEASE outcomes for one external registration.');
},15000);

it('reproduces starvation of an older pending intent behind completed history',async()=>{
  const ref=randomUUID();
  await world.prisma.auditEvent.create({data:{actorUserId:world.adminUser.id,entityType:'User',entityId:world.studentId,action:'DEVICE_RELEASE_REQUESTED',metadata:{deviceReference:ref},createdAt:new Date(Date.now()-60000)}});
  for(let i=0;i<20;i++) {
    const completedRef=randomUUID();
    const createdAt=new Date(Date.now()+i*10);
    await world.prisma.auditEvent.create({data:{actorUserId:world.adminUser.id,entityType:'User',entityId:world.studentId,action:'DEVICE_RELEASE_REQUESTED',metadata:{deviceReference:completedRef},createdAt}});
    await world.prisma.auditEvent.create({data:{actorUserId:world.adminUser.id,entityType:'User',entityId:world.studentId,action:'DEVICE_RELEASE',metadata:{deviceReference:completedRef},createdAt:new Date(createdAt.getTime()+1)}});
  }
  const result=await reconcilePendingReleaseAudits(world.prisma,world.drm,world.adminUser.id,world.studentId,world.studentId);
  expect(result).toEqual({reconciled:0,stillPending:0});
  expect(await rows(ref,'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
  expect(await rows(ref,'DEVICE_RELEASE')).toHaveLength(0);
  console.log('DEFECT: latest 20 completed intents permanently hide older pending work, while sweep reports stillPending=0.');
});
