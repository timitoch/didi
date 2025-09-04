const firebaseConfig = {
    apiKey: "AIzaSyDecNXBkdSPE7Vhl3RgbgwOcjLNvPcxsPw",
    authDomain: "wordlab-sync.firebaseapp.com",
    databaseURL: "https://wordlab-sync-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "wordlab-sync",
    storageBucket: "wordlab-sync.firebasestorage.app",
    messagingSenderId: "1095424207075",
    appId: "1:1095424207075:web:0c2e07e78066db3025fdd6"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Element References
const uploadContainer = document.getElementById('upload-container');
const fileInput = document.getElementById('file-input');
const trainerContainer = document.getElementById('trainer-container');
const cardContainer = document.getElementById('card-container');
const ratingContainer = document.getElementById('rating-container');
const sessionEndElement = document.getElementById('session-end');
const backToTrainerBtn = document.getElementById('back-to-trainer-btn');
const backBtn = document.getElementById('back-btn');
const reloadFileBtn = document.getElementById('reload-file-btn');
const newCountEl = document.getElementById('new-count');
const dueCountEl = document.getElementById('due-count');
const doneCountEl = document.getElementById('done-count');
const masteredNumberEl = document.getElementById('mastered-number');
const uploadArea = document.getElementById('upload-area');
const resetButton = document.getElementById('reset-progress-btn');
const progressBar = document.getElementById('progress-bar'); // ►►► НОВАЯ ССЫЛКА НА ЭЛЕМЕНТ

// Sync UI Elements
const createSyncBtn = document.getElementById('create-sync-btn');
const joinSyncBtn = document.getElementById('join-sync-btn');
const disconnectSyncBtn = document.getElementById('disconnect-sync-btn');
const syncCodeDisplay = document.getElementById('sync-code-display');
const syncCodeEl = document.getElementById('sync-code');
const syncInputContainer = document.getElementById('sync-input-container');
const syncCodeInput = document.getElementById('sync-code-input');
const connectSyncBtn = document.getElementById('connect-sync-btn');
const cancelSyncBtn = document.getElementById('cancel-sync-btn');
const syncStatus = document.getElementById('sync-status');
const syncText = document.getElementById('sync-text');
const syncIndicator = document.getElementById('sync-indicator');
const syncIndicatorSmall = document.getElementById('sync-indicator-small');

// Card Structure Elements (for performance)
const cardInner = document.getElementById('card-inner');
const cardGermanWord = document.getElementById('card-german-word');
const cardAdditionalInfo = document.getElementById('card-additional-info');
const cardExamples = document.getElementById('card-examples');
const cardTranslation = document.getElementById('card-translation');

const DAILY_STUDIED_WORDS_KEY = 'daily_studied_words_v3';

class SyncManager {
    constructor() {
        this.currentSyncCode = null;
        this.isConnected = false;
        this.syncRef = null;
        this.lastSyncTime = 0;
        this.syncDebounceTimer = null;

        // SVG Icons for sync statuses
        this.icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.8"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-triangle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            disconnected: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-link-2-off"><path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>'
        };
        
        this.loadSyncSettings();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        createSyncBtn.addEventListener('click', () => this.createSync());
        joinSyncBtn.addEventListener('click', () => this.showJoinSync());
        disconnectSyncBtn.addEventListener('click', () => this.disconnectSync());
        connectSyncBtn.addEventListener('click', () => this.connectToSync());
        cancelSyncBtn.addEventListener('click', () => this.hideJoinSync());
        
        syncCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connectToSync();
            }
        });
    }
    
    generateSyncCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    loadSyncSettings() {
        const savedCode = localStorage.getItem('sync_code');
        if (savedCode) {
            this.currentSyncCode = savedCode;
            this.connectToExistingSync();
        }
    }
    
    async createSync() {
        try {
            const code = this.generateSyncCode();
            this.currentSyncCode = code;
            
            await database.ref(`sync_codes/${code}`).set({
                created: firebase.database.ServerValue.TIMESTAMP,
                data: this.getLocalData()
            });
            
            localStorage.setItem('sync_code', code);
            this.setupSyncListener();
            this.showSyncCode(code);
            this.updateSyncStatus('Синхронизация активна', this.icons.success);
            
        } catch (error) {
            console.error('Ошибка создания синхронизации:', error);
            alert('Ошибка создания синхронизации. Проверьте подключение к интернету.');
        }
    }
    
    showJoinSync() {
        syncInputContainer.classList.remove('hidden');
        createSyncBtn.classList.add('hidden');
        joinSyncBtn.classList.add('hidden');
        syncCodeInput.focus();
    }
    
    hideJoinSync() {
        syncInputContainer.classList.add('hidden');
        createSyncBtn.classList.remove('hidden');
        joinSyncBtn.classList.remove('hidden');
        syncCodeInput.value = '';
    }
    
    async connectToSync() {
        const code = syncCodeInput.value.trim().toUpperCase();
        
        if (!code) {
            alert('Введите код синхронизации');
            return;
        }
        
        try {
            const snapshot = await database.ref(`sync_codes/${code}`).once('value');
            
            if (!snapshot.exists()) {
                alert('Код синхронизации не найден');
                return;
            }
            
            this.currentSyncCode = code;
            localStorage.setItem('sync_code', code);
            
            const remoteData = snapshot.val().data;
            if (remoteData) {
                this.mergeRemoteData(remoteData);
            }
            
            this.setupSyncListener();
            this.hideJoinSync();
            this.updateSyncStatus('Синхронизация активна', this.icons.success);
            
        } catch (error) {
            console.error('Ошибка подключения к синхронизации:', error);
            alert('Ошибка подключения. Проверьте код и интернет-соединение.');
        }
    }
    
    async connectToExistingSync() {
        if (!this.currentSyncCode) return;
        
        try {
            const snapshot = await database.ref(`sync_codes/${this.currentSyncCode}`).once('value');
            
            if (snapshot.exists()) {
                this.setupSyncListener();
                this.updateSyncStatus('Синхронизация активна', this.icons.success);
            } else {
                this.disconnectSync();
            }
        } catch (error) {
            console.error('Ошибка подключения к существующей синхронизации:', error);
            this.updateSyncStatus('Ошибка синхронизации', this.icons.error);
        }
    }
    
    setupSyncListener() {
        if (!this.currentSyncCode) return;
        
        this.syncRef = database.ref(`sync_codes/${this.currentSyncCode}/data`);
        
        this.syncRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const remoteData = snapshot.val();
                const remoteTimestamp = remoteData.lastModified || 0;
                
                if (remoteTimestamp > this.lastSyncTime) {
                    this.mergeRemoteData(remoteData);
                    this.updateSyncStatus('Синхронизировано', this.icons.success);
                    
                    if (fullDeck.length > 0) {
                        updateStatsUI();
                        updateMasteredCount();
                    }
                }
            }
        });
        
        this.isConnected = true;
        disconnectSyncBtn.classList.remove('hidden');
        createSyncBtn.classList.add('hidden');
        joinSyncBtn.classList.add('hidden');
    }
    
    disconnectSync() {
        if (this.syncRef) {
            this.syncRef.off();
            this.syncRef = null;
        }
        
        this.currentSyncCode = null;
        this.isConnected = false;
        localStorage.removeItem('sync_code');
        
        syncCodeDisplay.classList.add('hidden');
        disconnectSyncBtn.classList.add('hidden');
        createSyncBtn.classList.remove('hidden');
        joinSyncBtn.classList.remove('hidden');
        
        this.updateSyncStatus('Синхронизация отключена', this.icons.disconnected);
    }
    
    showSyncCode(code) {
        syncCodeEl.textContent = code;
        syncCodeDisplay.classList.remove('hidden');
        disconnectSyncBtn.classList.remove('hidden');
        createSyncBtn.classList.add('hidden');
        joinSyncBtn.classList.add('hidden');
    }
    
    updateSyncStatus(text, iconHtml) {
        syncText.textContent = text;
        syncIndicator.innerHTML = iconHtml;
        syncIndicatorSmall.innerHTML = iconHtml;
    }
    
    getLocalData() {
        return {
            deck: fullDeck,
            dailyStats: JSON.parse(localStorage.getItem(DAILY_STATS_KEY) || '{}'),
            masteredWords: JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}'),
            lastModified: Date.now()
        };
    }
    
    mergeRemoteData(remoteData) {
        if (remoteData.deck && remoteData.deck.length > 0) {
            fullDeck = this.mergeDeckData(fullDeck, remoteData.deck);
            localStorage.setItem(DECK_KEY, JSON.stringify(fullDeck));
        }
        
        if (remoteData.dailyStats) {
            const localStats = JSON.parse(localStorage.getItem(DAILY_STATS_KEY) || '{}');
            const mergedStats = this.mergeDailyStats(localStats, remoteData.dailyStats);
            localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(mergedStats));
        }
        
        if (remoteData.masteredWords) {
            const localMastered = JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}');
            const mergedMastered = this.mergeMasteredWords(localMastered, remoteData.masteredWords);
            localStorage.setItem(MASTERED_KEY, JSON.stringify(mergedMastered));
        }
        
        this.lastSyncTime = Date.now();
    }
    
    mergeDeckData(local, remote) {
        const merged = new Map();
        
        local.forEach(card => {
            merged.set(card.id, card);
        });
        
        remote.forEach(remoteCard => {
            const localCard = merged.get(remoteCard.id);
            
            if (!localCard || new Date(remoteCard.nextReviewDate) > new Date(localCard.nextReviewDate)) {
                merged.set(remoteCard.id, remoteCard);
            }
        });
        
        return Array.from(merged.values());
    }
    
    mergeDailyStats(local, remote) {
        const merged = { ...local };
        
        Object.keys(remote).forEach(date => {
            merged[date] = {
                done: Math.max(merged[date]?.done || 0, remote[date].done)
            };
        });
        
        return merged;
    }
    
    mergeMasteredWords(local, remote) {
        const merged = { ...local };
        
        Object.keys(remote).forEach(cardId => {
            if (!merged[cardId] || new Date(remote[cardId].expires) > new Date(merged[cardId].expires)) {
                merged[cardId] = remote[cardId];
            }
        });
        
        return merged;
    }
    
    async syncToRemote() {
        if (!this.isConnected || !this.currentSyncCode) return;
        
        clearTimeout(this.syncDebounceTimer);
        this.syncDebounceTimer = setTimeout(async () => {
            try {
                await database.ref(`sync_codes/${this.currentSyncCode}/data`).set(this.getLocalData());
                this.lastSyncTime = Date.now();
                this.updateSyncStatus('Синхронизировано', this.icons.success);
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
                this.updateSyncStatus('Ошибка синхронизации', this.icons.error);
            }
        }, 1000); // Debounce Firebase writes
    }
}

