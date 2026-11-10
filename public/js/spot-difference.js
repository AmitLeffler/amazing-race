// משחק מצא את ההבדלים ברמת קושי גבוהה ביותר - 10 הבדלים עדינים ומתוחכמים
class SpotTheDifferenceGame {
  constructor(canvasLeft, canvasRight, statusEl, onComplete) {
    this.canvasLeft = canvasLeft;
    this.canvasRight = canvasRight;
    this.statusEl = statusEl;
    this.onComplete = onComplete;
    this.differencesFound = new Set();

    // 10 הבדלים ברמת קושי שיא
    this.diffs = [
      { id: 1, x: 28, y: 14, r: 4.5, name: "החרט המוזהב בראש השעון העתיק" },
      { id: 2, x: 74, y: 15, r: 4.5, name: "נקודת ההשתקפות בעדשת הטלסקופ שבחלון" },
      { id: 3, x: 86, y: 39, r: 4.5, name: "קפל סרט הסימניה היורד מהספר במדף" },
      { id: 4, x: 22, y: 77, r: 4.5, name: "שן החריטה השנייה על גבי המפתח התלוי" },
      { id: 5, x: 62, y: 68, r: 4.5, name: "לולאת האדים העדינה מעל ספל המשקה" },
      { id: 6, x: 14, y: 32, r: 4.5, name: "להבה כפולה בפמוט הנר השמאלי" },
      { id: 7, x: 48, y: 56, r: 4.5, name: "בורג מוזהב נוסף בידית מגירת השולחן" },
      { id: 8, x: 38, y: 72, r: 4.5, name: "נקודת חותמת שעווה אדומה על הדף" },
      { id: 9, x: 69, y: 26, r: 4.5, name: "בריח מתכת נוסף במסגרת החלון" },
      { id: 10, x: 50, y: 88, r: 4.5, name: "טבעת חריטה מוזהבת בבסיס רגלית השולחן" }
    ];

    this.init();
  }

  init() {
    this.setupListeners(this.canvasLeft);
    this.setupListeners(this.canvasRight);
    this.render();
    this.updateStatus();
  }

