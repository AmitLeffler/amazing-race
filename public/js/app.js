// קליינט המירוץ למיליון - גרסה מעודכנת ומותאמת ל-17 תחנות ו-7 מצרכים
const socket = io();

let currentTeamState = null;
let currentStationData = null;
let userId = localStorage.getItem('race_user_id');
let userName = localStorage.getItem('race_user_name');
let teamId = localStorage.getItem('race_team_id');

if (!userId) {
  userId = 'usr_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('race_user_id', userId);
}

// אלמנטים גלובליים
const joinModal = document.getElementById('joinModal');
const teamSelect = document.getElementById('teamSelect');
const playerNameInput = document.getElementById('playerNameInput');
const btnJoin = document.getElementById('btnJoin');

const teamBadgeEl = document.getElementById('teamBadge');
const membersCountEl = document.getElementById('membersCount');
const stationsRemainingEl = document.getElementById('stationsRemaining');
const hintsUsedCountEl = document.getElementById('hintsUsedCount');
const liveAnsweredText = document.getElementById('liveAnsweredText');
const liveProgressDots = document.getElementById('liveProgressDots');
const ingredientsSlotsEl = document.getElementById('ingredientsSlots');
const ingredientsRatioText = document.getElementById('ingredientsRatio');

const stationTitleEl = document.getElementById('stationTitle');
const stationBadgeEl = document.getElementById('stationBadge');
const stationContentEl = document.getElementById('stationContent');

const ingredientModal = document.getElementById('ingredientModal');
const ingredientModalIcon = document.getElementById('ingredientModalIcon');
const ingredientModalTitle = document.getElementById('ingredientModalTitle');
const ingredientModalDesc = document.getElementById('ingredientModalDesc');
const btnCloseModal = document.getElementById('btnCloseModal');

const rickrollOverlay = document.getElementById('rickrollOverlay');
const rickrollTimerEl = document.getElementById('rickrollTimer');

let acknowledgedRulesForStation11 = false;
let rickrollTimerInterval = null;

// חיבור אוטומטי בהתחברות ראשונה ובכל reconnect
socket.on('connect', () => {
  if (teamId && userName) {
    socket.emit('join_team', { teamId, memberName: userName, userId });
  }
});

if (teamId && userName) {
  joinModal.classList.remove('active');
  socket.emit('join_team', { teamId, memberName: userName, userId });
} else {
  joinModal.classList.add('active');
}

btnJoin.addEventListener('click', () => {
  const selectedTeam = teamSelect.value;
  const name = playerNameInput.value.trim() || 'שחקן ' + Math.floor(Math.random() * 100);
  if (!selectedTeam) return;

  teamId = selectedTeam;
  userName = name;
  localStorage.setItem('race_team_id', teamId);
  localStorage.setItem('race_user_name', userName);

  joinModal.classList.remove('active');
  socket.emit('join_team', { teamId, memberName: userName, userId });
});

// עדכון נתוני תחנות בזמן אמת מהמנהל
socket.on('stations_config_updated', (updatedStations) => {
  if (Array.isArray(updatedStations)) {
    updatedStations.forEach(st => {
      const idx = STATIONS.findIndex(s => s.id === st.id);
      if (idx >= 0) {
        STATIONS[idx] = { ...STATIONS[idx], ...st };
      }
    });
    STATIONS.sort((a, b) => a.id - b.id);
    if (currentTeamState) updateUI(currentTeamState);
  }
});

// סנכרון מצב קבוצתי
socket.on('team_state_sync', (state) => {
  currentTeamState = state;
  updateUI(state);
});

// מעבר תחנה חלק (עם סאונד הצלחה)
socket.on('station_advanced', () => {
  if (window.gameAudio) window.gameAudio.playSuccessSound();
});

// אירוע פתיחת מצרך
socket.on('ingredients_unlocked_event', ({ ingredients }) => {
  if (ingredients && ingredients.length > 0) {
    showIngredientModal(ingredients[0]);
  }
});

// רמז נפתח
socket.on('hint_unlocked', ({ stationId, hint }) => {
  if (currentTeamState && currentTeamState.currentStationId === stationId) {
    currentTeamState.hintUnlocked = true;
    currentTeamState.hintText = hint;
    if (window.gameAudio) window.gameAudio.playSuccessSound();
    updateUI(currentTeamState);
  }
});

socket.on('hint_votes_updated', ({ stationId, count, needed }) => {
  if (currentTeamState && currentTeamState.currentStationId === stationId) {
    currentTeamState.hintVotesCount = count;
    if (needed) currentTeamState.hintVotesNeeded = needed;
    const voteBtnSpan = document.getElementById('hintVotesBadge');
    const totalMembers = Math.max(1, currentTeamState.membersCount || 1);
    const neededCount = currentTeamState.hintVotesNeeded || needed || Math.max(1, Math.ceil(totalMembers / 3));
    if (voteBtnSpan) voteBtnSpan.textContent = `${count} / ${neededCount} הצבעות`;
  }
});

// קבלת אירוע חסימת ריקרול
socket.on('sabotage_alert', ({ byTeam, type, durationSeconds }) => {
  triggerRickroll(durationSeconds || 15, type, byTeam);
});

// עדכון הצלחת שיגור חסימה לקבוצה יריבה
socket.on('sabotage_launched', ({ targetTeamId, message }) => {
  if (window.gameAudio) window.gameAudio.playSuccessSound();
  alert(message || `שיגרתם בהצלחה חסימת ריקרול לקבוצה ${targetTeamId}!`);
});

// עדכון הצבעות חסימה בלייב
socket.on('sabotage_votes_updated', (data) => {
  if (currentTeamState) {
    currentTeamState.sabotageVotes = data.votes || {};
    currentTeamState.sabotageTriggered = data.sabotageTriggered || false;
    currentTeamState.sabotageTarget = data.sabotageTarget || null;
    currentTeamState.sabotageHalfRequired = data.halfRequired || data.majorityRequired;
    const boardEl = document.getElementById('blockingBoardSlot');
    if (boardEl) {
      renderBlockingBoard(boardEl, currentTeamState);
    }
  }
});

// עדכון ממשק
function updateUI(state) {
  teamBadgeEl.textContent = state.teamName;
  membersCountEl.textContent = `${state.membersCount} מחוברים`;
  stationsRemainingEl.textContent = `${state.stationsRemaining} / ${state.totalSteps}`;

  if (hintsUsedCountEl) {
    const hintsCount = state.hintsUsedCount !== undefined ? state.hintsUsedCount : (state.unlockedHintsList ? state.unlockedHintsList.length : 0);
    hintsUsedCountEl.textContent = hintsCount;
  }

  renderIngredientsBar(state.unlockedIngredients);

  liveAnsweredText.textContent = `${state.answeredCount} / ${state.requiredCount}`;
  renderProgressDots(state.answeredCount, state.requiredCount);

  // בדיקת סיום המשחק
  if (state.isGameCompleted) {
    renderVictoryScreen();
    return;
  }

  const station = state.currentStation || STATIONS.find(s => s.id === state.currentStationId);
  if (station) {
    currentStationData = station;
    stationTitleEl.textContent = station.name;
    stationBadgeEl.textContent = station.badge || `תחנה ${station.id}`;
    renderStationContent(station, state);
  }
}

