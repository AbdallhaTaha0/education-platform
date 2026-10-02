import { useEffect, useRef, type RefObject } from 'react';

/** Keep background tasks out of the keyboard order while a focused editor is open. */
export function useFocusedWorkspace(active:boolean, ref:RefObject<HTMLElement>, close:()=>void):void {
  const current=useRef(close);current.current=close;
  useEffect(()=>{
    const root=ref.current;if(!active || !root)return;
    const previous=document.activeElement as HTMLElement|null; const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const siblings=new Map<HTMLElement,boolean>(); let element:HTMLElement=root;
    while(element.parentElement && element.parentElement!==document.body){for(const sibling of element.parentElement.children){if(sibling!==element && sibling instanceof HTMLElement){siblings.set(sibling,sibling.inert);sibling.inert=true;}}element=element.parentElement;}
    root.setAttribute('tabindex','-1');root.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();current.current();return;}
      if(event.key!=='Tab' || (event.target as HTMLElement)?.closest('[data-testid="error-feedback-stack"]'))return;
      const controls=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"],[contenteditable="true"]')].filter(e=>e.getClientRects().length && !e.closest('[inert]'));
      if(!controls.length){event.preventDefault();root.focus();return;} const first=controls[0]!,last=controls[controls.length-1]!;
      if(event.shiftKey && (document.activeElement===first || document.activeElement===root)){event.preventDefault();last.focus();}else if(!event.shiftKey && (document.activeElement===last || document.activeElement===root)){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;for(const [element,inert] of siblings)element.inert=inert;root.removeAttribute('tabindex');if(previous?.isConnected)previous.focus();};
  },[active,ref]);
}
