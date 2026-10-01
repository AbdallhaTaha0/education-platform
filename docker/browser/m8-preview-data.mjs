// Run in Docker; output is mounted into the standalone read-only design preview.
import fs from 'node:fs';
const input = JSON.parse(fs.readFileSync('/input/demo-content.json'));
const courses = input.courses.map((c,n)=>({id:c.id ?? `demo-${n}`,slug:c.slug,titleAr:c.titleAr,titleEn:c.titleEn,descriptionAr:c.descriptionAr,descriptionEn:c.descriptionEn,publishedAt:null,academic:{grade:c.grade??null,academicYear:c.grade?'2026/2027':null,term:c.term??null,courseKind:c.courseKind??null,teachingMonth:c.teachingMonth??null},plans:[{id:`demo-plan-${n}`,currentPricePiastres:c.pricePiastres,previousPricePiastres:null,durationDays:c.durationDays,accessMode:c.accessMode??'DURATION',accessEndsAt:c.accessEndsAt??null}]}));
const published = courses.filter((c,n)=>input.courses[n].published!==false);
fs.writeFileSync('/out/catalog.json',JSON.stringify({data:{courses:published}}));
for(const course of published)fs.writeFileSync(`/out/${course.slug}.json`,JSON.stringify({data:{course}}));
const packages=(input.packages??[]).map(p=>({...p,version:1,available:true,courses:p.courseIds.map((id,n)=>{const index=courses.findIndex(c=>c.id===id);if(index<0)throw new Error('Unknown illustrative member');const c=courses[index];return{id:c.id,slug:c.slug,titleAr:c.titleAr,titleEn:c.titleEn,position:n+1,published:input.courses[index].published!==false,...c.academic};})}));
fs.writeFileSync('/out/packages.json',JSON.stringify({data:{packages}}));
for(const p of packages)fs.writeFileSync(`/out/package-${p.id}.json`,JSON.stringify({data:{package:p}}));
console.log(`Wrote ${published.length} illustrative read-only courses and ${packages.length} packages. No database or account data.`);
