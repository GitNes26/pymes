const fs = require('fs'), path = require('path');
const rate=48000,duration=60,frames=rate*duration,data=Buffer.alloc(frames*4);
const chords=[[146.83,185,220],[130.81,164.81,196],[110,146.83,185],[123.47,155.56,196]];
const jarana=[293.66,369.99,440,369.99,329.63,293.66,246.94,293.66];
const clamp=x=>Math.max(-1,Math.min(1,x));
for(let i=0;i<frames;i++){
  const t=i/rate,ch=chords[Math.floor(t/7.5)%4];
  let pad=0; ch.forEach((f,k)=>{pad+=Math.sin(2*Math.PI*f*t+k)*(.065-k*.009);});
  const step=Math.floor(t*4)%8, phase=(t*4)%1, note=jarana[step];
  const pluck=(Math.sin(2*Math.PI*note*t)+.35*Math.sin(2*Math.PI*note*2*t))*Math.exp(-phase*7)*.09;
  const beat=t%1.5;
  const kick=beat<.14?Math.sin(2*Math.PI*(68-beat*210)*beat)*Math.exp(-beat*24)*.24:0;
  const clapPhase=(t+.75)%1.5;
  const clap=clapPhase<.05?(Math.sin(2*Math.PI*1600*t)+Math.sin(2*Math.PI*2300*t))*.035*Math.exp(-clapPhase*55):0;
  const water=Math.sin(2*Math.PI*.18*t)*.012;
  const rise=t>50?Math.sin(2*Math.PI*(180+(t-50)*16)*t)*((t-50)/10)*.02:0;
  const fade=Math.min(1,t/1.5)*Math.min(1,(duration-t)/2.5);
  const l=clamp((pad+pluck+kick+clap+water+rise)*fade);
  const rr=clamp((pad+pluck*.9+kick+clap*.8-water+rise)*fade);
  data.writeInt16LE(Math.round(l*32767),i*4); data.writeInt16LE(Math.round(rr*32767),i*4+2);
}
const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
fs.writeFileSync(path.join(__dirname,'musica-original.wav'),Buffer.concat([h,data]));console.log('Música creada');
