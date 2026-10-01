// Only the owned M7 rehearsal DB; never the owner preview or external DRM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const r = createRequire('/srv/server/package.json');
const {PrismaClient} = r('@prisma/client');
const {purchaseCourse} = r('./dist/modules/wallet/purchase/service.js');
const {purchasePackage} = r('./dist/modules/wallet/purchase/packages.js');
const {createHash} = require('node:crypto');
assert.equal(process.env.M7_OWNED_DRILL,'1');
const db = new PrismaClient();
(async()=> {
  if(process.argv[2]==='purchase') {
    const f=JSON.parse(fs.readFileSync('/tmp/m8-final-fixtures.json'));
    const student=f.users.find(u=>u.role==='STUDENT').id;
    await purchaseCourse(db,student,{planId:f.plans[0].id,idempotencyKey:'m7-restore-course'});
    await purchasePackage(db,student,{packageId:f.packageIds[0],expectedVersion:1,idempotencyKey:'m7-restore-package'});
  }
  if (['purchase','proof'].includes(process.argv[2])) {
    const student=(await db.user.findFirstOrThrow({where:{role:'STUDENT'}})).id;
    const bytes=Buffer.from('%PDF-1.4\nsynthetic restore proof\n%%EOF');
    const hash=createHash('sha256').update(bytes).digest('hex');
    await db.rechargeRequest.create({data:{studentId:student,amountPiastres:1000,channel:'BANK_TRANSFER',referenceNorm:'M7RESTOREPROBE',senderName:'Synthetic',senderPhone:'01112345678',transferDate:new Date(),proofFilename:'synthetic.pdf',proofMime:'application/pdf',proofSize:bytes.length,proofHash:hash,idempotencyKey:'m7-restore-proof',proof:{create:{bytes,mime:'application/pdf',size:bytes.length,hash}}}});
  }
  assert.equal(await db.user.count(),2);
  assert.equal(await db.course.count(),4);
  const wallet=await db.wallet.findFirstOrThrow();
  assert.equal(wallet.balancePiastres,465000);
  const ledger=await db.walletLedgerEntry.aggregate({_sum:{amountPiastres:true}});
  assert.equal(ledger._sum.amountPiastres,465000);
  assert.equal(await db.purchase.count(),1);
  assert.equal(await db.packagePurchase.count(),1);
  assert.equal(await db.packagePurchaseItem.count(),3);
  assert.equal(await db.subscription.count({where:{expiresAt:null}}),1);
  const purchase=await db.purchase.findFirstOrThrow();
  assert.equal(purchase.accessMode,'UNTIL_REMOVAL');
  const bundle=await db.packagePurchase.findFirstOrThrow({include:{subscriptions:true}});
  assert.equal(bundle.subscriptions.length,3);
  assert(bundle.subscriptions.every(s=>s.expiresAt.getTime()===bundle.endsAt.getTime()));
  const proof=await db.rechargeProof.findFirstOrThrow();
  assert.equal(createHash('sha256').update(proof.bytes).digest('hex'),proof.hash);
  console.log('DATA_OK: users/catalog, exact wallet/ledger, indefinite snapshot, three package grants, private proof hash preserved.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
