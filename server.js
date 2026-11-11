const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { STATIONS, INGREDIENTS } = require('./public/js/stations');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 5000,
  pingTimeout: 7000
});

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = '281005';
const CONFIG_FILE = path.join(__dirname, 'data', 'stations_config.json');

// מאגר סרטוני חתולים שונים לכל רמז
const CAT_VIDEOS = [
  '/videos/cat_1.mp4',
  '/videos/cat_2.mp4',
  '/videos/cat_3.mp4',
  '/videos/cat_4.mp4',
  '/videos/cat_5.mp4'
];

function getCatVideoForHint(stationId, hintIndex) {
  const sNum = parseInt(stationId) || 1;
  const hNum = parseInt(hintIndex) || 1;
  const idx = Math.abs((sNum * 3 + hNum - 1)) % CAT_VIDEOS.length;
  return CAT_VIDEOS[idx];
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// טעינת הגדרות תחנות מקובץ קונפיגורציה
function loadStationConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (Array.isArray(data)) {
        data.forEach(cfg => {
          const st = STATIONS.find(s => s.id === cfg.id);
          if (st) {
            if (cfg.name !== undefined && cfg.name !== '') st.name = cfg.name;
            if (cfg.location !== undefined && cfg.location !== '') st.location = cfg.location;
            if (cfg.question !== undefined && cfg.question !== '') st.question = cfg.question;
            if (cfg.answer !== undefined && cfg.answer !== '') {
              st.answer = cfg.answer;
              st.solution = cfg.answer;
              if (Array.isArray(st.validAnswers)) {
                if (!st.validAnswers.includes(cfg.answer)) {
                  st.validAnswers.unshift(cfg.answer);
                }
              } else {
                st.validAnswers = [cfg.answer];
              }
            }
            if (Array.isArray(cfg.hints)) {
              st.hints = cfg.hints.map(h => String(h).trim()).filter(h => h.length > 0);
              st.hint = st.hints[0] || '';
            } else if (cfg.hint !== undefined && cfg.hint !== '') {
              st.hint = cfg.hint;
              st.hints = [cfg.hint];
            } else if (cfg.hints === undefined && cfg.hint === undefined) {
              if (st.hint) st.hints = [st.hint];
              else st.hints = [];
            }
            if (cfg.allowSolutionReveal !== undefined) {
              st.allowSolutionReveal = cfg.allowSolutionReveal;
            }
            if (cfg.solutionLockoutMinutes !== undefined) {
              const lm = parseInt(cfg.solutionLockoutMinutes);
              st.solutionLockoutMinutes = isNaN(lm) ? 10 : Math.max(0, lm);
            }
          }
        });
      }
    } else {
      saveStationConfigs();
    }
  } catch (err) {
    console.error('Error loading stations config:', err);
  }
}

// שמירת הגדרות תחנות לקובץ
function saveStationConfigs() {
  try {
    STATIONS.sort((a, b) => a.id - b.id);
    const dataToSave = STATIONS.map(s => {
      const hintsArr = Array.isArray(s.hints) ? s.hints : (s.hint ? [s.hint] : []);
      return {
        id: s.id,
        name: s.name,
        location: s.location || '',
        question: s.question || '',
        answer: s.answer || '',
        hint: (hintsArr && hintsArr[0]) || s.hint || '',
        hints: hintsArr,
        allowSolutionReveal: s.allowSolutionReveal !== false,
        solutionLockoutMinutes: (typeof s.solutionLockoutMinutes === 'number' ? s.solutionLockoutMinutes : 10)
      };
    });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving stations config:', err);
  }
}

// פונקציית עדכון תחנה גלובלית (שם, מספר, מיקום, שאלה, תשובה, רמזים, אפשרות חשיפת פתרון)
function applyStationUpdate({ stationId, newId, name, location, question, answer, hint, hints, allowSolutionReveal, solutionLockoutMinutes }) {
  const sId = parseInt(stationId);
  const st = STATIONS.find(s => s.id === sId);
  if (!st) return null;

  if (allowSolutionReveal !== undefined) {
    st.allowSolutionReveal = (allowSolutionReveal === true || allowSolutionReveal === 'true');
  }

  if (solutionLockoutMinutes !== undefined) {
    const lm = parseInt(solutionLockoutMinutes);
    st.solutionLockoutMinutes = isNaN(lm) ? 10 : Math.max(0, lm);
  }

  if (name !== undefined && String(name).trim() !== '') {
    st.name = String(name).trim();
  }

  if (newId !== undefined && newId !== '' && parseInt(newId) !== sId) {
    const targetId = parseInt(newId);
    if (!isNaN(targetId) && targetId > 0) {
      const existingWithTargetId = STATIONS.find(s => s.id === targetId);
      if (existingWithTargetId) {
        existingWithTargetId.id = sId;
      }
      st.id = targetId;
      STATIONS.sort((a, b) => a.id - b.id);
    }
  }

  if (location !== undefined) st.location = location;
  if (question !== undefined) st.question = question;
  if (answer !== undefined && String(answer).trim() !== '') {
    st.answer = String(answer).trim();
    st.solution = st.answer; // סנכרון מלא לפאנל המנהלים
    if (Array.isArray(st.validAnswers)) {
      st.validAnswers = st.validAnswers.filter(a => !a.includes('?'));
      if (!st.validAnswers.includes(st.answer)) {
        st.validAnswers.unshift(st.answer);
      }
    } else {
      st.validAnswers = [st.answer];
    }
  }

  if (hints !== undefined && Array.isArray(hints)) {
    st.hints = hints.map(h => String(h).trim()).filter(h => h.length > 0);
    st.hint = st.hints[0] || '';
  } else if (hint !== undefined) {
    st.hint = String(hint).trim();
    st.hints = st.hint ? [st.hint] : [];
  }

  saveStationConfigs();
  return st;
}

