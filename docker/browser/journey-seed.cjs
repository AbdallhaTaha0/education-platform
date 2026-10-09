const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();
(async () => {
  const passwordHash = await argon2.hash('synthetic journey password 20261009', {memoryCost:8192,timeCost:2,parallelism:1});
  for (const [role,email,phone] of [['ADMIN','journey-admin@example.test','+201000000091'],['STUDENT','journey-student@example.test','+201000000092']]) {
    await prisma.user.upsert({where:{email},update:{},create:{role,email,phone,displayName:`Journey ${role}`,passwordHash}});
  }
  console.log('Two disposable journey accounts seeded.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