const syncManager = new SyncManager();
// Set initial disconnected status on load
syncManager.updateSyncStatus('Синхронизация отключена', syncManager.icons.disconnected);


// Event Listeners for Upload Area
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

uploadArea.addEventListener('click', () => fileInput.click());

reloadFileBtn.addEventListener('click', () => {
    trainerContainer.classList.add('hidden');
    uploadContainer.classList.remove('hidden');
    backToTrainerBtn.classList.remove('hidden');
    sessionQueue = [];
    cardHistory = [];
    currentCard = null;
    window.sessionStats = { new: 0, due: 0, done: 0 };
    updateStatsUI();
});

backToTrainerBtn.addEventListener('click', () => {
    uploadContainer.classList.add('hidden');
    trainerContainer.classList.remove('hidden');
    backToTrainerBtn.classList.add('hidden');
});

resetButton.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить.')) {
        localStorage.removeItem(DECK_KEY);
        localStorage.removeItem(DAILY_STATS_KEY);
        localStorage.removeItem(MASTERED_KEY);
        localStorage.removeItem('sync_code');
        syncManager.disconnectSync();
        
        fullDeck = [];
        sessionQueue = [];
        cardHistory = [];
        currentCard = null;
        window.sessionStats = { new: 0, due: 0, done: 0 };
        
        updateStatsUI();
        updateMasteredCount();
        
        uploadContainer.classList.remove('hidden');
        trainerContainer.classList.add('hidden');
        backToTrainerBtn.classList.add('hidden');
        sessionEndElement.classList.add('hidden');
        
        alert('Прогресс сброшен!');
    }
});


