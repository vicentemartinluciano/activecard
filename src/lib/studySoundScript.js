// Síntesis Web Audio suave y cálida para feedback de estudio (web y puente WebView en Android).
// Frecuencias medias/cálidas con ataque suave (8ms) y caída exponencial sin clics.

export const SOUND_KINDS = ["flip", "good", "hard", "again", "complete"];

function scheduleTone(ctx, { freq, toFreq, delay = 0, duration = 0.12, gain = 0.1, type = "sine" }) {
  const start = ctx.currentTime + delay;
  const end = start + duration;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (toFreq && toFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(toFreq, end);
  }
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.01);
}

export function playSynthSound(ctx, kind) {
  if (!ctx || typeof ctx.createOscillator !== "function" || typeof ctx.createGain !== "function") {
    return false;
  }
  if (kind === "flip") {
    scheduleTone(ctx, { freq: 270, toFreq: 330, duration: 0.048, gain: 0.065, type: "sine" });
    return true;
  }
  if (kind === "good") {
    scheduleTone(ctx, { freq: 392.0, duration: 0.12, gain: 0.11, type: "sine" });
    scheduleTone(ctx, { freq: 493.88, delay: 0.055, duration: 0.15, gain: 0.12, type: "sine" });
    return true;
  }
  if (kind === "hard") {
    scheduleTone(ctx, { freq: 329.63, toFreq: 318, duration: 0.11, gain: 0.09, type: "triangle" });
    return true;
  }
  if (kind === "again") {
    scheduleTone(ctx, { freq: 293.66, duration: 0.09, gain: 0.085, type: "sine" });
    scheduleTone(ctx, { freq: 246.94, delay: 0.06, duration: 0.13, gain: 0.09, type: "sine" });
    return true;
  }
  if (kind === "complete") {
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      scheduleTone(ctx, {
        freq,
        delay: idx * 0.065,
        duration: idx === notes.length - 1 ? 0.28 : 0.16,
        gain: idx === notes.length - 1 ? 0.13 : 0.1,
        type: "sine",
      });
    });
    return true;
  }
  return false;
}

export const STUDY_SOUND_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:transparent">
<script>
(function(){
  var ctx = null;
  function getCtx(){
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!ctx) ctx = new C({ latencyHint: "interactive" });
    if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function(){});
    return ctx;
  }
  function tone(c, freq, toFreq, delay, dur, peak, type){
    var start = c.currentTime + delay;
    var end = start + dur;
    var osc = c.createOscillator();
    var amp = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (toFreq && toFreq !== freq) osc.frequency.exponentialRampToValueAtTime(toFreq, end);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(peak, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(amp);
    amp.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.01);
  }
  window.__acPlaySound = function(kind){
    var c = getCtx();
    if (!c) return;
    if (kind === "flip") tone(c, 270, 330, 0, 0.048, 0.065, "sine");
    else if (kind === "good") { tone(c, 392, 0, 0, 0.12, 0.11, "sine"); tone(c, 493.88, 0, 0.055, 0.15, 0.12, "sine"); }
    else if (kind === "hard") tone(c, 329.63, 318, 0, 0.11, 0.09, "triangle");
    else if (kind === "again") { tone(c, 293.66, 0, 0, 0.09, 0.085, "sine"); tone(c, 246.94, 0, 0.06, 0.13, 0.09, "sine"); }
    else if (kind === "complete") {
      [261.63, 329.63, 392, 523.25].forEach(function(f, i){
        tone(c, f, 0, i * 0.065, i === 3 ? 0.28 : 0.16, i === 3 ? 0.13 : 0.1, "sine");
      });
    }
  };
})();
</script>
</body>
</html>`;