function renderIngredientsBar(unlockedIds) {
  ingredientsSlotsEl.innerHTML = '';
  if (ingredientsRatioText) {
    ingredientsRatioText.textContent = `${unlockedIds.length} / 7 מצרכים`;
  }
  INGREDIENTS.forEach((ing) => {
    const isUnlocked = unlockedIds.includes(ing.id);
    const slot = document.createElement('div');
    slot.className = `flex flex-col items-center p-2 rounded-xl min-w-[65px] transition-all cursor-pointer ${
      isUnlocked ? 'bg-slate-700 border border-yellow-400 shadow-md scale-105' : 'bg-slate-900 opacity-40'
    }`;
    slot.innerHTML = `
      <span class="text-2xl mb-1">${isUnlocked ? ing.icon : '❓'}</span>
      <span class="text-[11px] font-bold text-center">${isUnlocked ? ing.name : 'נעול'}</span>
    `;
    slot.addEventListener('click', () => {
      if (isUnlocked) showIngredientModal(ing);
    });
    ingredientsSlotsEl.appendChild(slot);
  });
}

function renderProgressDots(answered, required) {
  liveProgressDots.innerHTML = '';
  for (let i = 0; i < required; i++) {
    const dot = document.createElement('div');
    dot.className = `w-3 h-3 rounded-full transition-all ${
      i < answered ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-slate-700'
    }`;
    liveProgressDots.appendChild(dot);
  }
}

function showIngredientModal(ing) {
  ingredientModalIcon.textContent = ing.icon;
  ingredientModalTitle.textContent = ing.name;
  ingredientModalDesc.textContent = ing.desc;
  ingredientModal.classList.add('active');
  if (window.gameAudio) window.gameAudio.playIngredientUnlockSound();
}

btnCloseModal.addEventListener('click', () => {
  ingredientModal.classList.remove('active');
});

// שליחת תשובה לשרת
function submitAnswer(answerData) {
  if (!currentStationData || !currentTeamState) return;
  if (window.gameAudio) window.gameAudio.playSuccessSound();
  socket.emit('submit_answer', {
    teamId: currentTeamState.teamId,
    userId,
    stationId: currentStationData.id,
    answerData
  });
}

// מסך ניצחון וסיום המירוץ
function renderVictoryScreen() {
  stationTitleEl.textContent = '🏆 אלופי המירוץ למיליון! 🏆';
  stationBadgeEl.textContent = 'ניצחון ענק! 🎉';
  stationContentEl.innerHTML = `
    <div class="bg-gradient-to-b from-yellow-950/60 to-slate-900 p-8 rounded-3xl border-4 border-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.5)] text-center animate-fade-in" dir="rtl">
      <div class="text-7xl mb-4 animate-bounce">🏆🍫🎉</div>
      <h2 class="text-3xl sm:text-4xl font-black text-yellow-300 mb-3">כל הכבוד! סיימתם את המירוץ למיליון!</h2>
      <p class="text-slate-200 text-lg mb-6 leading-relaxed max-w-lg mx-auto">
        אספתם בהצלחה את כל 7 המצרכים לאורך כל התחנות:<br>
        <span class="font-bold text-yellow-400">🍪 פתיבר, 🧈 חמאה, 🍫 שוקולד, ☕ קקאו, 🥛 חלב, 🍬 סוכריות, 🥥 קוקוס!</span>
      </p>

      <div class="bg-slate-800 p-6 rounded-2xl border-2 border-yellow-500/70 max-w-md mx-auto mb-6 shadow-xl">
        <h4 class="text-xl font-bold text-white mb-2">המשימה הסופית:</h4>
        <p class="text-yellow-300 text-base font-black mb-3">גשו מיד אל המנחה להכנת כדורי השוקולד המנצחים!</p>
        <div class="inline-flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 px-3.5 py-1.5 rounded-xl text-amber-200 text-xs font-bold">
          <span>💡 סה"כ רמזים שנלקחו במירוץ:</span>
          <span class="text-yellow-400 font-black text-sm">${currentTeamState?.hintsUsedCount || (currentTeamState?.unlockedHintsList ? currentTeamState.unlockedHintsList.length : 0)}</span>
        </div>
      </div>

      <p class="text-xs text-slate-400">קבוצה מספר ${currentTeamState.teamName} – סיום רשמי</p>
    </div>
  `;
}

// רינדור תוכן התחנה
function renderStationContent(station, state) {
  const container = stationContentEl;
  container.innerHTML = '';

  // תחנת חסימה (תחנה 5) – מציגה את לוח ההצבעה ואישור המעבר
  if (state.isBlockingStation || station.id === 5 || station.type === 'blocking_station') {
    const slot = document.createElement('div');
    slot.id = 'blockingBoardSlot';
    slot.className = 'mb-6';
    container.appendChild(slot);
    renderBlockingBoard(slot, state, station);
    return;
  }

  const alreadyAnswered = state.answeredUsers && state.answeredUsers.includes(userId);

  if (alreadyAnswered) {
    const answeredBlock = document.createElement('div');
    answeredBlock.className = 'text-center py-12 bg-slate-800 rounded-2xl p-6 border border-slate-700';
    answeredBlock.dir = 'rtl';
    answeredBlock.innerHTML = `
      <div class="text-6xl mb-3 animate-bounce">👏🎉</div>
      <h3 class="text-2xl font-black text-green-400 mb-2">התשובה שלך נרשמה בהצלחה!</h3>
      <p class="text-slate-300 text-sm mb-6">ממתינים ששאר חברי הקבוצה יענו על מנת לעבור לתחנה הבאה...</p>
      <div class="inline-block bg-slate-900 p-5 rounded-xl border border-slate-700">
        <span class="text-3xl font-bold text-yellow-400">${state.answeredCount}</span>
        <span class="text-xl text-slate-500 mx-2">/</span>
        <span class="text-3xl font-bold text-white">${state.requiredCount}</span>
        <p class="text-xs text-slate-400 mt-1">חברי קבוצה שענו נכון עד כה</p>
      </div>
    `;
    container.appendChild(answeredBlock);
    return;
  }

  switch (station.type) {
    case 'admin_custom':
    case 'admin_custom_final':
      renderAdminCustom(container, station, state);
      break;
    case 'water_jugs':
      renderWaterJugs(container, station, state);
      break;
    case 'photo_verification':
      renderPhotoVerification(container, station, state);
      break;
    case 'triangle_color_choice':
      renderTriangleColorChoice(container, station, state);
      break;
    case 'spot_the_difference':
      renderSpotTheDifference(container, station, state);
      break;
    case 'movie_emojis':
      renderMovieEmojis(container, station, state);
      break;
    case 'reverse_audio':
      renderReverseAudio(container, station, state);
      break;
    case 'double_agent':
      renderDoubleAgent(container, station, state);
      break;
    case 'word_in_word':
      renderWordInWord(container, station, state);
      break;
    default:
      renderAdminCustom(container, station, state);
  }
}