let fullDeck = [];
let sessionQueue = [];
let currentCard = null;
let isCardFlipped = false;
let cardHistory = [];
const DECK_KEY = 'german_words_deck_v3';
const DAILY_STATS_KEY = 'daily_stats_v3';
const MASTERED_KEY = 'mastered_words_v3';

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

ratingContainer.addEventListener('click', handleRating);

backBtn.addEventListener('click', () => {
    if (cardHistory.length === 0) return;

    const lastCardState = cardHistory.pop();
    currentCard = lastCardState.card;
    
    sessionQueue.unshift(currentCard);

    if (lastCardState.rating >= 3) {
        const updatedStats = updateTodayStats(-1);
        window.sessionStats.done = updatedStats.done;
    }
    
    window.sessionStats.due = Math.max(0, window.sessionStats.due + 1);
    
    if (lastCardState.rating >= 5) {
        const masteredWords = JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}');
        if (masteredWords[lastCardState.cardId]) {
            delete masteredWords[lastCardState.cardId];
            localStorage.setItem(MASTERED_KEY, JSON.stringify(masteredWords));
            updateMasteredCount();
        }
    }

    updateStatsUI();
    updateBackButton();
    displayCard();
    
    if (!sessionEndElement.classList.contains('hidden')) {
        sessionEndElement.classList.add('hidden');
        cardContainer.classList.remove('hidden');
        ratingContainer.classList.remove('hidden');
    }
    
    saveProgress();
});

