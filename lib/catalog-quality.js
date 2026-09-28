'use strict';
const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
function luminance(hex) {
  const c = rgb(hex).map(n => { const v=n/255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4; });
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
// Keep the authored hue; move only the muted text toward its own foreground.
function readableTokens(tokens) {
  const t={...tokens}, start=rgb(t.textSec), end=rgb(t.text);
  for(let step=0;step<=100;step++) {
    const color='#'+start.map((n,i)=>Math.round(n+(end[i]-n)*step/100).toString(16).padStart(2,'0')).join('');
    if ([t.bg,t.card].every(bg=>contrast(color,bg)>=4.5)) { t.textSec=color; break; }
  }
  t.onAccent=contrast(t.accent,'#ffffff')>=contrast(t.accent,'#111111')?'#ffffff':'#111111';
  return t;
}
module.exports={contrast,readableTokens};
