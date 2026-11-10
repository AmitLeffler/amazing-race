// מנוע אודיו מתקדם - Web Audio API + SpeechSynthesis הפוך אותנטי
class GameAudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // תחנה 11: השמעה ממשית של "אופק 324" בסדר הפוך!
  playReverseSpeech() {
    this.init();

    // 1. השמעת פונמות הפוכות מדויקות בעברית (עַבְרַא מִיתָשׁ שׁוֹלַשׁ קְפוֹא = 4, 2, 3, ק-פ-ו-א)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // "עַבְרַא מִיתָשׁ שׁוֹלַשׁ קְפוֹא" - זה בדיוק היפוך הפונמות של "אופק שלוש שתיים ארבע"
      const utter = new SpeechSynthesisUtterance("עַבְרַא מִיתָשׁ שׁוֹלַשׁ קְפוֹא");
      utter.lang = "he-IL";
      utter.rate = 0.85;
      utter.pitch = 1.05;
      window.speechSynthesis.speak(utter);
    }

    // 2. אפקט סליל הקלטה הפוכה ברקע דרך Web Audio API
    if (this.ctx) {
      const ctx = this.ctx;
      const duration = 2.6;
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const sweep = Math.sin(2 * Math.PI * (180 + t * 40) * t);
        const tapeNoise = (Math.random() * 2 - 1) * 0.04;
        data[i] = (sweep * 0.2 + tapeNoise);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900;
      source.connect(filter);
      filter.connect(ctx.destination);
      source.start();
    }
  }

  // צלילים חדים, ברורים ומציאותיים לתחנה 16
  playMysterySound(type) {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;

    switch (type) {
      case "zipper": { // רוכסן - שיני פלסטיק ברורות ומהירות
        const count = 40;
        for (let i = 0; i < count; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = ctx.currentTime + i * 0.018;
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(1600 + i * 20, t);
          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.015);
        }
        break;
      }

      case "keyboard": { // מקלדת - תקתוק מקשים מכניים חדים
        for (let i = 0; i < 8; i++) {
          const t = ctx.currentTime + i * 0.085;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(950 + (i % 3) * 150, t);
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.04);
        }
        break;
      }

      case "buzzer": { // זמזם / באזר חשמלי חד וברור
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + 0.65);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.75);
        break;
      }

      case "glass": { // זכוכית מתנפצת
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(3400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
        break;
      }

      case "helicopter": { // הליקופטר / מסוק - להבים חובטים
        for (let i = 0; i < 22; i++) {
          const t = ctx.currentTime + i * 0.065;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(80, t);
          gain.gain.setValueAtTime(0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.045);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.055);
        }
        break;
      }

      case "thunder": { // ברק ורעם עמוק
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 1.2);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.35);
        break;
      }
    }
  }

  // צליל ניצחון והצלחה נעים (ללא חלון התראה מעצבן)
  playSuccessSound() {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + idx * 0.08;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  playIngredientUnlockSound() {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  // סינתסייזר ריקרול מלודי ואנרגטי
  playRickrollSynth(durationSeconds = 15) {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      // מנגינת Never Gonna Give You Up
      const notes = [
        { f: 349.23, d: 0.2 }, // F4
        { f: 392.00, d: 0.2 }, // G4
        { f: 466.16, d: 0.3 }, // Bb4
        { f: 392.00, d: 0.2 }, // G4
        { f: 587.33, d: 0.4 }, // D5
        { f: 587.33, d: 0.3 }, // D5
        { f: 523.25, d: 0.6 }, // C5
        { f: 0, d: 0.15 },
        { f: 349.23, d: 0.2 }, // F4
        { f: 392.00, d: 0.2 }, // G4
        { f: 466.16, d: 0.3 }, // Bb4
        { f: 392.00, d: 0.2 }, // G4
        { f: 523.25, d: 0.4 }, // C5
        { f: 523.25, d: 0.3 }, // C5
        { f: 466.16, d: 0.3 }, // Bb4
        { f: 440.00, d: 0.2 }, // A4
        { f: 392.00, d: 0.5 }, // G4
      ];

      let startTime = ctx.currentTime + 0.05;
      const loopCount = Math.ceil(durationSeconds / 4);
      for (let l = 0; l < loopCount; l++) {
        for (const n of notes) {
          if (startTime > ctx.currentTime + durationSeconds) break;
          if (n.f > 0) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(n.f, startTime);
            gain.gain.setValueAtTime(0.22, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.d - 0.03);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + n.d);
          }
          startTime += n.d;
        }
      }
    } catch (e) {
      console.warn("Rickroll synth error:", e);
    }
  }
}

window.gameAudio = new GameAudioEngine();