// לוח חסימות וסבוטאז' קבוצתי (תחנת חסימה - הצבעה לכל קבוצה, ואישור מעבר של חצי מהקבוצה משגר ריקרול למובילה)
function renderBlockingBoard(slot, state, station) {
  if (!slot) return;
  const currentSt = station || state.currentStation || { id: 5, name: 'תחנת חסימה' };
  const myTeamId = String(teamId || (state && state.teamId) || '1');
  const votes = state.sabotageVotes || {};
  const voteCounts = {};
  Object.values(votes).forEach(tid => {
    voteCounts[tid] = (voteCounts[tid] || 0) + 1;
  });

  const totalMembers = Math.max(1, state.membersCount || 1);
  const halfRequired = state.sabotageHalfRequired || Math.max(1, Math.ceil(totalMembers / 2));
  const myVote = votes[userId] || null;
  const isTriggered = state.sabotageTriggered;
  const targetTeam = state.sabotageTarget;

  // מציאת הקבוצה שמובילה ברוב קולות כרגע
  let leadingTeam = null;
  let maxVotes = 0;
  for (const [t, cnt] of Object.entries(voteCounts)) {
    if (cnt > maxVotes) {
      maxVotes = cnt;
      leadingTeam = t;
    }
  }

  const advanceCount = state.answeredCount || 0;
  const hasApprovedAdvance = state.answeredUsers && state.answeredUsers.includes(userId);

  slot.innerHTML = `
    <div class="bg-gradient-to-r from-red-950/90 via-slate-900 to-red-950/90 p-5 sm:p-6 rounded-2xl border-2 border-red-500 shadow-2xl text-center" dir="rtl">
      ${currentSt.location ? `
        <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3.5 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍</span>
          <span>מיקום: ${currentSt.location}</span>
        </div>
      ` : ''}

      <div class="flex justify-center items-center gap-2 mb-2">
        <span class="text-3xl animate-bounce">🛑</span>
        <h3 class="text-xl sm:text-2xl font-black text-red-400">תחנת חסימה – הצבעה לקבוצה יריבה ואישור מעבר!</h3>
        <span class="text-3xl animate-bounce">⚡</span>
      </div>

      <p class="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mb-4 leading-relaxed">
        כל שחקן בקבוצה יכול להצביע לקבוצה יריבה אותה תרצו לחסום.
        ${isTriggered 
          ? `<span class="text-green-400 font-bold block mt-1">✓ התחנה הושלמה! ריקרול שוגר בהצלחה לקבוצה ${targetTeam}!</span>`
          : `<span class="text-yellow-300 font-bold block mt-1">בסוף, לאחר שלפחות חצי מהאנשים (${halfRequired} מתוך ${totalMembers}) יאשרו מעבר לתחנה הבאה – המערכת תשלח מיד ריק רול לקבוצה שנבחרה ברוב קולות ותעביר אתכם תחנה!</span>`
        }
      </p>

      ${leadingTeam ? `
        <div class="bg-red-900/60 border border-yellow-400/80 p-3 rounded-xl text-yellow-300 font-black text-xs sm:text-sm mb-4 max-w-md mx-auto shadow-lg animate-pulse flex items-center justify-center gap-2">
          <span class="text-lg">👑</span>
          <span>מובילה ברוב קולות לחטוף ריקרול: <strong>קבוצה ${leadingTeam}</strong> (${maxVotes} קולות)</span>
        </div>
      ` : `
        <div class="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl text-slate-300 text-xs mb-4 max-w-md mx-auto">
          🗳️ עדיין אין הצבעות – בחרו קבוצה יריבה לחסימה!
        </div>
      `}

      <!-- רשת כפתורי הצבעה לכל קבוצה -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto mb-6">
        ${[1, 2, 3, 4, 5, 6, 7, 8].filter(t => String(t) !== myTeamId).map(t => {
          const count = voteCounts[String(t)] || 0;
          const isMyPick = String(myVote) === String(t);
          const isLead = leadingTeam && String(leadingTeam) === String(t);
          return `
            <div class="p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-between gap-2 ${
              isMyPick
                ? 'bg-red-950/90 border-yellow-400 shadow-[0_0_15px_rgba(239,68,68,0.8)] scale-102'
                : (isLead ? 'bg-slate-800/90 border-red-500/70' : 'bg-slate-800/80 border-slate-700')
            }">
              <div class="flex items-center gap-1.5 font-black text-xs sm:text-sm text-white">
                <span>${isLead ? '👑' : '🎯'}</span>
                <span>קבוצה ${t}</span>
              </div>

              <span class="text-[11px] font-mono px-2 py-0.5 rounded-full ${count > 0 ? 'bg-red-600 text-white font-black' : 'bg-slate-700 text-slate-400'}">
                ${count} קולות
              </span>

              <button
                type="button"
                class="btn-vote-team w-full py-2 px-2 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md ${
                  isMyPick
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 ring-2 ring-yellow-300'
                    : 'bg-red-600/90 hover:bg-red-600 text-white active:scale-95'
                }"
                data-target="${t}"
              >
                <span>${isMyPick ? '✔️ ההצבעה שלך' : '🗳️ הצבע לקבוצה ' + t}</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- שלב 2: אישור מעבר לתחנה הבאה ושיגור הריקרול -->
      <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border-2 border-amber-500/80 text-center shadow-xl max-w-lg mx-auto">
        <div class="flex justify-center items-center gap-2 mb-1.5">
          <span class="text-2xl animate-bounce">🚀</span>
          <h4 class="text-base sm:text-lg font-black text-amber-300">אישור מעבר לתחנה הבאה ושיגור הריקרול</h4>
        </div>

        <p class="text-xs text-slate-300 mb-3 leading-relaxed">
          כשחצי מהאנשים בקבוצה (${halfRequired} מתוך ${totalMembers}) יאשרו מעבר,
          הקבוצה שקיבלה הכי הרבה קולות ${leadingTeam ? `(<strong>קבוצה ${leadingTeam}</strong>)` : ''} תחטוף מיד ריק רול ל-15 שניות, ואתם תעברו לתחנה הבאה!
        </p>

        <!-- פס התקדמות אישורים -->
        <div class="w-full max-w-xs mx-auto bg-slate-950 rounded-full h-2.5 mb-3 overflow-hidden border border-slate-700">
          <div class="bg-amber-400 h-full transition-all duration-300" style="width: ${Math.min(100, Math.round((advanceCount / halfRequired) * 100))}%"></div>
        </div>

        <button
          type="button"
          id="btnApproveAdvance"
          class="w-full max-w-md mx-auto py-3.5 px-6 rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
            hasApprovedAdvance
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/40 cursor-default'
              : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-yellow-500/50 animate-pulse'
          }"
        >
          <span>${hasApprovedAdvance ? `✔️ אישרת מעבר! ממתינים לחצי מהקבוצה (${advanceCount} / ${halfRequired})` : `🚀 לחצו כאן לאישור מעבר לתחנה הבאה (${advanceCount} / ${halfRequired})`}</span>
        </button>
        <p class="text-[11px] text-slate-400 mt-2">אושר עד כה על ידי ${advanceCount} מתוך ${halfRequired} שחקנים נדרשים (חצי מהקבוצה)</p>
      </div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  // הוספת רמז
  const hintSlot = slot.querySelector('#stationHintSlot');
  if (hintSlot) {
    renderHintWidget(hintSlot, currentSt, state);
  }

  // אירועי לחיצה על כפתור הצבעה לקבוצה
  slot.querySelectorAll('.btn-vote-team').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      socket.emit('vote_sabotage', {
        teamId: String(teamId || (state && state.teamId) || '1'),
        userId: userId,
        targetTeamId: target
      });
    });
  });

  // אירוע לחיצה על אישור מעבר לתחנה הבאה
  const approveBtn = slot.querySelector('#btnApproveAdvance');
  if (approveBtn) {
    approveBtn.addEventListener('click', () => {
      socket.emit('approve_advance', {
        teamId: String(teamId || (state && state.teamId) || '1'),
        userId: userId,
        stationId: currentSt.id
      });
    });
  }
}