// הוספת תחנה חדשה למשחק
function addStation({ id, name, location, question, answer, hint, hints, allowSolutionReveal, solutionLockoutMinutes }) {
  const finalStation = STATIONS.find(s => s.type === 'admin_custom_final' || s.id === 17);
  const normalStations = STATIONS.filter(s => s !== finalStation);

  const newId = parseInt(id) || (normalStations.length + 1);
  const hintsArr = Array.isArray(hints) ? hints.map(h => String(h).trim()).filter(h => h.length > 0) : (hint ? [String(hint).trim()] : []);
  const parsedLockout = parseInt(solutionLockoutMinutes);
  const finalLockout = isNaN(parsedLockout) ? 10 : Math.max(0, parsedLockout);
  const newStation = {
    id: newId,
    name: name || `תחנה ${newId}`,
    badge: 'אתגר שטח 🗺️',
    type: 'admin_custom',
    location: location || '',
    question: question || '',
    answer: answer || '1',
    solution: answer || '1',
    validAnswers: answer ? [answer] : ['1'],
    hint: hintsArr[0] || '',
    hints: hintsArr,
    allowSolutionReveal: allowSolutionReveal !== false,
    solutionLockoutMinutes: finalLockout
  };

  normalStations.push(newStation);
  normalStations.sort((a, b) => a.id - b.id);

  if (finalStation) {
    finalStation.id = normalStations.length + 1;
    finalStation.name = "התחנה הסופית – סיום המירוץ! 🏆";
    STATIONS.length = 0;
    STATIONS.push(...normalStations, finalStation);
  } else {
    STATIONS.length = 0;
    STATIONS.push(...normalStations);
  }

  saveStationConfigs();

  for (const [tId, team] of Object.entries(teams)) {
    if (!team.isGameCompleted) {
      team.stationOrder = generateStationOrderForTeam(parseInt(tId) || 1);
    }
  }

  return newStation;
}

// מחיקת תחנה (אלא אם זו תחנת הסיום)
function deleteStation(stationId) {
  const sId = parseInt(stationId);
  const st = STATIONS.find(s => s.id === sId);
  if (!st || st.type === 'admin_custom_final') {
    return false;
  }

  const idx = STATIONS.indexOf(st);
  if (idx !== -1) {
    STATIONS.splice(idx, 1);
  }

  const finalStation = STATIONS.find(s => s.type === 'admin_custom_final');
  const normalStations = STATIONS.filter(s => s !== finalStation);
  normalStations.sort((a, b) => a.id - b.id);

  normalStations.forEach((s, i) => {
    s.id = i + 1;
  });

  if (finalStation) {
    finalStation.id = normalStations.length + 1;
    STATIONS.length = 0;
    STATIONS.push(...normalStations, finalStation);
  }

  saveStationConfigs();

  for (const [tId, team] of Object.entries(teams)) {
    if (!team.isGameCompleted) {
      team.stationOrder = generateStationOrderForTeam(parseInt(tId) || 1);
      if (team.currentStepIndex >= team.stationOrder.length) {
        team.currentStepIndex = Math.max(0, team.stationOrder.length - 1);
      }
    }
  }

  return true;
}

loadStationConfigs();

let systemConfig = {
  strictMode: true,
  requiredMode: 'three_quarters', // 'three_quarters' (לפחות 3/4 מהמחוברים, לא כולם), 'half', 'single'
  minRequiredAnswers: 1,
  numTeams: 10,
  staggerRoutes: false
};

const teams = {};

// סידור תחנות לקבוצה: כברירת מחדל מסלול ליניארי מוסדר (1 עד הסוף לכולן), עם אפשרות לפיזור מעגלי
function generateStationOrderForTeam(teamIndex) {
  const total = STATIONS.length;
  if (total <= 1) return [0];

  const intermediateCount = total - 1; // כל התחנות למעט התחנה הסופית
  const regularStationIndices = Array.from({ length: intermediateCount }, (_, i) => i);

  if (!systemConfig.staggerRoutes) {
    // כל הקבוצות מתחילות מתחנה 1 ועוברות את כל התחנות לפי הסדר עד תחנת הסיום!
    regularStationIndices.push(total - 1);
    return regularStationIndices;
  }

  // מצב פיזור: רוטציה מעגלית של תחנות הביניים, תחנת הסיום תמיד אחרונה
  const startOffset = (teamIndex * 2 + 1) % intermediateCount;
  const reordered = [];
  for (let i = 0; i < intermediateCount; i++) {
    reordered.push(regularStationIndices[(startOffset + i) % intermediateCount]);
  }
  reordered.push(total - 1);
  return reordered;
}

// יצירה והבטחת קיום של קבוצות עד המספר המבוקש (דיפולט: 10)
function ensureTeams(count = 10) {
  for (let i = 1; i <= count; i++) {
    const teamId = String(i);
    if (!teams[teamId]) {
      teams[teamId] = {
        id: teamId,
        name: `קבוצה ${i}`,
        currentStepIndex: 0,
        currentStationStartedAt: Date.now(),
        stationOrder: generateStationOrderForTeam(i),
        completedStations: [],
        members: [],
        stationAnswers: {},
        unlockedIngredients: [],
        hintVotes: {},
        unlockedHints: {},
        solutionVotes: {},
        unlockedSolutions: {},
        sabotageVotes: {},
        sabotagedUntil: null,
        sabotageType: null,
        sabotageByTeam: null,
        lockoutUntil: null,
        doubleAgentUserId: null,
        isGameCompleted: false
      };
    }
  }
}

