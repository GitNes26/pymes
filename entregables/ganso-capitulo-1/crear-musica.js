const fs = require('fs');
const path = require('path');
const rate = 48000, duration = 60, channels = 2, frames = rate * duration;
const data = Buffer.alloc(frames * channels * 2);
const chords = [
  [110.00, 130.81, 164.81], [87.31, 110.00, 130.81],
  [130.81, 164.81, 196.00], [98.00, 123.47, 146.83]
];
const melody = [440, 493.88, 523.25, 659.25, 587.33, 523.25, 493.88, 440];
function env(t) { return Math.min(1, t / 2) * Math.min(1, (duration - t) / 3); }
for (let i = 0; i < frames; i++) {
  const t = i / rate;
  const chord = chords[Math.floor(t / 8) % chords.length];
  let pad = 0;
  chord.forEach((f, k) => {
    pad += Math.sin(2 * Math.PI * f * t + k * 0.7) * (0.11 - k * 0.018);
    pad += Math.sin(2 * Math.PI * f * 2 * t) * 0.018;
  });
  const beat = t % 1.5;
  const kick = beat < 0.16 ? Math.sin(2 * Math.PI * (70 - beat * 240) * beat) * Math.exp(-beat * 22) * 0.28 : 0;
  const pulse = Math.sin(2 * Math.PI * 2 * t) > 0.82 ? 0.025 * Math.sin(2 * Math.PI * 220 * t) : 0;
  const noteT = t % 4;
  const note = melody[Math.floor(t / 4) % melody.length];
  const lead = noteT < 1.1 ? Math.sin(2 * Math.PI * note * t) * Math.exp(-noteT * 2.2) * 0.055 : 0;
  const rise = t > 49 ? Math.sin(2 * Math.PI * (220 + (t - 49) * 18) * t) * ((t - 49) / 11) * 0.025 : 0;
  const master = env(t) * (pad + kick + pulse + lead + rise);
  const left = Math.max(-1, Math.min(1, master + 0.012 * Math.sin(2 * Math.PI * 0.17 * t)));
  const right = Math.max(-1, Math.min(1, master + 0.012 * Math.sin(2 * Math.PI * 0.19 * t + 1.2)));
  data.writeInt16LE(Math.round(left * 32767), i * 4);
  data.writeInt16LE(Math.round(right * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(channels, 22); header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * channels * 2, 28); header.writeUInt16LE(channels * 2, 32);
header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(__dirname, 'musica-original.wav'), Buffer.concat([header, data]));
console.log('Música original creada');