window.addEventListener('load', loadProgress);
cardInner.addEventListener('click', flipCard); // Attach flip listener once

function handleFile(file) {
    if (!file || !file.name.match(/\.(xlsx|xls)$/i)) {
        alert('Пожалуйста, выберите Excel файл (.xlsx или .xls)');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            parseAndInitDeck(json);
        } catch (error) {
            alert('Ошибка при чтении файла. Убедитесь, что файл не поврежден.');
            console.error('Ошибка парсинга файла:', error);
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseAndInitDeck(data) {
    if (!data || data.length < 2) {
        alert('Файл пуст или содержит недостаточно данных.');
        return;
    }
    
    const newWords = data.slice(1)
        .filter(row => row && row[1] && row[2])
        .map(row => ({
            id: row[0] || Math.random().toString(36).substr(2, 9),
            german: row[1] || '',
            translation: row[2] || '',
            additionalInfo1: row[3] || '',
            additionalInfo2: row[4] || '',
            example1: row[5] || '',
            example2: row[6] || '',
            example3: row[7] || '',
            interval: 0,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
            gender: detectGender(row[1] || '')
        }));
    
    if (newWords.length === 0) {
        alert('В файле не найдено подходящих данных. Проверьте формат файла.');
        return;
    }
    
    const existingWordsMap = new Map(fullDeck.map(word => [word.german, word]));
    let addedCount = 0;

    newWords.forEach(newWord => {
        const existingWord = existingWordsMap.get(newWord.german);
        if (existingWord) {
            Object.assign(existingWord, {
                translation: newWord.translation,
                additionalInfo1: newWord.additionalInfo1,
                additionalInfo2: newWord.additionalInfo2,
                example1: newWord.example1,
                example2: newWord.example2,
                example3: newWord.example3,
                gender: newWord.gender
            });
        } else {
            fullDeck.push(newWord);
            addedCount++;
        }
    });

    if (existingWordsMap.size > 0) {
         alert(`Файл обновлен! Добавлено ${addedCount} новых слов.`);
    } else {
        fullDeck = newWords;
    }

    saveProgress();
    startSession();
}

function detectGender(germanWord) {
    if (!germanWord) return null;
    const word = germanWord.trim().toLowerCase();
    if (word.startsWith('der ') || word.includes('(der)') || word.includes('- der')) return 'masculine';
    if (word.startsWith('die ') || word.includes('(die)') || word.includes('- die')) return 'feminine';
    if (word.startsWith('das ') || word.includes('(das)') || word.includes('- das')) return 'neuter';
    return null;
}

let saveDebounceTimer = null;
function saveProgress() {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        if (fullDeck.length > 0) {
            localStorage.setItem(DECK_KEY, JSON.stringify(fullDeck));
            syncManager.syncToRemote();
        }
    }, 1500); // Debounce saving to avoid excessive writes
}