ensureTeams(systemConfig.numTeams);

function getRequiredAnswersCount(team) {
  const totalMembers = team.members ? team.members.length : 0;
  if (!systemConfig.strictMode || systemConfig.requiredMode === 'single') return 1;
  if (totalMembers <= 1) return 1;

  if (systemConfig.requiredMode === 'half') {
    return Math.max(1, Math.ceil(totalMembers / 2));
  }

  // דרישת מעבר: לפחות 3/4 (75%) מהמשתמשים המחוברים (ולא כולם)
  const threeQuarters = Math.round(totalMembers * 0.75);
  const capped = totalMembers >= 3 ? Math.min(totalMembers - 1, threeQuarters) : Math.max(1, threeQuarters);
  return Math.max(1, capped);
}

function checkAndUnlockIngredients(team) {
  const completedCount = team.completedStations.length;
  const newlyUnlocked = [];
  for (const ing of INGREDIENTS) {
    if (completedCount >= ing.unlockAfterStations && !team.unlockedIngredients.includes(ing.id)) {
      team.unlockedIngredients.push(ing.id);
      newlyUnlocked.push(ing);
    }
  }
  return newlyUnlocked;
}

// קידום קבוצה לתחנה הבאה
function advanceTeamToNextStation(team, currentStation) {
  const tId = team.id;
  team.activeHintPenalty = null;
  team.activeSolutionPenalty = null;
  if (!team.completedStations.includes(currentStation.id)) {
    team.completedStations.push(currentStation.id);
  }

  const newIngredients = checkAndUnlockIngredients(team);
  if (newIngredients.length > 0) {
    io.to(`team_${tId}`).emit('ingredients_unlocked_event', {
      ingredients: newIngredients,
      allUnlocked: team.unlockedIngredients
    });
  }

  if (team.currentStepIndex >= team.stationOrder.length - 1) {
    team.isGameCompleted = true;
    io.to(`team_${tId}`).emit('game_victory', {
      teamName: team.name,
      completedStations: team.completedStations.length,
      totalIngredients: team.unlockedIngredients.length
    });
  } else {
    team.currentStepIndex++;
    team.currentStationStartedAt = Date.now();
    const nextStationIndex = team.stationOrder[team.currentStepIndex];
    if (STATIONS[nextStationIndex] && STATIONS[nextStationIndex].id === 11 && team.members.length > 0) {
      const randIdx = Math.floor(Math.random() * team.members.length);
      team.doubleAgentUserId = team.members[randIdx].id;
    }

    io.to(`team_${tId}`).emit('station_advanced', {
      completedStationId: currentStation.id,
      nextStepIndex: team.currentStepIndex
    });
  }
}

// שיגור ריקרול לקבוצה שנבחרה ברוב קולות בתחנת החסימה
function triggerBlockingSabotage(team) {
  const tId = team.id;
  const voteCounts = {};
  Object.values(team.sabotageVotes || {}).forEach(tid => {
    voteCounts[tid] = (voteCounts[tid] || 0) + 1;
  });

  let electedTarget = null;
  let maxVotes = -1;
  for (const [tid, cnt] of Object.entries(voteCounts)) {
    if (cnt > maxVotes) {
      maxVotes = cnt;
      electedTarget = tid;
    }
  }

  if (!electedTarget) {
    electedTarget = [1, 2, 3, 4, 5, 6, 7, 8].find(t => String(t) !== String(tId)) || '2';
  }

  team.sabotageTriggered = true;
  team.sabotageTarget = String(electedTarget);
  const targetTeam = teams[electedTarget];
  if (targetTeam) {
    targetTeam.sabotagedUntil = Date.now() + 15000;
    targetTeam.sabotageType = 'sabotage';
    targetTeam.sabotageByTeam = team.name || `קבוצה ${tId}`;
  }

  // שיגור ריקרול לקבוצה שנבחרה ברוב קולות
  io.to(`team_${electedTarget}`).emit('sabotage_alert', {
    byTeam: team.name || `קבוצה ${tId}`,
    type: 'sabotage',
    durationSeconds: 15
  });

  io.to(`team_${tId}`).emit('sabotage_launched', {
    targetTeamId: electedTarget,
    message: `לפחות חצי מהקבוצה אישרה מעבר! שיגרתם בהצלחה ריקרול לקבוצה ${electedTarget} שנבחרה ברוב קולות!`
  });

  emitTeamState(electedTarget);
}

function checkStationAdvance(team) {
  if (!team || team.isGameCompleted) return;
  const currentStationIndex = team.stationOrder[team.currentStepIndex];
  const currentStation = STATIONS[currentStationIndex];
  if (!currentStation) return;

  const isBlocking = (currentStation.id === 5 || currentStation.isBlockingStation || currentStation.type === 'blocking_station');
  const answersForCurStation = team.stationAnswers[currentStation.id] || {};
  const activeAnsweredUsers = Object.keys(answersForCurStation).filter(uId => team.members.some(m => m.id === uId));
  const answeredCount = activeAnsweredUsers.length;
  const requiredCount = isBlocking ? Math.max(1, Math.ceil(team.members.length / 2)) : getRequiredAnswersCount(team);

  if (answeredCount >= requiredCount && requiredCount > 0) {
    if (isBlocking && !team.sabotageTriggered) {
      triggerBlockingSabotage(team);
    }
    advanceTeamToNextStation(team, currentStation);
  }
}