// ווידג'ט רמז קבוצתי (נפתח בהצבעת לפחות שליש מחברי הקבוצה)
function renderHintWidget(slot, station, state) {
  if (!slot) return;
  const isUnlocked = state.hintUnlocked;
  const votesCount = state.hintVotesCount || 0;
  const totalMembers = Math.max(1, state.membersCount || 1);
  const needed = state.hintVotesNeeded || Math.max(1, Math.ceil(totalMembers / 3));
  const hintText = state.hintText || station.hint || '';

  if (isUnlocked) {
    slot.innerHTML = `
      <div class="bg-amber-950/80 border-2 border-amber-500 p-4 rounded-2xl text-right text-amber-200 text-sm font-bold shadow-lg mt-6" dir="rtl">
        <div class="flex items-center gap-2 mb-1 text-yellow-400 font-black text-base">
          <span>💡</span>
          <span>רמז שנחשף (אושר על ידי לפחות שליש מהקבוצה – ${needed} חברים):</span>
        </div>
        <p class="pr-6 text-slate-100 text-sm leading-relaxed">${hintText || 'אין רמז נוסף לתחנה זו.'}</p>
      </div>
    `;
  } else {
    slot.innerHTML = `
      <div class="bg-slate-900/80 border border-slate-700/80 p-3.5 rounded-2xl text-center mt-6" dir="rtl">
        <button id="btnVoteHint" class="bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/60 text-amber-300 font-bold py-2.5 px-5 rounded-xl text-sm transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer active:scale-95">
          <span>💡</span>
          <span>הצבע לפתיחת רמז קבוצתי</span>
          <span id="hintVotesBadge" class="bg-amber-900/80 px-2.5 py-0.5 rounded-full text-xs font-mono text-yellow-300 border border-amber-600/50 font-black">
            ${votesCount} / ${needed} הצבעות
          </span>
        </button>
        <p class="text-slate-400 text-[11px] mt-1.5">הרמז נחשף לכל הקבוצה כאשר לפחות שליש מהחברים מצביעים (${needed} מתוך ${totalMembers})</p>
      </div>
    `;

    const btn = document.getElementById('btnVoteHint');
    if (btn) {
      btn.addEventListener('click', () => {
        socket.emit('vote_hint', { stationId: station.id });
      });
    }
  }
}

// --- תחנות מנוהלות לפי דף מנהלים ---
function renderAdminCustom(container, station, state) {
  const isFinal = station.type === 'admin_custom_final';
  container.innerHTML = `
    <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-right" dir="rtl">
      ${station.location ? `
        <div class="mb-4 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3.5 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍</span>
          <span>מיקום התחנה: ${station.location}</span>
        </div>
      ` : ''}

      <h3 class="text-2xl font-bold text-yellow-300 mb-3">${station.name}</h3>

      <div class="bg-slate-900 p-5 rounded-xl border border-slate-700 text-slate-200 text-base leading-relaxed mb-6 font-medium whitespace-pre-wrap">
        ${station.question || 'הזינו את הקוד לפתיחת התחנה:'}
      </div>

      <div class="max-w-md mx-auto space-y-3">
        <input type="text" id="customCodeInput" class="w-full p-3.5 rounded-xl bg-slate-900 border-2 border-slate-600 text-white font-bold text-center text-xl" placeholder="הכניסו את הקוד הסודי...">
        <div id="customCodeErr" class="text-red-400 text-sm font-bold text-center hidden">קוד שגוי! נסו שוב.</div>
        <button id="btnSubmitCustomCode" class="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-3.5 rounded-xl shadow-lg transition-all text-lg">
          ${isFinal ? '🏆 אישור קוד הגמר של המירוץ!' : 'אישור קוד והמשך 🚀'}
        </button>
      </div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  const submitBtn = document.getElementById('btnSubmitCustomCode');
  const inputEl = document.getElementById('customCodeInput');
  const errEl = document.getElementById('customCodeErr');

  const handleCheck = () => {
    const val = inputEl.value.trim();
    if (!val) return;
    const cleanVal = val.toLowerCase().replace(/\s+/g, '');
    const valid = (station.validAnswers || [station.answer]).map(a => String(a).toLowerCase().replace(/\s+/g, ''));

    if (valid.includes(cleanVal) || (station.answer && cleanVal === String(station.answer).toLowerCase().replace(/\s+/g, ''))) {
      errEl.classList.add('hidden');
      submitAnswer({ code: val });
    } else {
      errEl.classList.remove('hidden');
      inputEl.classList.add('border-red-500');
      setTimeout(() => inputEl.classList.remove('border-red-500'), 1500);
    }
  };

  submitBtn.addEventListener('click', handleCheck);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCheck();
    }
  });
}

// תחנה 2: בקבוקי מים (עם אפשרות ריקון, מילוי ומזיגה)
function renderWaterJugs(container, station, state) {
  let jugs = [
    { capacity: 16, current: 16, name: "מיכל א' (16 ל')" },
    { capacity: 11, current: 0, name: "מיכל ב' (11 ל')" },
    { capacity: 6, current: 0, name: "מיכל ג' (6 ל')" }
  ];
  let selectedJug = null;

  function checkWin() {
    if (jugs.some(j => j.current === 7)) {
      if (window.gameAudio) window.gameAudio.playSuccessSound();
      setTimeout(() => {
        submitAnswer({ solved: true, result: 7 });
      }, 500);
      return true;
    }
    return false;
  }

  function renderGame() {
    container.innerHTML = `
      <div class="bg-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
        ${station.location ? `
          <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
            <span>📍 מיקום: ${station.location}</span>
          </div>
        ` : ''}
        <h3 class="text-2xl font-bold text-yellow-300 mb-2">${station.name}</h3>
        <p class="text-slate-300 mb-4 text-sm max-w-md mx-auto leading-relaxed">${station.question}</p>

        ${selectedJug !== null ? `
          <div class="bg-yellow-950/70 border border-yellow-500/80 p-2.5 rounded-xl text-yellow-300 text-xs font-bold mb-4 animate-pulse inline-block">
            💧 נבחר למזיגה: ${jugs[selectedJug].name} (${jugs[selectedJug].current} ל') — לחצו על מיכל יעד למזיגה
          </div>
        ` : ''}

        <div class="flex justify-center gap-3 sm:gap-5 mb-5 flex-wrap">
          ${jugs.map((j, i) => `
            <div class="flex flex-col items-center p-2.5 rounded-2xl bg-slate-900/90 border border-slate-700">
              <div class="jug-card w-20 sm:w-24 h-44 bg-slate-800 rounded-xl border-4 ${
                selectedJug === i ? 'border-yellow-400 scale-105 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : (j.current === 7 ? 'border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.8)]' : 'border-slate-600')
              } flex flex-col justify-end p-2 cursor-pointer transition-all relative overflow-hidden" data-index="${i}">
                <div class="bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-lg transition-all duration-300 w-full" style="height: ${(j.current / j.capacity) * 100}%"></div>
                <div class="absolute inset-0 flex items-center justify-center font-black text-lg text-white drop-shadow-md pointer-events-none">
                  ${j.current}L
                </div>
              </div>
              <span class="font-bold text-white text-xs sm:text-sm mt-2">${j.name}</span>
              <span class="text-[11px] text-cyan-400 font-mono font-bold mb-2">${j.current} / ${j.capacity} ל'</span>

              <div class="flex gap-1.5 w-full">
                <button class="btn-empty-jug flex-1 bg-red-950/70 hover:bg-red-800 border border-red-600 text-red-200 text-[11px] py-1.5 px-1 rounded-lg font-bold" data-index="${i}">
                  🗑️ רוקן
                </button>
                <button class="btn-fill-jug flex-1 bg-cyan-950/70 hover:bg-cyan-800 border border-cyan-600 text-cyan-200 text-[11px] py-1.5 px-1 rounded-lg font-bold" data-index="${i}">
                  🚰 מלא
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <p class="text-xs text-slate-400 mb-4">לחצו על מיכל כדי למזוג ממנו למיכל אחר, או השתמשו בכפתורי הריקון והמילוי.</p>

        <div class="flex justify-center gap-3 mb-6">
          <button id="btnResetJugs" class="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-6 rounded-xl text-xs sm:text-sm shadow-md">איפוס למצב התחלתי 🔄</button>
        </div>

        <div id="stationHintSlot"></div>
      </div>
    `;

    renderHintWidget(document.getElementById('stationHintSlot'), station, state);

    container.querySelectorAll('.jug-card').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'));
        if (selectedJug === null) {
          if (jugs[idx].current > 0) {
            selectedJug = idx;
            renderGame();
          }
        } else {
          if (selectedJug !== idx) {
            pour(selectedJug, idx);
          }
          selectedJug = null;
          renderGame();
        }
      });
    });

    container.querySelectorAll('.btn-empty-jug').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'));
        jugs[idx].current = 0;
        selectedJug = null;
        if (!checkWin()) renderGame();
      });
    });

    container.querySelectorAll('.btn-fill-jug').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'));
        jugs[idx].current = jugs[idx].capacity;
        selectedJug = null;
        if (!checkWin()) renderGame();
      });
    });

    document.getElementById('btnResetJugs').addEventListener('click', () => {
      jugs = [
        { capacity: 16, current: 16, name: "מיכל א' (16 ל')" },
        { capacity: 11, current: 0, name: "מיכל ב' (11 ל')" },
        { capacity: 6, current: 0, name: "מיכל ג' (6 ל')" }
      ];
      selectedJug = null;
      renderGame();
    });
  }

  function pour(fromIdx, toIdx) {
    const from = jugs[fromIdx];
    const to = jugs[toIdx];
    const availableSpace = to.capacity - to.current;
    const amountToPour = Math.min(from.current, availableSpace);

    from.current -= amountToPour;
    to.current += amountToPour;

    checkWin();
  }

  renderGame();
}

