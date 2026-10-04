import { instrument } from './instrument';
import { createExecutionGuard } from './execution-budget';
import type { SourceFiles } from './types';

const safeJson = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c');
export function previewDocument(files: SourceFiles, runId: string, nonce: string, input = ''): string {
  const guard = `__fayq_${nonce.replace(/[^a-z0-9]/gi, '')}`;
  const code = instrument(files.javascript, guard);
  // The preview is opaque-origin, receives no credentials, and sends no grade.
  // Instrumentation is responsiveness defense, not an OS memory quota.
  const bootstrap = `(() => {
    const send = parent.postMessage.bind(parent), id=${safeJson(runId)};
    const doc = ${safeJson(files)};
    const inputLines=${safeJson(input)}.replace(/\\r\\n?/g,'\\n').split('\\n');if(inputLines[inputLines.length-1]==='')inputLines.pop();let inputIndex=0;
    Object.defineProperty(window,'readline',{value:()=>inputLines[inputIndex++],writable:false,configurable:false});
    const clock=performance.now.bind(performance), ErrorType=Error, schedule=setTimeout.bind(window);
    let lines=0;
    const guard=(${createExecutionGuard.toString()})(clock,reset=>schedule(reset,0),ErrorType);
    const log=(type,values)=>{if(++lines>100)return;let message;try{message=values.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ').slice(0,2000);}catch{message='[unprintable]';}send({type:'fayq-preview',runId:id,level:type,message},'*');};
    const compile=Function;
    const block=()=>{throw new ErrorType('Dynamic code and external resources are unavailable');};
    for(const proto of [Function.prototype,Object.getPrototypeOf(async function(){}),Object.getPrototypeOf(function*(){}),Object.getPrototypeOf(async function*(){})]) {try{Object.defineProperty(proto,'constructor',{value:block,writable:false,configurable:false});}catch{}}
    for(const name of ['eval','Function','Worker','SharedWorker','WebSocket','EventSource','fetch','XMLHttpRequest','open']) {try{Object.defineProperty(window,name,{value:block,writable:false,configurable:false});}catch{}}
    console.log=(...v)=>log('log',v);console.warn=(...v)=>log('warn',v);console.error=(...v)=>log('error',v);
    addEventListener('error',e=>log('error',[e.message]));addEventListener('unhandledrejection',()=>log('error',['Unhandled promise rejection']));
    document.currentScript.remove();
    // Tighten policy after the trusted bootstrap starts. A student can inspect
    // the original nonce/CSP; a second policy forbids every further script tag
    // even if it copies that nonce. Only the captured compiler is needed.
    const policy=document.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; script-src 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";document.head.append(policy);
    document.body.innerHTML=doc.html;
    const style=document.createElement('style');style.textContent=doc.css;document.head.append(style);
    try{compile(${safeJson(guard)},${safeJson(`"use strict";\n${code}`)})(guard);send({type:'fayq-preview',runId:id,level:'ready',message:''},'*');}
    catch(e){log('error',[e instanceof ErrorType?e.message:'Execution error']);}
  })();`;
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><script nonce="${nonce}">${bootstrap.replace(/<\//g, '<\\/')}</script></body></html>`;
}