function removeSocketFromAllTeams(socketId, userObjId = null) {
  let anyChanged = false;
  for (const [tId, team] of Object.entries(teams)) {
    const beforeCount = team.members.length;
    team.members = team.members.filter(m => {
      if (socketId && m.socketId === socketId) return false;
      if (userObjId && m.id === userObjId) return false;
      return true;
    });
    if (team.members.length !== beforeCount) {
      anyChanged = true;
      checkStationAdvance(team);
      emitTeamState(tId);
    }
  }
  if (anyChanged) {
    notifyAdmin();
  }
}

io.on('connection', (socket) => {
  let currentUser = null;
  let currentTeamId = null;

  socket.on('join_team', ({ teamId, memberName, userId }) => {
    currentTeamId = String(teamId);
    if (!teams[currentTeamId]) {
      teams[currentTeamId] = {
        id: currentTeamId,
        name: `קבוצה ${currentTeamId}`,
        currentStepIndex: 0,
        currentStationStartedAt: Date.now(),
        stationOrder: generateStationOrderForTeam(parseInt(currentTeamId) || 1),
        completedStations: [],
        members: [],
        stationAnswers: {},
        unlockedIngredients: [],
        hintVotes: {},
        unlockedHints: {},
        solutionVotes: {},
        unlockedSolutions: {},
        sabotageVotes: {},
        sabotagedUntil: null,
        sabotageType: null,
        sabotageByTeam: null,
        lockoutUntil: null,
        doubleAgentUserId: null,
        isGameCompleted: false
      };
    }

    const team = teams[currentTeamId];
    currentUser = {
      id: userId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: memberName || 'משתתף',
      socketId: socket.id
    };

    // מסירים את המשתמש/הסוקט מכל קבוצה אחרת
    for (const [tId, otherTeam] of Object.entries(teams)) {
      if (tId !== currentTeamId) {
        const bCount = otherTeam.members.length;
        otherTeam.members = otherTeam.members.filter(m => m.socketId !== socket.id && m.id !== currentUser.id);
        if (otherTeam.members.length !== bCount) {
          checkStationAdvance(otherTeam);
          emitTeamState(tId);
        }
      }
    }

    const existingIndex = team.members.findIndex(m => m.id === currentUser.id);
    if (existingIndex >= 0) {
      team.members[existingIndex].socketId = socket.id;
      team.members[existingIndex].name = currentUser.name;
    } else {
      team.members.push(currentUser);
    }

    if (!team.doubleAgentUserId && team.members.length > 0) {
      const randIdx = Math.floor(Math.random() * team.members.length);
      team.doubleAgentUserId = team.members[randIdx].id;
    }

    socket.join(`team_${currentTeamId}`);
    checkStationAdvance(team);
    emitTeamState(currentTeamId);
    notifyAdmin();
  });

  // הצבעה לרמז קבוצתי (נפתח בנפרד לכל רמז בהצבעת לפחות שליש מחברי הקבוצה, מחיר: סרטון חתולים של דקה)
  socket.on('vote_hint', ({ stationId }) => {
    if (!currentTeamId || !currentUser) return;
    const team = teams[currentTeamId];
    if (!team) return;

    if (!team.hintVotes) team.hintVotes = {};
    if (!team.unlockedHints) team.unlockedHints = {};
    if (!team.solutionVotes) team.solutionVotes = {};
    if (!team.unlockedSolutions) team.unlockedSolutions = {};

    const sId = parseInt(stationId);
    const st = STATIONS.find(s => s.id === sId);
    const stHints = st ? (Array.isArray(st.hints) ? st.hints : (st.hint ? [st.hint] : [])) : [];

    let unlockedCount = 0;
    if (typeof team.unlockedHints[sId] === 'number') {
      unlockedCount = team.unlockedHints[sId];
    } else if (team.unlockedHints[sId]) {
      unlockedCount = 1;
    }

    // אם אין רמזים בכלל או שכבר נפתחו כל הרמזים
    if (stHints.length === 0 || unlockedCount >= stHints.length) {
      return;
    }

    if (!team.hintVotes[sId]) {
      team.hintVotes[sId] = [];
    }

    if (!team.hintVotes[sId].includes(currentUser.id)) {
      team.hintVotes[sId].push(currentUser.id);
    }

    const votesCount = team.hintVotes[sId].length;
    const totalMembers = Math.max(1, team.members.length);
    const needed = Math.max(1, Math.ceil(totalMembers / 3));

    if (votesCount >= needed) {
      const nextHintIndex = unlockedCount;
      const nextHintText = stHints[nextHintIndex] || '';
      const chosenCatVideo = getCatVideoForHint(sId, nextHintIndex + 1);

      // רישום עונש רמז פעיל (כדי שאם מרפרשים - זה יתחיל מחדש מהתחלה!)
      team.activeHintPenalty = {
        stationId: sId,
        hintIndex: nextHintIndex + 1,
        totalHints: stHints.length,
        hint: nextHintText,
        durationSeconds: 60,
        videoUrl: chosenCatVideo
      };

      // שיגור צפייה בסרטון חתולים ייחודי של 60 שניות לכל הקבוצה כמחיר על חשיפת הרמז
      io.to(`team_${currentTeamId}`).emit('cat_video_hint_start', {
        stationId: sId,
        hintIndex: nextHintIndex + 1,
        totalHints: stHints.length,
        hint: nextHintText,
        durationSeconds: 60,
        videoUrl: chosenCatVideo
      });
    } else {
      io.to(`team_${currentTeamId}`).emit('hint_votes_updated', {
        stationId: sId,
        count: votesCount,
        needed: needed,
        hintIndex: unlockedCount + 1,
        totalHints: stHints.length
      });
    }

    emitTeamState(currentTeamId);
    notifyAdmin();
  });

  // סיום צפייה בסרטון חתולים של דקה - פתיחת הרמז
  socket.on('cat_video_hint_completed', ({ stationId }) => {
    if (!currentTeamId) return;
    const team = teams[currentTeamId];
    if (!team) return;
    team.activeHintPenalty = null;
    if (!team.unlockedHints) team.unlockedHints = {};
    const sId = parseInt(stationId);
    const st = STATIONS.find(s => s.id === sId);
    const stHints = st ? (Array.isArray(st.hints) ? st.hints : (st.hint ? [st.hint] : [])) : [];

    let unlockedCount = typeof team.unlockedHints[sId] === 'number' ? team.unlockedHints[sId] : (team.unlockedHints[sId] ? 1 : 0);
    if (unlockedCount < stHints.length) {
      unlockedCount++;
      team.unlockedHints[sId] = unlockedCount;
      team.hintVotes[sId] = [];
    }

    io.to(`team_${currentTeamId}`).emit('hint_unlocked', {
      stationId: sId,
      unlockedHintsCount: unlockedCount,
      totalHints: stHints.length,
      hint: stHints[unlockedCount - 1] || '',
      unlockedHintsList: stHints.slice(0, unlockedCount)
    });
    emitTeamState(currentTeamId);
    notifyAdmin();
  });

  // הצבעה לחשיפת פתרון מלא (מחייב לפחות חצי מחברי הקבוצה וצפייה בשיר של מני ממטרה - חושף במדויק את התשובה מפאנל המנהלים)
  socket.on('vote_solution', ({ stationId }) => {
    if (!currentTeamId || !currentUser) return;
    const team = teams[currentTeamId];
    if (!team) return;

    if (!team.solutionVotes) team.solutionVotes = {};
    if (!team.unlockedSolutions) team.unlockedSolutions = {};
    if (!team.hintVotes) team.hintVotes = {};
    if (!team.unlockedHints) team.unlockedHints = {};

    const sId = parseInt(stationId);
    const st = STATIONS.find(s => s.id === sId);
    if (st && st.allowSolutionReveal === false) {
      socket.emit('error_message', { message: 'בתחנה זו לא ניתן לחשוף את הפתרון.' });
      return;
    }

    // בדיקה שחלף זמן הנעילה שהוגדר לתחנה (0 = פתוח מיד, או לפי הדקות שהמנהל קבע)
    const lockoutMinutes = (st && typeof st.solutionLockoutMinutes === 'number') ? st.solutionLockoutMinutes : 10;
    const LOCKOUT_MS = lockoutMinutes * 60 * 1000;
    const stationStartedAt = team.currentStationStartedAt || Date.now();
    const elapsedMs = Date.now() - stationStartedAt;
    if (lockoutMinutes > 0 && elapsedMs < LOCKOUT_MS) {
      const remainingSeconds = Math.ceil((LOCKOUT_MS - elapsedMs) / 1000);
      const remM = Math.floor(remainingSeconds / 60);
      const remS = remainingSeconds % 60;
      const remStr = `${remM}:${remS < 10 ? '0' : ''}${remS}`;
      socket.emit('error_message', {
        message: `חשיפת הפתרון נעולה! ניתן לפתוח את התשובה רק לאחר ${lockoutMinutes} דקות ללא הצלחה בתחנה (נותרו עוד ${remStr} דקות).`
      });
      return;
    }

    if (!team.solutionVotes[sId]) {
      team.solutionVotes[sId] = [];
    }

    if (!team.solutionVotes[sId].includes(currentUser.id)) {
      team.solutionVotes[sId].push(currentUser.id);
    }

    const votesCount = team.solutionVotes[sId].length;
    const totalMembers = Math.max(1, team.members.length);
    const needed = Math.max(1, Math.ceil(totalMembers / 2));
    const solText = st ? (st.answer || st.solution || '') : '';

    if (votesCount >= needed) {
      if (!team.unlockedSolutions[sId]) {
        // רישום עונש פתרון פעיל (כדי שאם מרפרשים - זה יתחיל מחדש מהתחלה!)
        team.activeSolutionPenalty = {
          stationId: sId,
          solution: solText,
          durationSeconds: 60
        };

        // שיגור צפייה בשיר של מני ממטרה (60 שניות) לכל הקבוצה כמחיר על חשיפת הפתרון
        io.to(`team_${currentTeamId}`).emit('meni_mamtara_solution_start', {
          stationId: sId,
          solution: solText,
          durationSeconds: 60
        });
      } else {
        io.to(`team_${currentTeamId}`).emit('solution_unlocked', {
          stationId: sId,
          solution: solText
        });
      }
    } else {
      io.to(`team_${currentTeamId}`).emit('solution_votes_updated', {
        stationId: sId,
        count: votesCount,
        needed: needed
      });
    }

    emitTeamState(currentTeamId);
    notifyAdmin();
  });

  // סיום צפייה בשיר של מני ממטרה של דקה - פתיחת הפתרון המלא
  socket.on('meni_mamtara_solution_completed', ({ stationId }) => {
    if (!currentTeamId) return;
    const team = teams[currentTeamId];
    if (!team) return;
    team.activeSolutionPenalty = null;
    if (!team.unlockedSolutions) team.unlockedSolutions = {};
    const sId = parseInt(stationId);
    const st = STATIONS.find(s => s.id === sId);
    const solText = st ? (st.answer || st.solution || '') : '';
    team.unlockedSolutions[sId] = true;
    io.to(`team_${currentTeamId}`).emit('solution_unlocked', {
      stationId: sId,
      solution: solText
    });
    emitTeamState(currentTeamId);
    notifyAdmin();
  });

  // שליחת תשובה לתחנה
  socket.on('submit_answer', ({ teamId, userId, stationId, answerData }) => {
    const tId = String(teamId);
    const team = teams[tId];
    if (!team) return;

    const currentStationIndex = team.stationOrder[team.currentStepIndex];
    const currentStation = STATIONS[currentStationIndex];

    if (currentStation.id !== parseInt(stationId)) {
      socket.emit('answer_feedback', { success: false, message: 'התחנה אינה התחנה הנוכחית של הקבוצה!' });
      return;
    }

    if (!team.stationAnswers[currentStation.id]) {
      team.stationAnswers[currentStation.id] = {};
    }
    team.stationAnswers[currentStation.id][userId] = {
      answeredAt: Date.now(),
      answerData
    };

    const activeAnsweredUsers = Object.keys(team.stationAnswers[currentStation.id]).filter(uId => team.members.some(m => m.id === uId));
    const answeredCount = activeAnsweredUsers.length;
    const isBlocking = (currentStation.id === 5 || currentStation.isBlockingStation || currentStation.type === 'blocking_station');
    const requiredCount = isBlocking ? Math.max(1, Math.ceil(team.members.length / 2)) : getRequiredAnswersCount(team);

    // בדיקה האם מספיק חברי קבוצה מחוברים ענו
    if (answeredCount >= requiredCount && requiredCount > 0) {
      if (isBlocking && !team.sabotageTriggered) {
        triggerBlockingSabotage(team);
      }
      advanceTeamToNextStation(team, currentStation);
    }

    emitTeamState(tId);
    notifyAdmin();
  });

  // אישור מעבר לתחנה הבאה (בתחנת חסימה: כשחצי מהקבוצה מאשרים לעבור, נשלח ריקרול לקבוצה שנבחרה ברוב קולות ועוברים תחנה)
  socket.on('approve_advance', ({ teamId, userId, stationId }) => {
    const tId = String(teamId);
    const team = teams[tId];
    if (!team) return;

    const currentStationIndex = team.stationOrder[team.currentStepIndex];
    const currentStation = STATIONS[currentStationIndex];
    if (currentStation.id !== parseInt(stationId)) return;

    if (!team.stationAnswers[currentStation.id]) {
      team.stationAnswers[currentStation.id] = {};
    }
    team.stationAnswers[currentStation.id][userId] = {
      answeredAt: Date.now(),
      approvedAdvance: true
    };

    const answeredCount = Object.keys(team.stationAnswers[currentStation.id]).length;
    const totalMembers = Math.max(1, team.members.length);
    const halfRequired = Math.max(1, Math.ceil(totalMembers / 2));

    // לאחר שלפחות חצי מהאנשים אישרו שאפשר לעבור לתחנה הבאה
    if (answeredCount >= halfRequired) {
      if (!team.sabotageTriggered) {
        triggerBlockingSabotage(team);
      }
      advanceTeamToNextStation(team, currentStation);
    }

    emitTeamState(tId);
    notifyAdmin();
  });

  // שיגור ריקרול מלכודת צבעים תחנה 7
  socket.on('trigger_station7_trap', ({ teamId }) => {
    socket.emit('sabotage_alert', {
      type: 'station8_trap',
      durationSeconds: 15
    });
  });

  // הצבעה לקבוצה יריבה בתחנת חסימה (כל אחד יכול להצביע לקבוצה אחרת)
  socket.on('vote_sabotage', ({ teamId, userId, targetTeamId }) => {
    const tId = String(teamId);
    const targetId = String(targetTeamId);
    const team = teams[tId];
    if (!team) return;
    if (tId === targetId) return; // לא ניתן לחסום את עצמך

    if (!team.sabotageVotes) team.sabotageVotes = {};
    team.sabotageVotes[userId] = targetId;

    // ספירת קולות
    const voteCounts = {};
    Object.values(team.sabotageVotes).forEach(tid => {
      voteCounts[tid] = (voteCounts[tid] || 0) + 1;
    });

    let leadingTarget = null;
    let maxVotes = -1;
    for (const [tid, cnt] of Object.entries(voteCounts)) {
      if (cnt > maxVotes) {
        maxVotes = cnt;
        leadingTarget = tid;
      }
    }

    const totalMembers = Math.max(1, team.members.length);
    const halfRequired = Math.max(1, Math.ceil(totalMembers / 2));

    io.to(`team_${tId}`).emit('sabotage_votes_updated', {
      votes: team.sabotageVotes,
      voteCounts,
      leadingTarget,
      maxVotes,
      halfRequired,
      sabotageTriggered: team.sabotageTriggered || false,
      sabotageTarget: team.sabotageTarget || null
    });

    emitTeamState(tId);
    notifyAdmin();
  });

  socket.on('leave_team', ({ teamId, userId }) => {
    removeSocketFromAllTeams(socket.id, userId || (currentUser ? currentUser.id : null));
  });

  // התנתקות
  socket.on('disconnect', () => {
    removeSocketFromAllTeams(socket.id, currentUser ? currentUser.id : null);
  });

  // --- אירועי מנהל ---
  socket.on('admin_login', ({ code }) => {
    if (code === ADMIN_CODE) {
      socket.join('admin_room');
      socket.emit('admin_auth_success', {
        teams,
        stations: STATIONS,
        ingredients: INGREDIENTS,
        systemConfig
      });
    } else {
      socket.emit('admin_auth_failed', { message: 'קוד מנהל שגוי!' });
    }
  });

  socket.on('admin_update_station', ({ code, stationId, newId, name, location, question, answer, hint, hints }) => {
    if (code !== ADMIN_CODE) return;
    const updated = applyStationUpdate({ stationId, newId, name, location, question, answer, hint, hints });
    if (updated) {
      io.emit('stations_config_updated', STATIONS);
      notifyAdmin();
      for (const tId of Object.keys(teams)) {
        emitTeamState(tId);
      }
    }
  });

  socket.on('admin_add_station', ({ code, id, name, location, question, answer, hint, hints }) => {
    if (code !== ADMIN_CODE) return;
    const newStation = addStation({ id, name, location, question, answer, hint, hints });
    io.emit('stations_config_updated', STATIONS);
    notifyAdmin();
    for (const tId of Object.keys(teams)) {
      emitTeamState(tId);
    }
  });

  socket.on('admin_delete_station', ({ code, stationId }) => {
    if (code !== ADMIN_CODE) return;
    const ok = deleteStation(stationId);
    if (ok) {
      io.emit('stations_config_updated', STATIONS);
      notifyAdmin();
      for (const tId of Object.keys(teams)) {
        emitTeamState(tId);
      }
    }
  });

  socket.on('admin_force_advance', ({ teamId }) => {
    const team = teams[String(teamId)];
    if (team && team.currentStepIndex < team.stationOrder.length - 1) {
      const currentStationIndex = team.stationOrder[team.currentStepIndex];
      const curSt = STATIONS[currentStationIndex];
      if (!team.completedStations.includes(curSt.id)) {
        team.completedStations.push(curSt.id);
      }
      checkAndUnlockIngredients(team);
      team.currentStepIndex++;
    team.currentStationStartedAt = Date.now();
      emitTeamState(teamId);
      notifyAdmin();
    }
  });

  socket.on('admin_trigger_rickroll', ({ teamId }) => {
    io.to(`team_${teamId}`).emit('sabotage_alert', {
      byTeam: 'מנהל הפעילות',
      type: 'sabotage',
      durationSeconds: 15
    });
  });

  socket.on('admin_reset_team', ({ teamId }) => {
    const tId = String(teamId);
    if (teams[tId]) {
      teams[tId].currentStepIndex = 0;
      teams[tId].completedStations = [];
      teams[tId].stationAnswers = {};
      teams[tId].unlockedIngredients = [];
      teams[tId].hintVotes = {};
      teams[tId].unlockedHints = {};
      teams[tId].solutionVotes = {};
      teams[tId].unlockedSolutions = {};
      teams[tId].activeHintPenalty = null;
      teams[tId].activeSolutionPenalty = null;
      teams[tId].sabotageVotes = {};
      teams[tId].sabotagedUntil = null;
      teams[tId].lockoutUntil = null;
      teams[tId].isGameCompleted = false;
      teams[tId].currentStationStartedAt = Date.now();
      teams[tId].stationOrder = generateStationOrderForTeam(parseInt(tId) || 1);
      emitTeamState(tId);
      notifyAdmin();
    }
  });

  socket.on('admin_set_config', ({ strictMode, requiredMode, minRequiredAnswers, numTeams, staggerRoutes }) => {
    if (typeof strictMode === 'boolean') systemConfig.strictMode = strictMode;
    if (requiredMode) systemConfig.requiredMode = requiredMode;
    if (typeof staggerRoutes === 'boolean') {
      const changed = (systemConfig.staggerRoutes !== staggerRoutes);
      systemConfig.staggerRoutes = staggerRoutes;
      if (changed) {
        for (const tId of Object.keys(teams)) {
          teams[tId].stationOrder = generateStationOrderForTeam(parseInt(tId) || 1);
          emitTeamState(tId);
        }
      }
    }
    if (minRequiredAnswers) systemConfig.minRequiredAnswers = parseInt(minRequiredAnswers);
    if (numTeams && parseInt(numTeams) > 0) {
      systemConfig.numTeams = parseInt(numTeams);
      ensureTeams(systemConfig.numTeams);
    }
    io.emit('config_updated', systemConfig);
    notifyAdmin();
    for (const tId of Object.keys(teams)) {
      checkStationAdvance(teams[tId]);
      emitTeamState(tId);
    }
  });
});

