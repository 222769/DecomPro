// Pointer lighting is presentation only. Keep keyboard and scanner interactions stable.
const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const surfaces='main > header, section.station, .stats > div, .dashboard-metrics > div, .dashboard-trolley, .collection-session-card';
let active=null;
let frame=0;
let pending=null;

function reset(){
 if(frame)cancelAnimationFrame(frame);
 frame=0;pending=null;
 if(active){
  active.removeAttribute('data-deep-tilt');
  for(const name of ['--deep-tilt-x','--deep-tilt-y','--deep-spot-x','--deep-spot-y','--deep-orb-x','--deep-orb-y'])active.style.removeProperty(name);
  active=null;
 }
}

document.addEventListener('pointermove',event=>{
 if(document.documentElement.dataset.themeVariant!=='deep'||!finePointer.matches||reducedMotion.matches||event.pointerType==='touch'){
  reset();return;
 }
 const surface=event.target instanceof Element?event.target.closest(surfaces):null;
 if(!surface||!surface.isConnected){reset();return;}
 if(surface!==active){reset();active=surface;surface.setAttribute('data-deep-tilt','');}
 pending={x:event.clientX,y:event.clientY};
 if(frame)return;
 frame=requestAnimationFrame(()=>{
  frame=0;
  if(!active||!active.isConnected||!pending)return;
  const rect=active.getBoundingClientRect();
  const x=Math.max(-1,Math.min(1,(pending.x-rect.left)/rect.width*2-1));
  const y=Math.max(-1,Math.min(1,(pending.y-rect.top)/rect.height*2-1));
  active.style.setProperty('--deep-tilt-x',`${(-y*2.8).toFixed(2)}deg`);
  active.style.setProperty('--deep-tilt-y',`${(x*3.6).toFixed(2)}deg`);
  active.style.setProperty('--deep-spot-x',`${Math.round((x+1)*50)}%`);
  active.style.setProperty('--deep-spot-y',`${Math.round((y+1)*50)}%`);
  active.style.setProperty('--deep-orb-x',`${(x*7).toFixed(1)}px`);
  active.style.setProperty('--deep-orb-y',`${(y*5).toFixed(1)}px`);
 });
},{passive:true});
document.addEventListener('pointerout',event=>{
 if(active&&!active.contains(event.relatedTarget))reset();
},{passive:true});
window.addEventListener('blur',reset);
reducedMotion.addEventListener('change',reset);
finePointer.addEventListener('change',reset);
new MutationObserver(()=>{if(document.documentElement.dataset.themeVariant!=='deep')reset();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme-variant']});
