let context;
export function shelfSound(kind, enabled) {
  if(!enabled)return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    context.resume().catch(()=>{});
    const now=context.currentTime, duration=kind==='return'?.13:.22;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){const t=i/data.length;data[i]=(Math.random()*2-1)*Math.pow(1-t,kind==='return'?4:1.7);}
    const noise=context.createBufferSource(), filter=context.createBiquadFilter(), gain=context.createGain();
    noise.buffer=buffer;filter.type='bandpass';filter.frequency.value=kind==='return'?520:950;filter.Q.value=.8;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.065,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    noise.connect(filter);filter.connect(gain);gain.connect(context.destination);noise.start(now);noise.stop(now+duration);
    if(kind==='return'){const tap=context.createOscillator(), envelope=context.createGain();tap.frequency.setValueAtTime(180,now+.06);tap.frequency.exponentialRampToValueAtTime(70,now+.14);envelope.gain.setValueAtTime(.025,now+.06);envelope.gain.exponentialRampToValueAtTime(.001,now+.14);tap.connect(envelope);envelope.connect(context.destination);tap.start(now+.06);tap.stop(now+.15);}
  } catch {}
}