function emitTeamState(teamId) {
  const team = teams[String(teamId)];
  if (!team) return;

  const currentStationIndex = team.stationOrder[team.currentStepIndex];
  const currentStation = STATIONS[currentStationIndex];
  if (!currentStation) return;
  const answersForCurStation = team.stationAnswers[currentStation.id] || {};
  const activeAnsweredUsers = Object.keys(answersForCurStation).filter(uId => team.members.some(m => m.id === uId));
  const answeredCount = activeAnsweredUsers.length;
  const isBlocking = (currentStation.id === 5 || currentStation.isBlockingStation || currentStation.type === 'blocking_station');
  const requiredCount = isBlocking ? Math.max(1, Math.ceil(team.members.length / 2)) : getRequiredAnswersCount(team);
  const stationsRemaining = team.stationOrder.length - team.completedStations.length;

  const totalMembers = Math.max(1, team.members.length);
  const hintVotesNeeded = Math.max(1, Math.ceil(totalMembers / 3));
  const stHints = Array.isArray(currentStation.hints) ? currentStation.hints : (currentStation.hint ? [currentStation.hint] : []);

  let unlockedHintsCount = 0;
  if (typeof team.unlockedHints[currentStation.id] === 'number') {
    unlockedHintsCount = team.unlockedHints[currentStation.id];
  } else if (team.unlockedHints[currentStation.id]) {
    unlockedHintsCount = 1;
  }
  const unlockedHintsList = stHints.slice(0, unlockedHintsCount);

  let hintsUsedCount = 0;
  Object.values(team.unlockedHints || {}).forEach(val => {
    if (typeof val === 'number') hintsUsedCount += val;
    else if (val) hintsUsedCount += 1;
  });

  const votesList = (team.hintVotes && team.hintVotes[currentStation.id]) || [];

  const solutionVotesNeeded = Math.max(1, Math.ceil(totalMembers / 2));
  const solVotesList = (team.solutionVotes && team.solutionVotes[currentStation.id]) || [];
  const solutionUnlocked = !!(team.unlockedSolutions && team.unlockedSolutions[currentStation.id]);
  const solutionText = currentStation.answer || currentStation.solution || '';

  const stationStartedAt = team.currentStationStartedAt || Date.now();
  const elapsedMs = Date.now() - stationStartedAt;
  const lockoutMinutes = (typeof currentStation.solutionLockoutMinutes === 'number' ? currentStation.solutionLockoutMinutes : 10);
  const LOCKOUT_MS = lockoutMinutes * 60 * 1000;
  const solutionLockoutSeconds = Math.max(0, Math.ceil((LOCKOUT_MS - elapsedMs) / 1000));
  const canRevealSolution = (lockoutMinutes === 0) || (elapsedMs >= LOCKOUT_MS);

  io.to(`team_${teamId}`).emit('team_state_sync', {
    teamId: team.id,
    teamName: team.name,
    currentStepIndex: team.currentStepIndex,
    totalSteps: team.stationOrder.length,
    currentStationIndex,
    currentStationId: currentStation.id,
    currentStation,
    completedStations: team.completedStations,
    stationsRemaining,
    membersCount: team.members.length,
    membersList: team.members.map(m => m.name),
    answeredCount,
    requiredCount,
    answeredUsers: activeAnsweredUsers,
    unlockedIngredients: team.unlockedIngredients,
    doubleAgentUserId: team.doubleAgentUserId,
    sabotageVotes: team.sabotageVotes || {},
    sabotageTriggered: team.sabotageTriggered || false,
    sabotageTarget: team.sabotageTarget || null,
    sabotageHalfRequired: Math.max(1, Math.ceil(team.members.length / 2)),
    sabotagedUntil: team.sabotagedUntil,
    isBlockingStation: (currentStation.id === 5 || currentStation.isBlockingStation || currentStation.type === 'blocking_station'),
    strictMode: systemConfig.strictMode,
    hints: stHints,
    unlockedHintsCount,
    unlockedHintsList,
    hintVotesCount: votesList.length,
    hintVotesNeeded,
    hintUnlocked: unlockedHintsCount > 0,
    hintText: unlockedHintsList[unlockedHintsList.length - 1] || (stHints[0] || ''),
    hintsUsedCount,
    solutionUnlocked,
    solutionVotesCount: solVotesList.length,
    solutionVotesNeeded,
    solutionText,
    allowSolutionReveal: (currentStation.allowSolutionReveal !== false),
    solutionLockoutMinutes: lockoutMinutes,
    currentStationStartedAt: stationStartedAt,
    solutionLockoutSeconds,
    canRevealSolution,
    activeHintPenalty: team.activeHintPenalty || null,
    activeSolutionPenalty: team.activeSolutionPenalty || null,
    numTeams: systemConfig.numTeams,
    isGameCompleted: team.isGameCompleted
  });
}