function loadProgress() {
    const savedDeck = localStorage.getItem(DECK_KEY);
    if (savedDeck) {
        fullDeck = JSON.parse(savedDeck).map(card => {
            if (!card.gender) card.gender = detectGender(card.german);
            return card;
        });
        if (fullDeck.length > 0) {
            startSession();
        }
    }
}

function getTodayStats() {
    const today = new Date().toDateString();
    const stats = JSON.parse(localStorage.getItem(DAILY_STATS_KEY) || '{}');
    return stats[today] || { done: 0 };
}

function updateTodayStats(increment = 1) {
    const today = new Date().toDateString();
    const stats = JSON.parse(localStorage.getItem(DAILY_STATS_KEY) || '{}');
    if (!stats[today]) {
        stats[today] = { done: 0 };
    }
    stats[today].done += increment;
    localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
    syncManager.syncToRemote();
    return stats[today];
}

function startSession() {
    uploadContainer.classList.add('hidden');
    trainerContainer.classList.remove('hidden');
    sessionEndElement.classList.add('hidden');
    backToTrainerBtn.classList.add('hidden');
    
    const now = new Date();
    const dueCards = fullDeck.filter(card => new Date(card.nextReviewDate) <= now);
    
    sessionQueue = dueCards.sort(() => Math.random() - 0.5);
    cardHistory = [];
    
    window.sessionStats = {
        new: fullDeck.length,
        due: dueCards.length,
        done: getTodayStats().done
    };
    
    updateStatsUI();
    updateMasteredCount();
    
    if (sessionQueue.length > 0) {
        nextCard();
    } else {
        endSession();
    }
}

// ►►► НОВАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ПРОГРЕСС-БАРА
function updateProgressBar() {
    if (!window.sessionStats || window.sessionStats.new === 0) {
        progressBar.style.width = '0%';
        return;
    }
    const totalWords = window.sessionStats.new;
    const studiedToday = window.sessionStats.done;
    const percentage = (studiedToday / totalWords) * 100;
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
}


function updateStatsUI() {
    newCountEl.textContent = window.sessionStats.new;
    dueCountEl.textContent = window.sessionStats.due;
    doneCountEl.textContent = window.sessionStats.done;
    updateProgressBar(); // ►►► ВЫЗЫВАЕМ ОБНОВЛЕНИЕ ПРОГРЕСС-БАРА
}

function nextCard() {
    if (sessionQueue.length === 0) {
        const readyCards = fullDeck.filter(card => new Date(card.nextReviewDate) <= new Date());
        if (readyCards.length > 0) {
            sessionQueue = readyCards.sort(() => Math.random() - 0.5);
        } else {
            endSession();
            return;
        }
    }
    
    cardTranslation.textContent = ''; 

    currentCard = sessionQueue.shift();
    isCardFlipped = false;
    cardInner.classList.remove('is-flipped');
    updateBackButton();
    displayCard();
    
    if (speechEnabled) {
        speakCurrentCard();
    }
}

function updateBackButton() {
    backBtn.disabled = cardHistory.length === 0;
}