// תחנה 4: תמונה אנושית בריטניה
function renderPhotoVerification(container, station, state) {
  container.innerHTML = `
    <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
      ${station.location ? `
        <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍 מיקום: ${station.location}</span>
        </div>
      ` : ''}
      <h3 class="text-2xl font-bold text-yellow-300 mb-2">${station.name}</h3>
      <p class="text-slate-300 mb-6 text-sm max-w-md mx-auto leading-relaxed">${station.question}</p>

      <div class="max-w-md mx-auto space-y-3">
        <input type="text" id="photoCodeInput" class="w-full p-3.5 rounded-xl bg-slate-900 border-2 border-slate-600 text-white font-bold text-center text-xl" placeholder="הכניסו את הקוד שקיבלתם מהמנחה...">
        <div id="photoCodeErr" class="text-red-400 text-sm font-bold text-center hidden">קוד שגוי! קבלו את הקוד הנכון מהמנחה.</div>
        <button id="btnSubmitPhotoCode" class="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-3.5 rounded-xl shadow-lg">אישור קוד 📸</button>
      </div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  document.getElementById('btnSubmitPhotoCode').addEventListener('click', () => {
    const val = document.getElementById('photoCodeInput').value.trim();
    const clean = val.toLowerCase().replace(/\s+/g, '');
    const valid = (station.validAnswers || [station.answer]).map(a => String(a).toLowerCase().replace(/\s+/g, ''));
    if (valid.includes(clean)) {
      submitAnswer({ code: val });
    } else {
      document.getElementById('photoCodeErr').classList.remove('hidden');
    }
  });
}

// תחנה 7: צומת הצבעים - משולשי ההיגיון
function renderTriangleColorChoice(container, station, state) {
  let chosenOption = null;

  container.innerHTML = `
    <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
      ${station.location ? `
        <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍 מיקום: ${station.location}</span>
        </div>
      ` : ''}

      <h3 class="text-2xl font-black text-yellow-300 mb-2">${station.name}</h3>
      <p class="text-slate-300 mb-5 text-sm max-w-lg mx-auto leading-relaxed font-medium">
        ${station.question}
      </p>

      <!-- תמונת החידה עם סימון בעיגול אדום זוהר על המשולש האמצעי (ללא שום רמז לצבע) -->
      <div class="relative inline-block mx-auto mb-6 rounded-2xl overflow-hidden border-2 border-slate-600 shadow-2xl max-w-full">
        <img src="/images/guess_the_colors.png" alt="Guess The Colors" class="max-w-full h-auto block mx-auto max-h-[440px]" />
        
        <!-- עיגול אדום זוהר על המשולש האמצעי של סימן השאלה בתחתית -->
        <div class="absolute bottom-[9.5%] left-1/2 -translate-x-1/2 w-[76px] h-[76px] pointer-events-none rounded-full border-4 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.95),inset_0_0_20px_rgba(239,68,68,0.7)] animate-pulse">
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-950/95 text-red-300 text-[11px] font-black px-3 py-0.5 rounded-full border border-red-500 whitespace-nowrap shadow-md">
            ⭕ המשולש האמצעי
          </div>
        </div>
      </div>

      <div class="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-700 mb-6 max-w-md mx-auto text-right">
        <p class="text-yellow-400 font-bold text-sm mb-3">📌 מהו הצבע הנכון במשולש האמצעי המסומן?</p>
        <div class="grid grid-cols-2 gap-3">
          <button class="btn-color-pick p-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-white shadow-lg text-base transition-all" data-id="green">
            🟢 ירוק
          </button>
          <button class="btn-color-pick p-3.5 bg-purple-700 hover:bg-purple-600 rounded-xl font-black text-white shadow-lg text-base transition-all" data-id="purple">
            🟣 סגול
          </button>
          <button class="btn-color-pick p-3.5 bg-pink-600 hover:bg-pink-500 rounded-xl font-black text-white shadow-lg text-base transition-all" data-id="pink">
            🌸 ורוד
          </button>
          <button class="btn-color-pick p-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-white shadow-lg text-base transition-all" data-id="blue">
            🔵 כחול
          </button>
        </div>
      </div>

      <div id="trapDestCard" class="hidden bg-slate-900 p-5 rounded-xl border border-slate-700 max-w-md mx-auto text-right mb-4">
        <p id="destMsgText" class="text-yellow-400 font-bold mb-3 text-sm leading-relaxed whitespace-pre-line"></p>
        <input type="text" id="trapCodeInput" class="w-full p-3 rounded-xl bg-slate-800 border-2 border-slate-600 text-white font-bold text-center mb-3 text-lg" placeholder="הכניסו את הקוד שתמצאו שם...">
        <button id="btnSubmitTrap" class="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-3 rounded-xl shadow-lg">אישור קוד 🎯</button>
      </div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  container.querySelectorAll('.btn-color-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const optId = btn.getAttribute('data-id');
      chosenOption = station.options.find(o => o.id === optId);
      document.getElementById('destMsgText').textContent = chosenOption.locationMsg;
      document.getElementById('trapDestCard').classList.remove('hidden');
      document.getElementById('trapCodeInput').focus();
    });
  });

  document.getElementById('btnSubmitTrap').addEventListener('click', () => {
    const code = document.getElementById('trapCodeInput').value.trim();
    if (!code) return;

    if (code.toLowerCase() === station.answer.toLowerCase() && chosenOption?.isCorrect) {
      submitAnswer({ code, option: chosenOption.id });
    } else {
      triggerRickroll(15, 'station8_trap');
    }
  });
}