function notifyAdmin() {
  io.to('admin_room').emit('admin_state_update', {
    teams,
    stations: STATIONS,
    systemConfig
  });
}

// REST API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    teamsCount: Object.keys(teams).length,
    totalStations: STATIONS.length
  });
});

app.get('/api/admin/stations', (req, res) => {
  const code = req.query.code || req.headers['x-admin-code'];
  if (code !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json({ stations: STATIONS });
});

app.post('/api/admin/update-station', (req, res) => {
  const { code, stationId, newId, name, location, question, answer, hint, hints, allowSolutionReveal, solutionLockoutMinutes } = req.body;
  if (code !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const updated = applyStationUpdate({ stationId, newId, name, location, question, answer, hint, hints, allowSolutionReveal, solutionLockoutMinutes });
  if (!updated) {
    return res.status(404).json({ error: 'Station not found' });
  }

  io.emit('stations_config_updated', STATIONS);
  notifyAdmin();
  for (const tId of Object.keys(teams)) {
    emitTeamState(tId);
  }

  res.json({ success: true, station: updated });
});

app.post('/api/admin/add-station', (req, res) => {
  const { code, id, name, location, question, answer, hint, hints, allowSolutionReveal, solutionLockoutMinutes } = req.body;
  if (code !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const newStation = addStation({ id, name, location, question, answer, hint, hints, allowSolutionReveal, solutionLockoutMinutes });

  io.emit('stations_config_updated', STATIONS);
  notifyAdmin();
  for (const tId of Object.keys(teams)) {
    emitTeamState(tId);
  }

  res.json({ success: true, station: newStation, totalStations: STATIONS.length });
});

app.post('/api/admin/delete-station', (req, res) => {
  const { code, stationId } = req.body;
  if (code !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const ok = deleteStation(stationId);
  if (!ok) {
    return res.status(400).json({ error: 'Cannot delete station or station is final station' });
  }

  io.emit('stations_config_updated', STATIONS);
  notifyAdmin();
  for (const tId of Object.keys(teams)) {
    emitTeamState(tId);
  }

  res.json({ success: true, totalStations: STATIONS.length });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Amazing Race server running on http://localhost:${PORT}`);
});