function displayCard() {
    ratingContainer.classList.remove('hidden');

    let formsToHighlight = [];
    if (currentCard.german) {
        formsToHighlight.push(...currentCard.german.toLowerCase().split(/,\s*|\s+/));
    }
    if (currentCard.additionalInfo1) {
        formsToHighlight.push(...(currentCard.additionalInfo1.match(/\w+/g) || []).map(f => f.toLowerCase()));
    }
    formsToHighlight = [...new Set(formsToHighlight)].filter(w => w && !['der', 'die', 'das'].includes(w));

    const smartPatterns = formsToHighlight.flatMap(word => {
        const patterns = [word];
        if (word.endsWith('en')) {
            const root = word.slice(0, -2);
            patterns.push(`${root}e`, `${root}t`);
        } else if (word.endsWith('n') && word.length > 2) {
            patterns.push(word.slice(0, -1) + 'e');
        }
        return patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    });

    const regex = smartPatterns.length ? new RegExp(`\\b(${[...new Set(smartPatterns)].join('|')})\\b`, 'gi') : null;
    const highlight = (text) => regex ? text.replace(regex, '<strong>$&</strong>') : text;

    cardGermanWord.className = `german-word ${currentCard.gender || ''}`;
    cardGermanWord.textContent = currentCard.german;

    cardAdditionalInfo.innerHTML = 
        (currentCard.additionalInfo1 ? `<div class="additional-info">${currentCard.additionalInfo1}</div>` : '') +
        (currentCard.additionalInfo2 ? `<div class="additional-info">${currentCard.additionalInfo2}</div>` : '');

    cardExamples.innerHTML = 
        (currentCard.example1 ? `<div class="example">${highlight(currentCard.example1)}</div>` : '') +
        (currentCard.example2 ? `<div class="example">${highlight(currentCard.example2)}</div>` : '') +
        (currentCard.example3 ? `<div class="example">${highlight(currentCard.example3)}</div>` : '');

    if (speechEnabled) {
        speakCurrentCard();
    }
}

function flipCard() {
    isCardFlipped = !isCardFlipped;
    cardInner.classList.toggle('is-flipped');
    if (isCardFlipped) {
        cardTranslation.textContent = currentCard.translation;
    } else {
        cardTranslation.textContent = '';
    }
}

let speechEnabled = false;
let speakExamplesEnabled = false;

function toggleSpeech() {
    speechEnabled = !speechEnabled;
    const toggleSpeechBtn = document.getElementById('toggle-speech-btn');
    const toggleExamplesSpeechBtn = document.getElementById('toggle-examples-speech-btn');

    toggleSpeechBtn.innerHTML = speechEnabled ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-volume-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-volume-x"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    toggleSpeechBtn.title = speechEnabled ? 'Выключить озвучивание' : 'Включить озвучивание';

    if (toggleExamplesSpeechBtn) {
        toggleExamplesSpeechBtn.disabled = !speechEnabled;
        if (speechEnabled) {
            speakExamplesEnabled = true;
            toggleExamplesSpeechBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            toggleExamplesSpeechBtn.title = 'Выключить озвучивание примеров';
        } else {
            speakExamplesEnabled = false;
            toggleExamplesSpeechBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>';
            toggleExamplesSpeechBtn.title = 'Включить озвучивание примеров';
        }
    }
    
    if (speechEnabled && currentCard) {
        speakCurrentCard();
    }
}

function speakCurrentCard() {
    if (!currentCard || !speechEnabled || typeof responsiveVoice === 'undefined' || responsiveVoice.isPlaying()) return;
    
    let textToSpeak = [
        currentCard.german,
        currentCard.additionalInfo1,
        ...(speakExamplesEnabled ? [currentCard.example1, currentCard.example2, currentCard.example3] : [])
    ].filter(Boolean).join('. ');
    
    responsiveVoice.speak(textToSpeak, "Deutsch Male", { pitch: 1.2, rate: 1.0, volume: 1 });
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleSpeechButton = document.getElementById('toggle-speech-btn');
    const toggleExamplesSpeechButton = document.getElementById('toggle-examples-speech-btn');

    if (toggleSpeechButton) {
        toggleSpeechButton.addEventListener('click', toggleSpeech);
    }

    if (toggleExamplesSpeechButton) {
        toggleExamplesSpeechButton.disabled = true;
        toggleExamplesSpeechButton.addEventListener('click', () => {
            speakExamplesEnabled = !speakExamplesEnabled;
            toggleExamplesSpeechButton.innerHTML = speakExamplesEnabled
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>';
            toggleExamplesSpeechButton.title = speakExamplesEnabled ? 'Выключить озвучивание примеров' : 'Включить озвучивание примеров';

            if (speakExamplesEnabled && speechEnabled && currentCard) {
                speakCurrentCard();
            }
        });
    }
});

