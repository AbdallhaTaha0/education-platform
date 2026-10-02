import type { IdentityContext } from './service.js';
import { ApiError } from './errors.js';
import { normalizeDisplayName, rejectPrivilegeFields, validatePassword } from './validation.js';
import { hashPassword, verifyPassword } from './password.js';
import { toSafeUser } from './store.js';

export async function updateProfile(ctx: IdentityContext, userId:string, sessionId:string, raw:unknown) {
  rejectPrivilegeFields(raw);
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new ApiError(400,'VALIDATION_ERROR','Invalid profile.');
  const body=raw as Record<string,unknown>;
  if (Object.keys(body).some(k=>!['displayName','password','currentPassword'].includes(k))) throw new ApiError(400,'INVALID_FIELD','Only display name and password can be changed.');
  const displayName=body.displayName===undefined?undefined:normalizeDisplayName(body.displayName);
  const password=body.password===undefined?undefined:validatePassword(body.password);
  if(displayName===undefined && password===undefined) throw new ApiError(400,'VALIDATION_ERROR','No changes supplied.');
  const user=await ctx.prisma.user.findUnique({where:{id:userId}});
  if(!user)throw new ApiError(401,'SESSION_EXPIRED','Session expired.');
  if(password!==undefined && (typeof body.currentPassword!=='string' || body.currentPassword.length>256 || !await verifyPassword(user.passwordHash,body.currentPassword))) throw new ApiError(401,'INVALID_CREDENTIALS','Current password is incorrect.');
  const passwordHash=password===undefined?undefined:await hashPassword(password,ctx.auth.argon2);
  const now=new Date(ctx.clock?ctx.clock():Date.now());
  return ctx.prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const current=await tx.user.findUnique({where:{id:userId}});
    const session=await tx.authSession.findUnique({where:{id:sessionId}});
    if(!session || session.userId!==userId || session.revokedAt || session.absoluteExpiresAt<=now) throw new ApiError(401,'SESSION_EXPIRED','Session expired.');
    if(passwordHash!==undefined && current?.passwordHash!==user.passwordHash) throw new ApiError(409,'OFFER_CHANGED','Account changed. Retry with the current password.');
    const updated=await tx.user.update({where:{id:userId},data:{...(displayName===undefined?{}:{displayName}),...(passwordHash===undefined?{}:{passwordHash})}});
    const revoked=passwordHash===undefined?{count:0}:await tx.authSession.updateMany({where:{userId,id:{not:sessionId},revokedAt:null},data:{revokedAt:now,revokeReason:'password-change'}});
    return {user:toSafeUser(updated),revoked:revoked.count};
  });
}

export async function studentDirectory(ctx:IdentityContext, query:Record<string,unknown>) {
  const search=typeof query.q==='string'?query.q.trim():''; const after=typeof query.cursor==='string'?query.cursor:'';
  if(search.length>100 || (after && !/^[0-9a-f-]{36}$/i.test(after)))throw new ApiError(400,'VALIDATION_ERROR','Invalid search or cursor.');
  const students=await ctx.prisma.user.findMany({where:{role:'STUDENT',...(after?{id:{gt:after}}:{}),...(search?{OR:[{displayName:{contains:search,mode:'insensitive'}},{email:{contains:search,mode:'insensitive'}}]}:{})},orderBy:{id:'asc'},take:21,select:{id:true,displayName:true,email:true,createdAt:true}});
  return {students:students.slice(0,20),nextCursor:students.length>20?students[19]!.id:null};
}
