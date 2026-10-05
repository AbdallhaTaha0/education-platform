import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { patchBraces } from './patch-braces.mjs';
const require=createRequire(import.meta.url);
patchBraces({verifyOnly:true});
const braces=require('braces');
test('ordinary build globs and range expansion remain compatible',()=>{
  assert.deepEqual(braces.expand('./src/**/*.{ts,tsx}'), ['./src/**/*.ts','./src/**/*.tsx']);
  assert.deepEqual(braces.expand('x{1..3}'),['x1','x2','x3']);
  assert.equal(braces.compile('a/{b,c}/d'),'a/(b|c)/d');
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')),'a/{b,c}/d');
  patchBraces();patchBraces({verifyOnly:true});
});
for(const method of ['compile','expand','parse','stringify']){
  test(method+' rejects deep strings safely',()=>{
    for(const opener of ['{','(']){
      const input=opener.repeat(120)+'a'+(opener==='{'?'}':')').repeat(120);
      assert.throws(()=>braces[method](input), {name:'SyntaxError',message:/maximum depth/});
    }
  });
}
test('direct recursive AST walkers reject excessive child depth',()=>{
  for(const method of ['compile','expand','stringify']){
    let ast={type:'root',nodes:[]};
    const root=ast;
    for(let i=0;i<120;i++){const child={type:'brace',nodes:[],parent:ast};ast.nodes.push(child);ast=child;}
    assert.throws(()=>braces[method](root),{name:'SyntaxError',message:/maximum depth/});
  }
});
test('source tampering fails closed',()=>{
  const path=require.resolve('braces/lib/compile.js');
  const original=readFileSync(path,'utf8');
  try{writeFileSync(path,original+'\n// unexpected alteration\n');assert.throws(()=>patchBraces({verifyOnly:true}),/Unexpected/);}
  finally{writeFileSync(path,original);}
});

test('direct walkers reject a child-node self-cycle',()=>{
  for(const method of ['compile','expand','stringify']){
    const root={type:'root',nodes:[]};root.nodes.push(root);
    assert.throws(()=>braces[method](root),{name:'SyntaxError',message:/maximum depth/});
  }
});