// תחנה 8: מצא את ההבדלים (10 הבדלים ברמת קושי שיא)
function renderSpotTheDifference(container, station, state) {
  container.innerHTML = `
    <div class="bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
      ${station.location ? `
        <div class="mb-2 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍 מיקום: ${station.location}</span>
        </div>
      ` : ''}
      <h3 class="text-2xl font-bold text-yellow-300 mb-2">${station.name}</h3>
      <p class="text-slate-300 mb-4 text-sm max-w-lg mx-auto leading-relaxed">${station.question}</p>

      <div id="spotDiffStatus"></div>

      <div class="flex flex-col md:flex-row justify-center items-center gap-3 sm:gap-4 mb-4">
        <canvas id="canvasDiffLeft" width="360" height="280" class="rounded-xl border-2 border-slate-600 shadow-xl max-w-full touch-none"></canvas>
        <canvas id="canvasDiffRight" width="360" height="280" class="rounded-xl border-2 border-slate-600 shadow-xl max-w-full touch-none"></canvas>
      </div>

      <p class="text-xs text-slate-400 mb-2">לחצו ישירות על ההבדל באחת משתי התמונות (בנייד ניתן לגעת במסך).</p>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  const canvasLeft = document.getElementById('canvasDiffLeft');
  const canvasRight = document.getElementById('canvasDiffRight');
  const statusEl = document.getElementById('spotDiffStatus');

  new SpotTheDifferenceGame(canvasLeft, canvasRight, statusEl, () => {
    submitAnswer({ spotDiffSolved: true });
  });
}

// תחנה 9: 10 סרטים ספציפיים שהוגדרו
function renderMovieEmojis(container, station, state) {
  let solvedMovies = [];

  container.innerHTML = `
    <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-right" dir="rtl">
      ${station.location ? `
        <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍 מיקום: ${station.location}</span>
        </div>
      ` : ''}
      <h3 class="text-2xl font-bold text-yellow-300 mb-2 text-center">${station.name}</h3>
      <p class="text-slate-300 mb-4 text-sm text-center">${station.question}</p>
      
      <div class="text-center font-bold text-yellow-400 mb-4" id="movieCounterText">
        נפתרו: 0 מתוך ${station.movies.length} (דרוש לפחות ${station.requiredCount})
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-6">
        ${station.movies.map(m => `
          <div class="movie-card bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col justify-between" id="movieCard_${m.id}">
            <div class="text-2xl mb-2 text-center select-none tracking-widest">${m.emojis}</div>
            <div class="flex gap-2">
              <input type="text" class="movie-input w-full p-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm font-bold text-center" placeholder="שם הסרט..." data-id="${m.id}">
              <button class="btn-check-movie bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-3 rounded-lg text-sm" data-id="${m.id}">✓</button>
            </div>
            <div class="movie-solved-tag hidden mt-2 text-center text-xs font-bold text-green-400">✓ נפתר בהצלחה!</div>
          </div>
        `).join('')}
      </div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  function checkMovie(mId) {
    if (solvedMovies.includes(mId)) return;
    const card = document.getElementById(`movieCard_${mId}`);
    const input = card.querySelector('.movie-input');
    const guess = input.value.trim().toLowerCase().replace(/['"״]/g, '');
    const movie = station.movies.find(m => m.id === mId);

    const isMatch = movie.answers.some(ans => {
      const cleanAns = ans.toLowerCase().replace(/['"״]/g, '');
      return guess === cleanAns || guess.includes(cleanAns) || cleanAns.includes(guess);
    });

    if (isMatch && guess.length > 1) {
      solvedMovies.push(mId);
      input.disabled = true;
      input.classList.add('bg-green-950', 'border-green-500', 'text-green-300');
      card.querySelector('.btn-check-movie').classList.add('hidden');
      card.querySelector('.movie-solved-tag').classList.remove('hidden');

      const counter = document.getElementById('movieCounterText');
      counter.textContent = `נפתרו: ${solvedMovies.length} מתוך ${station.movies.length} (דרוש לפחות ${station.requiredCount})`;

      if (window.gameAudio) window.gameAudio.playSuccessSound();

      if (solvedMovies.length >= station.requiredCount) {
        setTimeout(() => {
          submitAnswer({ solvedMovies });
        }, 500);
      }
    } else {
      input.classList.add('border-red-500');
      setTimeout(() => input.classList.remove('border-red-500'), 1500);
    }
  }

  container.querySelectorAll('.btn-check-movie').forEach(btn => {
    btn.addEventListener('click', () => {
      const mId = parseInt(btn.getAttribute('data-id'));
      checkMovie(mId);
    });
  });

  container.querySelectorAll('.movie-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const mId = parseInt(input.getAttribute('data-id'));
        checkMovie(mId);
      }
    });
  });
}