function handleRating(event) {
    if (!event.target.matches('.rating-btn')) return;

    const ratingButtons = document.querySelectorAll('.rating-btn');
    ratingButtons.forEach(btn => btn.disabled = true);

    const rating = parseInt(event.target.dataset.rating, 10);
    
    cardHistory.push({
        card: { ...currentCard },
        rating: rating,
        isNew: currentCard.interval === 0,
        cardId: currentCard.id
    });

    updateMasteredWords(currentCard.id, rating);
    updateCardInterval(rating);
    
    if (rating >= 3) {
        window.sessionStats.done = updateTodayStats(1).done;
    }
    
    window.sessionStats.due = Math.max(0, window.sessionStats.due - 1);

    updateStatsUI();
    saveProgress();
    
    setTimeout(() => {
        nextCard();
        ratingButtons.forEach(btn => btn.disabled = false);
    }, 300);
}

function updateCardInterval(rating) {
    const MIN_EASE = 1.3;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    let { easeFactor, interval } = currentCard;
    const now = new Date();

    if (rating < 3) {
        interval = 0;
        currentCard.nextReviewDate = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
        sessionQueue.push(currentCard);
    } else {
        easeFactor = easeFactor + (0.1 - (5 - rating) * 0.08 - (5 - rating) * 0.02);
        if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

        if (interval === 0) {
            interval = 1;
        } else if (interval === 1) {
            interval = 4;
        } else {
            interval = Math.ceil(interval * easeFactor);
        }
        currentCard.nextReviewDate = new Date(now.getTime() + interval * ONE_DAY_MS).toISOString();
    }
    
    currentCard.interval = interval;
    currentCard.easeFactor = easeFactor;
    currentCard.lastReviewDate = now.toISOString();
}

function updateMasteredWords(cardId, rating) {
    let masteredWords = JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}');
    
    if (rating >= 5) {
        masteredWords[cardId] = {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
    } else {
        delete masteredWords[cardId];
    }

    localStorage.setItem(MASTERED_KEY, JSON.stringify(masteredWords));
    updateMasteredCount();
}

function updateMasteredCount() {
    const now = new Date();
    const mastered = JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}');
    
    const activeMastered = Object.keys(mastered).filter(cardId => new Date(mastered[cardId].expires) > now);
    
    if (activeMastered.length !== Object.keys(mastered).length) {
        const updatedMastered = activeMastered.reduce((obj, key) => {
            obj[key] = mastered[key];
            return obj;
        }, {});
        localStorage.setItem(MASTERED_KEY, JSON.stringify(updatedMastered));
    }
    
    masteredNumberEl.textContent = activeMastered.length;
}

function endSession() {
    cardContainer.classList.add('hidden');
    ratingContainer.classList.add('hidden');
    sessionEndElement.classList.remove('hidden');

    const futureCards = fullDeck.filter(card => new Date(card.nextReviewDate) > new Date());

    if (futureCards.length > 0) {
        const nextReviewDate = new Date(Math.min(...futureCards.map(card => new Date(card.nextReviewDate))));
        const diffMinutes = Math.ceil((nextReviewDate - new Date()) / 60000);
        
        let timeToNext = `примерно через ${diffMinutes} мин.`;
        if (diffMinutes >= 60) timeToNext = `примерно через ${Math.round(diffMinutes / 60)} ч.`;
        if (diffMinutes >= 1440) timeToNext = `примерно через ${Math.round(diffMinutes / 1440)} д.`;
        
        document.getElementById('end-message-text').textContent = `Вы отлично поработали! Следующее повторение ${timeToNext}`;
    } else {
        document.getElementById('end-message-text').textContent = 'Поздравляем! Вы выучили все слова.';
    }
}

function setupAutoSync() {
    window.addEventListener('online', () => syncManager.connectToExistingSync());
    window.addEventListener('offline', () => syncManager.updateSyncStatus('Оффлайн режим', syncManager.icons.error));
    window.addEventListener('beforeunload', () => {
        if (syncManager.isConnected) syncManager.syncToRemote();
    });
}

setupAutoSync();