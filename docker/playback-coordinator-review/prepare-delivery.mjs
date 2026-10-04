// Prepare a coherent reviewed index without changing another worker's files.
// Run only on an empty index. Pending materials/schema changes stay in place.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
function git(args,input){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,input,encoding:'utf8',maxBuffer:12*1024*1024});assert.equal(r.status,0,r.error?.message||r.stderr);return r.stdout.trim();}
assert.equal(git(['diff','--cached','--name-only']),'','Preserve any pre-existing staged work');
const read=p=>readFileSync(resolve(root,p),'utf8').replaceAll('\r\n','\n');
function stageText(path,text){const hash=git(['hash-object','-w','--stdin'],text);git(['update-index','--add','--cacheinfo','100644',hash,path]);}
const trackedClient=git(['diff','--name-only','--','client']).split('\n').filter(Boolean).filter(p=>p!=='client/src/features/catalog/pages/LessonEditor.tsx'&&p!=='client/src/features/learning/pages/CourseLearningPage.tsx');
const paths=[...trackedClient,
  'client/src/features/ide/ide.css',
  'client/src/features/learning/components/CoursePlan.tsx',
  'client/src/features/learning/search','client/src/features/learning/devices','client/src/features/learning/sessions',
  'client/src/features/learning/hooks/device.ts','client/src/features/learning/hooks/device.test.ts',
  'client/src/features/learning/player/fullscreen.ts','client/src/features/learning/player/playRejection.ts','client/src/features/learning/player/playback-recovery.test.ts',
  'client/src/features/learning/materials/duration.ts','client/src/features/learning/materials/duration.test.ts',
  'server/src/app.ts','server/src/modules/catalog/drmClient.ts','server/src/modules/learning/errors.ts',
  'server/src/modules/learning/playback/service.ts','server/src/modules/learning/devices','server/src/modules/learning/sessions','server/src/modules/learning/routes/admin.ts',
  'server/tests/fixtures/drmFixture.ts','server/tests/integration/learning-helpers.ts','server/tests/integration/playback-recovery.test.ts','server/tests/integration/device-release-recovery-regressions.test.ts',
  'server/tests/unit/drm-client.test.ts','server/tests/unit/learning-playback.test.ts','server/tests/unit/playback-recovery.test.ts',
  'docker/playback-recovery-review','docker/playback-coordinator-review','docker/disabled-reasons',
  'docker/ide/compose.ui.yml','docker/ide/ui-review.mjs','docker/ide/course-flow.mjs','docker/ide/ide-polish.Dockerfile',
  'AGENTS.md','reports-and-markdown-files',
];
git(['add','--',...paths]);
let page=read('client/src/features/learning/pages/CourseLearningPage.tsx');
page=page.replace(/^import \{ CaptionControls, ResourcesPanel \}.*\n/m,'').replace(/^import \{ useLessonMaterials \}.*\n/m,'');
page=page.replace(/  \/\/ Lesson materials \(captions\/resources\)[\s\S]*?  const lessonMaterials = useLessonMaterials\(preselectedLessonId, accessLost\);\n\n/,'');
page=page.replace(/                captionUrls=\{lessonMaterials.captionUrls\}[\s\S]*?                onRetry=\{\(\) => void playback.start/,'                onRetry={() => void playback.start');
page=page.replace(/            \{selectedLesson !== null \? \(\n              <ResourcesPanel[\s\S]*?            \) : null\}\n/,'');
assert.ok(!/lessonMaterials|ResourcesPanel|CaptionControls|useLessonMaterials/.test(page));
stageText('client/src/features/learning/pages/CourseLearningPage.tsx',page);
let module=read('server/src/modules/learning/index.ts');
module=module.replace(/^import .*StorageClient.*\n/m,'').replace(/^import \{ createStorageClient \}.*\n/m,'').replace('  const storage = createStorageClient(deps.config);\n','').replace('    storage,\n','');
stageText('server/src/modules/learning/index.ts',module);
let routes=read('server/src/modules/learning/routes/index.ts');
routes=routes.replace(/^import \{ createMaterialsRouter \}.*\n/m,'').replace(/  \/\/ Mount materials sub-router \(captions \+ resources\)\n  router.use\('\/', createMaterialsRouter\(ctx\)\);\n\n/,'');
stageText('server/src/modules/learning/routes/index.ts',routes);
const schemaPath='server/src/modules/catalog/drm/schemas.ts';
const original=git(['show',`HEAD:${schemaPath}`]);
const additions=read(schemaPath).split('export interface ValidatedDeviceEntry')[1];
assert.ok(additions);stageText(schemaPath,original+'\n\nexport interface ValidatedDeviceEntry'+additions);
// Keep historical reports and worker files in the commit as records, but
// explicitly separate review evidence from delivered material functionality.
const tree=git(['write-tree']);
const exportDir=resolve(root,'docker/browser/evidence/playback-delivery-check');
mkdirSync(exportDir,{recursive:true});
const archive=resolve(root,'docker/browser/evidence/playback-delivery-check.tar');
git(['archive','--format=tar',`--output=${archive}`,tree]);
const unpack=spawnSync('C:/WINDOWS/system32/tar.exe',['-xf',archive,'-C',exportDir],{encoding:'utf8'});assert.equal(unpack.status,0,unpack.error?.message||unpack.stderr);
console.log(`Prepared reviewed index tree ${tree}; exported to ${exportDir}. Working files preserved; materials backend/schema/authoring remain unstaged.`);