// תחנה 10: הקלטה הפוכה של אופק324 בלי לציין כלום בשאלה
function renderReverseAudio(container, station, state) {
  container.innerHTML = `
    <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
      ${station.location ? `
        <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
          <span>📍 מיקום: ${station.location}</span>
        </div>
      ` : ''}

      <h3 class="text-2xl font-bold text-yellow-300 mb-3">${station.name}</h3>
      <p class="text-slate-300 mb-6 text-sm max-w-md mx-auto leading-relaxed">${station.question}</p>

      <div class="bg-slate-900 p-8 rounded-xl flex justify-center mb-6 border border-slate-700 max-w-sm mx-auto shadow-inner">
        <button id="btnPlayReverse" class="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg flex items-center gap-3 transition-all hover:scale-105">
          <span>הפעל הקלטה מסתורית</span>
          <span class="text-2xl">🔊</span>
        </button>
      </div>

      <div class="max-w-sm mx-auto space-y-3">
        <input type="text" id="reverseInput" class="w-full p-3.5 rounded-xl bg-slate-900 border-2 border-slate-600 text-white font-bold text-center text-xl" placeholder="הכניסו את הקוד...">
        <div id="reverseErrMsg" class="text-red-400 text-sm font-bold text-center hidden">קוד שגוי! האזינו שוב בריכוז.</div>
        <button id="btnSubmitReverse" class="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-3.5 rounded-xl shadow-lg text-lg">
          אישור קוד 🎧
        </button>
      </div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  document.getElementById('btnPlayReverse').addEventListener('click', () => {
    if (window.gameAudio) window.gameAudio.playReverseSpeech();
  });

  const handleCheck = () => {
    const val = document.getElementById('reverseInput').value.trim();
    const clean = val.toLowerCase().replace(/\s+/g, '');
    const valid = (station.validAnswers || [station.answer]).map(a => String(a).toLowerCase().replace(/\s+/g, ''));
    if (valid.includes(clean)) {
      document.getElementById('reverseErrMsg').classList.add('hidden');
      submitAnswer({ code: val });
    } else {
      document.getElementById('reverseErrMsg').classList.remove('hidden');
    }
  };

  document.getElementById('btnSubmitReverse').addEventListener('click', handleCheck);
  document.getElementById('reverseInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCheck();
  });
}

// תחנה 11: הסוכן הכפול
function renderDoubleAgent(container, station, state) {
  if (!acknowledgedRulesForStation11) {
    container.innerHTML = `
      <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
        ${station.location ? `
          <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
            <span>📍 מיקום: ${station.location}</span>
          </div>
        ` : ''}
        <div class="text-6xl mb-3">🕵️‍♂️ 🤐</div>
        <h3 class="text-2xl font-black text-yellow-300 mb-3">${station.name}</h3>
        <div class="bg-slate-900 p-5 rounded-xl border border-slate-700 text-slate-300 text-sm leading-relaxed mb-6 max-w-md mx-auto text-right space-y-2">
          <p>• כל אחד מחברי הקבוצה מקבל כעת מילה סודית במסך האישי שלו.</p>
          <p>• <strong class="text-red-400">אחד מכם הוא הסוכן הכפול</strong> שקיבל מילה שונה במקצת – אך הוא אינו יודע זאת!</p>
          <p>• <strong>מהלך המשחק:</strong> כל שחקן אומר בתורו רמז אסוציאטיבי בן מילה אחת בלבד על המילה שלו.</p>
          <p>• <strong>מטרת הקבוצה:</strong> לנהל דיון, להצביע ולחשוף מי הסוכן הכפול!</p>
        </div>
        <button id="btnAcknowledgeRules" class="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black text-lg py-4 px-8 rounded-xl shadow-lg">
          הבנו את החוקים, חשוף את המילים! 🔍
        </button>
      </div>
    `;

    document.getElementById('btnAcknowledgeRules').addEventListener('click', () => {
      acknowledgedRulesForStation11 = true;
      renderDoubleAgent(container, station, state);
    });
    return;
  }

  const isSpy = state.doubleAgentUserId === userId;
  const word = isSpy ? "שף" : "מורה";

  let membersHtml = state.membersList.map(name => `
    <button class="btn-vote-spy p-3.5 bg-slate-900 hover:bg-slate-700 rounded-xl font-bold text-white border border-slate-700 transition-all text-sm" data-name="${name}">
      ${name}
    </button>
  `).join('');

  container.innerHTML = `
    <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
      <h3 class="text-2xl font-bold text-yellow-300 mb-2">${station.name}</h3>
      <p class="text-slate-300 mb-6 text-sm">המילה הסודית שלך היא:</p>

      <div class="bg-slate-900 p-6 rounded-2xl border-2 border-yellow-400 max-w-xs mx-auto mb-6 shadow-2xl">
        <span class="text-4xl font-black text-yellow-300">${word}</span>
      </div>

      <p class="text-slate-300 mb-3 text-sm font-bold">החלטתם מי הסוכן הכפול? סמנו את שמו:</p>
      <div class="grid grid-cols-2 gap-2 max-w-sm mx-auto mb-6">${membersHtml}</div>

      <div id="stationHintSlot"></div>
    </div>
  `;

  renderHintWidget(document.getElementById('stationHintSlot'), station, state);

  container.querySelectorAll('.btn-vote-spy').forEach(btn => {
    btn.addEventListener('click', () => {
      submitAnswer({ votedSpy: btn.getAttribute('data-name') });
    });
  });
}

// מילון מילים עבריות תקניות מוכרות הניתנות להרכבה מהמילה "אוניברסיטה"
const VALID_WORDS_FROM_UNIVERSITA = new Set([
  "אוניברסיטה", "אוניברסיטאות",
  "אבי", "אביר", "אבן", "אבני", "אוטו", "אי", "איוב", "איור", "אין", "אויר", "אור", "אורה", "אורן", "אות", "אותי", "אותן", "איתו", "איתי", "איתן", "אנור", "אני", "אנו", "ארס", "ארסי", "ארי", "אריה", "אסי", "אסיר", "אטרי", "אטריה",
  "בא", "בו", "בוט", "בוטה", "בוטן", "בוטנים", "בוס", "בוסר", "בור", "בורות", "בורס", "בורסה", "בי", "ביט", "ביטה", "בין", "בינה", "בינו", "ביס", "ביסטרו", "ביר", "בירה", "בית", "ביתו", "ביתי", "בן", "בנו", "בני", "בנוי", "בנויה", "בסט", "בסטה", "בסיס", "בסיסי", "בסר", "בר", "ברא", "ברטה", "ברי", "בריא", "בריאה", "בריסטה", "ברית", "בריתו", "ברס", "ברסה", "ברוס", "ברט", "בת", "בתו", "בתי",
  "הא", "האור", "הבא", "הבור", "הביא", "הביאו", "הבינו", "הביס", "הבסיס", "הברית", "הבת", "הו", "הורי", "הורס", "הוט", "הוא", "הוי", "הות", "הויה", "הונה", "הי", "הטב", "הטבה", "הטבי", "היו", "היור", "היא", "היטב", "היסב", "היסה", "היסט", "היסוס", "הנביא", "הניב", "הניס", "הסב", "הסבה", "הסביר", "הסבר", "הסברה", "הסיר", "הסרת", "הסט", "הסתה", "הסתו", "הרא", "הראה", "הראו", "הרי", "הריב", "הריבה", "הריס", "הריסה", "הריתו", "הרס", "הרסו", "הרסי", "התבסס", "התר", "התרה",
  "וטו", "וינה", "וירוס",
  "טהור", "טו", "טור", "טורי", "טירה", "טירתו", "טיב", "טיבה", "טיסה", "טיס", "טיסו", "טיסתו", "טיסות", "טיט", "טיטן", "טניה", "טס", "טסו", "טסה", "טרי", "טריה", "טרס", "טרסה",
  "יאור", "יאירו", "יבא", "יבוא", "יבואו", "יבנה", "יבסס", "יברא", "יבראו", "יבריא", "יהב", "יונה", "יוני", "יורה", "יורט", "יוסי", "יותר", "ייאור", "יירה", "יירט", "ייסר", "ייסור", "ינביא", "ינוס", "יניב", "יניס", "יסב", "יסביר", "יסבר", "יסיר", "יסר", "יסרב", "יסרבו", "ירא", "יראה", "יראו", "ירו", "ירוט", "ירוס", "ירט", "ירטו", "ירי", "יריב", "יריבו", "יריבה", "יריות", "ירס", "יתר", "יתרה", "יתרו", "יתרון",
  "נאסר", "נביא", "נביאה", "נביאו", "נביט", "נביטה", "נביר", "נברא", "נבראה", "נבראו", "נבריא", "נו", "נוב", "נוה", "נוי", "נור", "נורה", "נורית", "נוס", "נוסי", "נוסט", "נות", "נטה", "ניב", "ניבו", "ניבי", "ניס", "ניסו", "ניסי", "ניסיו", "ניסית", "ניסט", "ניר", "נירו", "ניתב", "ניתו", "נס", "נסו", "נסה", "נסיב", "נסיבה", "נסיס", "נסיר", "נרא", "נראה", "נראו", "נרטב", "נריב", "נריבה", "נריס", "נרסס", "נתר",
  "סבא", "סבור", "סבורה", "סביב", "סביר", "סבירה", "סבירו", "סבר", "סברה", "סברו", "סברס", "סוב", "סובה", "סובר", "סוטה", "סויה", "סויטה", "סוויטה", "סוויטות", "סוני", "סוניה", "סנוב", "סור", "סורה", "סורי", "סוריה", "סורט", "סורטי", "סטה", "סטטוס", "סטר", "סטרי", "סטירה", "סי", "סיב", "סיבו", "סיבה", "סיבי", "סיבור", "סיבות", "סיור", "סיט", "סיטה", "סיטי", "סין", "סיס", "סיסו", "סיר", "סירו", "סירה", "סירי", "סירות", "סנאי", "סר", "סרב", "סרבו", "סרה", "סרו", "סרוט", "סרוטה", "סרוס", "סרט", "סרטי", "סרטו", "סרטון",
  "ראה", "ראו", "ראט", "ראי", "ראיו", "ראיה", "ראית", "ראיתי", "רב", "רבה", "רבו", "רבי", "רביב", "רביו", "רביה", "רבית", "רוב", "רובי", "רובה", "רובו", "רובות", "רוה", "רוט", "רוטב", "רוטה", "רוי", "רויה", "רוית", "רון", "רוני", "רונה", "רוס", "רוסי", "רוסיה", "רוסס", "רוססו", "רות", "רטב", "רטוב", "רטובה", "ריב", "ריבו", "ריבה", "ריבי", "ריבות", "ריהוט", "ריטה", "רינה", "ריס", "ריסו", "ריסי", "ריסוס", "ריסתו", "ריר", "רן", "רנה", "רסס", "רסה", "רסו"
]);

// תחנה 15: מילה בתוך מילה - אוניברסיטה (10 מילים)
function renderWordInWord(container, station, state) {
  let wordsFound = [];

  function renderView() {
    container.innerHTML = `
      <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center" dir="rtl">
        ${station.location ? `
          <div class="mb-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full text-xs text-yellow-300 font-bold">
            <span>📍 מיקום: ${station.location}</span>
          </div>
        ` : ''}
        <h3 class="text-2xl font-bold text-yellow-300 mb-2">${station.name}</h3>
        <p class="text-slate-300 mb-4 text-sm max-w-md mx-auto leading-relaxed">${station.question}</p>

        <div class="text-3xl font-black text-cyan-400 tracking-[8px] bg-slate-900 py-3.5 px-6 rounded-2xl border border-slate-700 inline-block mb-6 select-none shadow-inner">
          א ו נ י ב ר ס י ט ה
        </div>

        <div class="max-w-xs mx-auto mb-5">
          <input type="text" id="wordInWordInput" class="w-full p-3 rounded-xl bg-slate-900 border-2 border-slate-600 text-white font-bold text-center text-xl mb-2" placeholder="מילה חדשה...">
          <button id="btnAddWord" class="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-2.5 rounded-xl shadow-md">הוסף מילה (+)</button>
          <div id="wordInWordErr" class="text-red-400 text-xs font-bold mt-2 hidden"></div>
        </div>

        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-700 max-w-md mx-auto text-right mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-slate-400">מילים שנמצאו:</span>
            <span class="text-sm font-bold text-yellow-400">${wordsFound.length} / ${station.requiredWordsCount}</span>
          </div>
          <div class="flex flex-wrap gap-2 min-h-[40px]">
            ${wordsFound.map(w => `<span class="bg-slate-800 text-green-400 px-3 py-1 rounded-lg text-sm font-bold border border-green-500/50">✓ ${w}</span>`).join('')}
          </div>
        </div>

        <div id="stationHintSlot"></div>
      </div>
    `;

    renderHintWidget(document.getElementById('stationHintSlot'), station, state);

    const input = document.getElementById('wordInWordInput');
    const errEl = document.getElementById('wordInWordErr');

    const handleAdd = () => {
      const val = input.value.trim();
      if (!val) return;

      if (val.length < 2) {
        errEl.textContent = 'המילה חייבת להכיל לפחות 2 אותיות!';
        errEl.classList.remove('hidden');
        return;
      }

      if (wordsFound.includes(val)) {
        errEl.textContent = 'מילה זו כבר הוזנה!';
        errEl.classList.remove('hidden');
        return;
      }

      // נרמול אותיות סופיות וחלופת ת/ט
      const normalizeHebrewChar = (ch) => {
        if (ch === 'ן') return 'נ';
        if (ch === 'ם') return 'מ';
        if (ch === 'ך') return 'כ';
        if (ch === 'ף') return 'פ';
        if (ch === 'ץ') return 'צ';
        if (ch === 'ת') return 'ט';
        return ch;
      };

      // 1. בדיקה שכל אותיות המילה קיימות במילה "אוניברסיטה"
      const baseLetters = "אוניברסיטה".split('').map(normalizeHebrewChar);
      const valLetters = val.split('').map(normalizeHebrewChar);
      let valid = true;
      for (const l of valLetters) {
        const idx = baseLetters.indexOf(l);
        if (idx === -1) {
          valid = false;
          break;
        }
        baseLetters.splice(idx, 1);
      }

      if (!valid) {
        errEl.textContent = 'המילה מכילה אותיות שאינן קיימות ב"אוניברסיטה"!';
        errEl.classList.remove('hidden');
        return;
      }

      // 2. בדיקה שהמילה היא מילה עברית תקנית מוכרת
      if (!VALID_WORDS_FROM_UNIVERSITA.has(val)) {
        errEl.textContent = `המילה "${val}" אינה מילה עברית מוכרת! נסו מילה עברית אמיתית.`;
        errEl.classList.remove('hidden');
        return;
      }

      wordsFound.push(val);
      if (window.gameAudio) window.gameAudio.playSuccessSound();

      if (wordsFound.length >= station.requiredWordsCount) {
        submitAnswer({ wordsFound });
      } else {
        renderView();
      }
    };

    document.getElementById('btnAddWord').addEventListener('click', handleAdd);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    });
  }

  renderView();
}

// הפעלת ריקרול מסך מלא (15 שניות)
function triggerRickroll(seconds = 15, type = 'sabotage', byTeam = '') {
  if (rickrollTimerInterval) {
    clearInterval(rickrollTimerInterval);
    rickrollTimerInterval = null;
  }

  rickrollOverlay.classList.add('active');

  const titleEl = rickrollOverlay.querySelector('h2') || rickrollOverlay.querySelector('h1');
  const descEl = rickrollOverlay.querySelector('p');

  if (type === 'station8_trap') {
    if (titleEl) titleEl.textContent = '🤡 נפלתם במלכודת המסיח!';
    if (descEl) descEl.textContent = 'בחרתם ביעד שגוי... המתינו עד סיום הסרטון ונסו שוב עם הצבע הנכון!';
  } else {
    if (titleEl) titleEl.textContent = `🚨 מתקפת סבוטאז'! קבוצה ${byTeam || 'יריבה'} עיכבה אתכם! 🚨`;
    if (descEl) descEl.textContent = 'קבוצה יריבה הפעילה עליכם חסימה! צפו בריקרול עד תום הטיימר...';
  }

  const iframe = rickrollOverlay.querySelector('iframe');
  if (iframe) {
    iframe.src = `https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0&controls=0&playsinline=1`;
  }

  if (window.gameAudio && typeof window.gameAudio.playRickrollSynth === 'function') {
    try {
      window.gameAudio.playRickrollSynth(seconds);
    } catch (e) {
      console.warn("Rickroll synth error:", e);
    }
  }

  let timeLeft = seconds;
  if (rickrollTimerEl) {
    rickrollTimerEl.textContent = `${timeLeft} שניות`;
  }

  rickrollTimerInterval = setInterval(() => {
    timeLeft--;
    if (rickrollTimerEl) {
      rickrollTimerEl.textContent = `${Math.max(0, timeLeft)} שניות`;
    }
    if (timeLeft <= 0) {
      clearInterval(rickrollTimerInterval);
      rickrollTimerInterval = null;
      rickrollOverlay.classList.remove('active');
      if (iframe) iframe.src = '';
    }
  }, 1000);
}