  setupListeners(canvas) {
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      this.handleClick(xPct, yPct);
    });

    // תמיכה מלאה במגע בניידים
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const xPct = ((touch.clientX - rect.left) / rect.width) * 100;
      const yPct = ((touch.clientY - rect.top) / rect.height) * 100;
      this.handleClick(xPct, yPct);
    }, { passive: false });
  }

  handleClick(xPct, yPct) {
    for (const diff of this.diffs) {
      if (this.differencesFound.has(diff.id)) continue;
      const dist = Math.hypot(xPct - diff.x, yPct - diff.y);
      // טווח זיהוי מורחב במיוחד (4.8%) לנוחות מרבית בטאץ' בסמארטפונים
      if (dist <= diff.r + 4.8) {
        this.differencesFound.add(diff.id);
        if (window.gameAudio) window.gameAudio.playSuccessSound();
        this.render();
        this.updateStatus();
        if (this.differencesFound.size === this.diffs.length) {
          setTimeout(() => {
            if (this.onComplete) this.onComplete();
          }, 600);
        }
        return;
      }
    }
  }

  updateStatus() {
    if (this.statusEl) {
      const count = this.differencesFound.size;
      const total = this.diffs.length;
      const pct = (count / total) * 100;
      this.statusEl.innerHTML = `
        <div class="diff-counter" style="text-align: center; margin-bottom: 12px;" dir="rtl">
          <span style="font-weight: 900; color: #38bdf8; font-size: 1rem;">נמצאו: ${count} מתוך ${total} הבדלים</span>
          <div class="diff-progress-bar" style="width: 240px; height: 10px; background: #1e293b; border-radius: 9999px; margin: 8px auto; overflow: hidden; border: 1px solid #334155;">
            <div class="diff-progress-fill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #eab308, #22c55e); transition: width 0.3s;"></div>
          </div>
          ${count === total ? '<p style="color: #4ade80; font-weight: bold; margin-top: 4px;">🎉 מושלם! פיצחתם את כל 10 ההבדלים!</p>' : ''}
        </div>
      `;
    }
  }

  render() {
    this.drawScene(this.canvasLeft, false);
    this.drawScene(this.canvasRight, true);
  }

  drawScene(canvas, isRight) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    // קיר אחוזה עתיק
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#020617");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // טפט מורכב
    ctx.strokeStyle = "rgba(255,255,255,0.02)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h * 0.65);
      ctx.stroke();
    }

    // רצפת עץ
    const floorGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
    floorGrad.addColorStop(0, "#271206");
    floorGrad.addColorStop(1, "#120803");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h * 0.65, w, h * 0.35);

    // 1. פמוט נר שמאלי
    const candleX = w * 0.14, candleY = h * 0.35;
    ctx.fillStyle = "#854d0e";
    ctx.fillRect(candleX - 4, candleY, 8, 20);
    ctx.fillRect(candleX - 10, candleY + 18, 20, 4);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(candleX - 2, candleY - 8, 4, 8);
    // להבה
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(candleX, candleY - 11, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // הבדל 6: להבה כפולה עדינה בשמאל
    if (!isRight) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(candleX + 1.8, candleY - 12.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. חלון עם טלסקופ
    const winX = w * 0.65, winY = h * 0.08, winW = w * 0.22, winH = h * 0.35;
    ctx.fillStyle = "#020617";
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 3;
    ctx.strokeRect(winX, winY, winW, winH);

    // עדשת טלסקופ בחלון
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(w * 0.74, h * 0.15, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 2;
    ctx.stroke();

    // הבדל 2: השתקפות כפולה בעדשת הטלסקופ
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(w * 0.73, h * 0.14, 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (!isRight) {
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.16, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // הבדל 9: בריח מתכת קטן נוסף במסגרת החלון
    if (!isRight) {
      ctx.fillStyle = "#ca8a04";
      ctx.fillRect(winX + winW - 2.5, h * 0.26, 4, 8);
    }

    // 3. שעון עתיק
    const clockX = w * 0.28, clockY = h * 0.22;
    ctx.fillStyle = "#ca8a04";
    ctx.beginPath();
    ctx.arc(clockX, clockY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef9c3";
    ctx.beginPath();
    ctx.arc(clockX, clockY, 19, 0, Math.PI * 2);
    ctx.fill();

    // מחוגים
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX, clockY - 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + 11, clockY + 2);
    ctx.stroke();

    // הבדל 1: חרט מוזהב כפול בראש השעון
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.arc(clockX, clockY - 24, 3, 0, Math.PI * 2);
    ctx.fill();
    if (!isRight) {
      ctx.beginPath();
      ctx.arc(clockX + 3.5, clockY - 23, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. מדף ספרים
    const shelfX = w * 0.8, shelfY = h * 0.38;
    ctx.fillStyle = "#451a03";
    ctx.fillRect(shelfX, shelfY, w * 0.19, 7);

    // ספרים
    const bColors = ["#991b1b", "#1e40af", "#166534", "#6b21a8"];
    bColors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(shelfX + 4 + i * 11, shelfY - 24, 9, 24);
    });

    // הבדל 3: סרט סימנייה נופל מהספר השלישי
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.86, shelfY - 2);
    if (!isRight) {
      ctx.lineTo(w * 0.86, shelfY + 9);
    } else {
      ctx.lineTo(w * 0.88, shelfY + 8);
    }
    ctx.stroke();

    // 5. שולחן עבודה
    const deskX = w * 0.15, deskY = h * 0.62, deskW = w * 0.65, deskH = h * 0.28;
    ctx.fillStyle = "#5c2a12";
    ctx.fillRect(deskX, deskY, deskW, deskH);
    ctx.fillStyle = "#78350f";
    ctx.fillRect(deskX - 5, deskY - 6, deskW + 10, 8);

    // ידית מגירה
    const handleX = deskX + deskW * 0.5, handleY = deskY + 16;
    ctx.fillStyle = "#a16207";
    ctx.fillRect(handleX - 14, handleY, 28, 4);
    // הבדל 7: בורג מוזהב נוסף בידית המגירה
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(handleX - 11, handleY + 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (!isRight) {
      ctx.beginPath();
      ctx.arc(handleX + 11, handleY + 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // מפתח תלוי על דופן השולחן
    const keyX = w * 0.22, keyY = h * 0.77;
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.arc(keyX, keyY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(keyX - 1.2, keyY, 2.4, 9);
    ctx.fillRect(keyX - 1.2, keyY + 6, 4, 2);

    // הבדל 4: שן חריטה שנייה במפתח
    if (!isRight) {
      ctx.fillRect(keyX - 1.2, keyY + 3.5, 3.2, 1.8);
    }

    // דף מסמך על השולחן
    const paperX = w * 0.35, paperY = deskY + 4;
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(paperX, paperY, 26, 20);
    // הבדל 8: חותמת שעווה אדומה עם נקודה בשמאל
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.arc(paperX + 18, paperY + 14, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (!isRight) {
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(paperX + 18, paperY + 14, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // כוס משקה על השולחן
    const cupX = w * 0.62, cupY = h * 0.73;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(cupX - 6, cupY - 10, 12, 11);

    // הבדל 5: לולאת האדים מעל הספל
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cupX, cupY - 12);
    if (!isRight) {
      ctx.bezierCurveTo(cupX - 4, cupY - 18, cupX + 4, cupY - 22, cupX, cupY - 26);
    } else {
      ctx.quadraticCurveTo(cupX + 3, cupY - 19, cupX - 1, cupY - 26);
    }
    ctx.stroke();

    // רגלית שולחן
    const legX = deskX + deskW * 0.54, legY = deskY + deskH;
    ctx.fillStyle = "#451a03";
    ctx.fillRect(legX - 6, deskY + 24, 12, 42);
    // הבדל 10: טבעת חריטה מוזהבת בבסיס רגלית השולחן
    if (!isRight) {
      ctx.fillStyle = "#ca8a04";
      ctx.fillRect(legX - 6, h * 0.88, 12, 3);
    }

    // סימון הבדלים שנמצאו (מעגל זוהר אדום/ירוק)
    for (const diff of this.diffs) {
      if (this.differencesFound.has(diff.id)) {
        const cx = (diff.x / 100) * w;
        const cy = (diff.y / 100) * h;
        const rad = (diff.r / 100) * w;
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
        ctx.fill();
      }
    }
  }
}

window.SpotTheDifferenceGame = SpotTheDifferenceGame;
