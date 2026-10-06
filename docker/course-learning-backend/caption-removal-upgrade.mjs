/** Populated caption-removal upgrade in a separate disposable database only. */
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
export function verifyCaptionRemovalUpgrade({docker,project,server,compose}) {
 const run=(args,input)=>{const r=spawnSync(docker,args,{encoding:'utf8',input,maxBuffer:400000});if(r.status!==0)throw Error('Caption upgrade command failed (see isolated logs)');return r.stdout.trim();};
 const sql=text=>run([...compose,'exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','materials','-d','caption_upgrade_test','-At'],text);
 run([...compose,'exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','materials','-d','course_learning_test','-c','CREATE DATABASE caption_upgrade_test']);
 const prefix=['run','--rm','--label',`com.docker.compose.project=${project}`,'--network',`${project}_default`,'-e','DATABASE_URL=postgresql://materials:synthetic_materials_test_only@postgres:5432/caption_upgrade_test',server];
 // Change only the disposable image filesystem; all historical migrations stay intact in source.
 run([...prefix,'sh','-c','mv prisma/migrations/20261006230000_remove_lesson_captions /tmp/caption-removal-migration && npx prisma migrate deploy']);
 sql(`INSERT INTO "Course" (id,slug,"titleAr","titleEn","descriptionAr","descriptionEn","updatedAt") VALUES ('upgrade-course','caption-upgrade','Course','Course','Course','Course',now());
 INSERT INTO "CourseSection" (id,"courseId","titleAr","titleEn",position,"updatedAt") VALUES ('upgrade-section','upgrade-course','Section','Section',1,now());
 INSERT INTO "Lesson" (id,"sectionId","titleAr","titleEn",position,"updatedAt") VALUES ('upgrade-lesson','upgrade-section','Lesson','Lesson',1,now());
 INSERT INTO "LessonCaption" (id,"lessonId",language,"labelAr","labelEn","storageKey","byteSize","cueCount","updatedAt") VALUES ('caption-ar','upgrade-lesson','ar','Ar','Ar','captions/upgrade/ar',10,1,now()),('caption-en','upgrade-lesson','en','En','En','captions/upgrade/en',10,1,now());
 INSERT INTO "LessonResource" (id,"lessonId","labelAr","labelEn","fileName","mimeType","storageKey","byteSize","updatedAt") VALUES ('resource-kept','upgrade-lesson','File','File','kept.txt','text/plain','resources/upgrade/kept',4,now());
 INSERT INTO "MaterialObject" ("storageKey",state) VALUES ('captions/upgrade/ar','LIVE'),('captions/upgrade/orphan','PENDING'),('resources/upgrade/kept','LIVE');`);
 const snapshot=()=>sql(`SELECT md5(string_agg(to_jsonb(t)::text,',' ORDER BY id)) FROM "LessonResource" t UNION ALL SELECT md5(string_agg(to_jsonb(t)::text,',' ORDER BY id)) FROM "Course" t UNION ALL SELECT md5(string_agg(to_jsonb(t)::text,',' ORDER BY id)) FROM "Lesson" t;`);
 const before=snapshot();run([...prefix,'npx','prisma','migrate','deploy']);run([...prefix,'npx','prisma','migrate','deploy']);assert.equal(snapshot(),before,'Upgrade changed retained lesson files/course/lesson');
 assert.equal(sql(`SELECT (to_regclass('"LessonCaption"') IS NULL AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='CaptionState') AND (SELECT count(*) FROM "MaterialObject" WHERE state='DELETE')=3 AND (SELECT state FROM "MaterialObject" WHERE "storageKey"='resources/upgrade/kept')='LIVE')::text;`),'true');
 // Resource cleanup trigger must survive the caption table removal.
 sql(`DELETE FROM "LessonResource" WHERE id='resource-kept';`);assert.equal(sql(`SELECT state FROM "MaterialObject" WHERE "storageKey"='resources/upgrade/kept';`),'DELETE');
 console.log('PASS populated caption removal and repeat migration; durable caption cleanup, retained file fingerprints and resource trigger preserved');
}
