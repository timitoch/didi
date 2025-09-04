const firebaseConfig = {
    apiKey: "AIzaSyDecNXBkdSPE7Vhl3RgbgwOcjLNvPcxsPw",
    authDomain: "wordlab-sync.firebaseapp.com",
    databaseURL: "https://wordlab-sync-default-rtdb.europe-west1.firebase database.app",
    projectId: "wordlab-sync",
    storageBucket: "wordlab-sync.firebase storage.app",
    messagingSenderId: "1095424207075",
    appId: "1:1095424207075:web:0c2e07e78066db3025fdd6"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

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
const DAILY_STUDIED_WORDS_KEY = 'daily_studied_words_v3';

const ICON_VOLUME_ON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-volume-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
const ICON_VOLUME_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-volume-x"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
const ICON_BOOK_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
const ICON_BOOK = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-book"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V6H6.5A2.5 2.5 0 0 0 4 8.5v11z"></path></svg>`;


class SyncManager {
    constructor() {
        this.currentSyncCode = null;
        this.isConnected = false;
        this.syncRef = null;
        this.lastSyncTime = 0;
        this.syncDebounceTimer = null;
        
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
            this.updateSyncStatus('Синхронизация активна', '🟢');
            
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
            this.updateSyncStatus('Синхронизация активна', '🟢');
            
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
                this.updateSyncStatus('Синхронизация активна', '🟢');
            } else {
                this.disconnectSync();
            }
        } catch (error) {
            console.error('Ошибка подключения к существующей синхронизации:', error);
            this.updateSyncStatus('Ошибка синхронизации', '🔴');
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
                    this.updateSyncStatus('Синхронизировано', '🟢');
                    
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
        
        this.updateSyncStatus('Синхронизация отключена', '🔄');
    }
    
    showSyncCode(code) {
        syncCodeEl.textContent = code;
        syncCodeDisplay.classList.remove('hidden');
        disconnectSyncBtn.classList.remove('hidden');
        createSyncBtn.classList.add('hidden');
        joinSyncBtn.classList.add('hidden');
    }
    
    updateSyncStatus(text, indicator) {
        syncText.textContent = text;
        syncIndicator.textContent = indicator;
        syncIndicatorSmall.textContent = indicator;
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
            
            if (!localCard) {
                merged.set(remoteCard.id, remoteCard);
            } else {
                const localNext = new Date(localCard.nextReviewDate);
                const remoteNext = new Date(remoteCard.nextReviewDate);
                
                if (remoteNext > localNext) {
                    merged.set(remoteCard.id, remoteCard);
                }
            }
        });
        
        return Array.from(merged.values());
    }
    
    mergeDailyStats(local, remote) {
        const merged = { ...local };
        
        Object.keys(remote).forEach(date => {
            if (!merged[date]) {
                merged[date] = remote[date];
            } else {
                merged[date].done = Math.max(merged[date].done, remote[date].done);
            }
        });
        
        return merged;
    }
    
    mergeMasteredWords(local, remote) {
        const merged = { ...local };
        
        Object.keys(remote).forEach(cardId => {
            if (!merged[cardId]) {
                merged[cardId] = remote[cardId];
            } else {
                const localExpires = new Date(merged[cardId].expires);
                const remoteExpires = new Date(remote[cardId].expires);
                
                if (remoteExpires > localExpires) {
                    merged[cardId] = remote[cardId];
                }
            }
        });
        
        return merged;
    }
    
    async syncToRemote() {
        if (!this.isConnected || !this.currentSyncCode) return;
        
        clearTimeout(this.syncDebounceTimer);
        this.syncDebounceTimer = setTimeout(async () => {
            try {
                const data = this.getLocalData();
                await database.ref(`sync_codes/${this.currentSyncCode}/data`).set(data);
                this.lastSyncTime = Date.now();
                this.updateSyncStatus('Синхронизировано', '🟢');
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
                this.updateSyncStatus('Ошибка синхронизации', '🔴');
            }
        }, 1000);
    }
}

const syncManager = new SyncManager();

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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

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
    const confirmation = confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить.');
    if (confirmation) {
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
    if (cardHistory.length === 0) {
        return;
    }

    const lastCardState = cardHistory.pop();
    currentCard = lastCardState.card;
    const { rating, isNew, cardId } = lastCardState;
    
    sessionQueue.unshift(currentCard);

    if (rating >= 3) {
        const updatedStats = updateTodayStats(-1);
        window.sessionStats.done = updatedStats.done;
    }
    
    window.sessionStats.due = Math.max(0, window.sessionStats.due + 1);
    
    if (rating >= 5) {
        const masteredWords = JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}');
        if (masteredWords[cardId]) {
            delete masteredWords[cardId];
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

function handleFile(file) {
    if (!file) return;
    
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
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
    
    const newWords = data
        .slice(1)
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
    
    if (fullDeck.length > 0) {
        const existingWords = new Map();
        fullDeck.forEach(word => {
            existingWords.set(word.german, word);
        });
        
        const mergedDeck = [];
        newWords.forEach(newWord => {
            const existingWord = existingWords.get(newWord.german);
            if (existingWord) {
                mergedDeck.push({
                    ...existingWord,
                    german: newWord.german,
                    translation: newWord.translation,
                    additionalInfo1: newWord.additionalInfo1,
                    additionalInfo2: newWord.additionalInfo2,
                    example1: newWord.example1,
                    example2: newWord.example2,
                    example3: newWord.example3,
                    gender: newWord.gender
                });
            } else {
                mergedDeck.push(newWord);
            }
        });
        
        fullDeck = mergedDeck;
        alert(`Файл обновлен! Добавлено ${newWords.length - existingWords.size} новых слов.`);
    } else {
        fullDeck = newWords;
    }
    
    saveProgress();
    startSession();
}

function detectGender(germanWord) {
    if (!germanWord) return null;
    
    const word = germanWord.trim().toLowerCase();
    
    if (word.startsWith('der ')) {
        return 'masculine';
    } else if (word.startsWith('die ')) {
        return 'feminine';
    } else if (word.startsWith('das ')) {
        return 'neuter';
    }
    
    if (word.includes('(der)') || word.includes('- der')) {
        return 'masculine';
    } else if (word.includes('(die)') || word.includes('- die')) {
        return 'feminine';
    } else if (word.includes('(das)') || word.includes('- das')) {
        return 'neuter';
    }
    
    return null;
}

function saveProgress() {
    if (fullDeck.length > 0) {
        localStorage.setItem(DECK_KEY, JSON.stringify(fullDeck));
        syncManager.syncToRemote();
    }
}

function loadProgress() {
    const savedDeck = localStorage.getItem(DECK_KEY);
    if (savedDeck) {
        fullDeck = JSON.parse(savedDeck);
        fullDeck = fullDeck.map(card => {
            if (!card.gender) {
                card.gender = detectGender(card.german);
            }
            return card;
        });
        if (fullDeck.length > 0) {
            startSession();
        }
    }
}

function getTodayStats() {
    const today = new Date().toDateString();
    const saved = localStorage.getItem(DAILY_STATS_KEY);
    let stats = saved ? JSON.parse(saved) : {};
    
    if (!stats[today]) {
        stats[today] = { done: 0 };
    }
    
    return stats[today];
}

function updateTodayStats(increment = 1) {
    const today = new Date().toDateString();
    const saved = localStorage.getItem(DAILY_STATS_KEY);
    let stats = saved ? JSON.parse(saved) : {};
    
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
    
    const todayStats = getTodayStats();
    
    const stats = {
        new: fullDeck.length,
        due: dueCards.length,
        done: todayStats.done
    };
    
    window.sessionStats = stats;
    updateStatsUI();
    updateMasteredCount();
    
    if (sessionQueue.length > 0) {
        nextCard();
    } else {
        endSession();
    }
}

function updateStatsUI() {
    newCountEl.textContent = window.sessionStats.new;
    dueCountEl.textContent = window.sessionStats.due;
    doneCountEl.textContent = window.sessionStats.done;
}

function nextCard() {
    if (sessionQueue.length === 0) {
        if (checkSessionCompletion()) {
            return;
        }
        const readyCards = getCardsReadyForReview();
        if (readyCards.length > 0) {
            sessionQueue = [...readyCards].sort(() => Math.random() - 0.5);
        } else {
            endSession();
            return;
        }
    }
    
    currentCard = sessionQueue.shift();
    isCardFlipped = false;
    updateBackButton();
    displayCard();
    
    speakCurrentCard();
}

function goToPreviousCard() {
    if (cardHistory.length === 0) return;
    
    if (currentCard) {
        sessionQueue.unshift(currentCard);
    }
    
    currentCard = cardHistory.pop();
    isCardFlipped = false;
    updateBackButton();
    displayCard();
    
    if (!sessionEndElement.classList.contains('hidden')) {
        sessionEndElement.classList.add('hidden');
        cardContainer.classList.remove('hidden');
        ratingContainer.classList.remove('hidden');
    }
    
    updateStatsUI();
}

function updateBackButton() {
    backBtn.disabled = cardHistory.length === 0;
}

function displayCard() {
    ratingContainer.classList.remove('hidden');

    let formsToHighlight = [];

    if (currentCard.german) {
        const nounForms = currentCard.german.toLowerCase().split(/,\s*|\s+/);
        formsToHighlight = formsToHighlight.concat(nounForms);
    }

    if (currentCard.additionalInfo1) {
        const additionalForms = currentCard.additionalInfo1.match(/\w+/g);
        if (additionalForms) {
            formsToHighlight = formsToHighlight.concat(additionalForms.map(f => f.toLowerCase()));
        }
    }
    
    formsToHighlight = [...new Set(formsToHighlight)]
                       .filter(word => word && word !== 'der' && word !== 'die' && word !== 'das');
    
    let genderClass = '';
    if (currentCard.gender === 'masculine') {
        genderClass = 'masculine';
    } else if (currentCard.gender === 'feminine') {
        genderClass = 'feminine';
    } else if (currentCard.gender === 'neuter') {
        genderClass = 'neuter';
    }
    
    
    let additionalInfo = '';
    if (currentCard.additionalInfo1) {
        additionalInfo += `<div class="additional-info">${currentCard.additionalInfo1}</div>`;
    }
    if (currentCard.additionalInfo2) {
        additionalInfo += `<div class="additional-info">${currentCard.additionalInfo2}</div>`;
    }
    
    let examples = '';
    if (currentCard.example1) {
        const highlightedExample = highlightWordsInExample(currentCard.example1, formsToHighlight);
        examples += `<div class="example">${highlightedExample}</div>`;
    }
    if (currentCard.example2) {
        const highlightedExample = highlightWordsInExample(currentCard.example2, formsToHighlight);
        examples += `<div class="example">${highlightedExample}</div>`;
    }
    if (currentCard.example3) {
        const highlightedExample = highlightWordsInExample(currentCard.example3, formsToHighlight);
        examples += `<div class="example">${highlightedExample}</div>`;
    }
    
    cardContainer.innerHTML = `
    <div class="card-inner" id="card-inner">
        <div class="card-face card-front">
            <div class="german-word-container">
                <div class="german-word ${genderClass}">${currentCard.german}</div>
            </div>
            ${additionalInfo}
            ${examples}
        </div>
        <div class="card-face card-back">
            <div class="translation">${currentCard.translation}</div>
        </div>
    </div>
`;

    document.getElementById('card-inner').addEventListener('click', flipCard);
}

function highlightWordsInExample(exampleText, wordsToHighlight) {
    if (!exampleText || !wordsToHighlight || wordsToHighlight.length === 0) {
        return exampleText;
    }

    const smartPatterns = wordsToHighlight.flatMap(word => {
        const patterns = [word];
        
        if (word.endsWith('en')) {
            const root = word.slice(0, -2);
            patterns.push(`${root}e`, `${root}t`);
        } 
        else if (word.endsWith('n') && word.length > 2) {
            const root = word.slice(0, -1);
            patterns.push(`${root}e`);
        }

        return patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    });

    const regexPattern = [...new Set(smartPatterns)].join('|');
    const regex = new RegExp(`\\b(${regexPattern})\\b`, 'gi');
    const highlightedText = exampleText.replace(regex, `<strong>$&</strong>`);

    return highlightedText;
}

function flipCard() {
    const cardInner = document.getElementById('card-inner');
    
    if (!isCardFlipped) {
        cardInner.classList.add('is-flipped');
        isCardFlipped = true;
    } else {
        cardInner.classList.remove('is-flipped');
        isCardFlipped = false;
    }
}

let speechEnabled = false; 
let speakExamplesEnabled = false; 

function toggleSpeech() {
    speechEnabled = !speechEnabled;
    const toggleButton = document.getElementById('toggle-speech-btn');
    const toggleExamplesButton = document.getElementById('toggle-examples-speech-btn');

    if (toggleButton) {
        // Заменяем смайлики на SVG-иконки
        toggleButton.innerHTML = speechEnabled ? ICON_VOLUME_ON : ICON_VOLUME_OFF;
        toggleButton.title = speechEnabled ? 'Выключить озвучивание' : 'Включить озвучивание';
    }
    
    // Новая логика для кнопки примеров
    if (toggleExamplesButton) {
        toggleExamplesButton.disabled = !speechEnabled;
    }

    if (!speechEnabled) {
        speakExamplesEnabled = false;
        if (toggleExamplesButton) {
            // Заменяем смайлик на SVG-иконку
            toggleExamplesButton.innerHTML = ICON_BOOK_OPEN; 
            toggleExamplesButton.title = 'Включить озвучивание примеров';
        }
    }

    if (speechEnabled && currentCard) {
        speakCurrentCard();
    }
}

function toggleExamplesSpeech() {
    if (!speechEnabled) {
        return;
    }

    speakExamplesEnabled = !speakExamplesEnabled;
    const toggleExamplesButton = document.getElementById('toggle-examples-speech-btn');
    if (toggleExamplesButton) {
        // Заменяем смайлики на SVG-иконки
        toggleExamplesButton.innerHTML = speakExamplesEnabled ? ICON_BOOK : ICON_BOOK_OPEN;
        toggleExamplesButton.title = speakExamplesEnabled ? 'Выключить озвучивание примеров' : 'Включить озвучивание примеров';
    }
    if (currentCard) {
        speakCurrentCard();
    }
}


function speakCurrentCard() {
    if (!speechEnabled) return;

    let textToSpeak = currentCard.german;

    if (currentCard.additionalInfo1) {
        textToSpeak += `. ${currentCard.additionalInfo1}`;
    }

    if (speakExamplesEnabled) {
        if (currentCard.example1) {
            textToSpeak += `. ${currentCard.example1}`;
        }
        if (currentCard.example2) {
            textToSpeak += `. ${currentCard.example2}`;
        }
        if (currentCard.example3) {
            textToSpeak += `. ${currentCard.example3}`;
        }
    }
    
    speakGermanWord(textToSpeak);
}

function speakGermanWord(text) {
    if (typeof responsiveVoice !== 'undefined') {
        responsiveVoice.speak(text, "Deutsch Male", {
            pitch: 1.2,
            rate: 1.0,
            volume: 1
        });
    } else {
        console.error("ResponsiveVoice.js не загружен.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleSpeechButton = document.getElementById('toggle-speech-btn');
    const toggleExamplesSpeechButton = document.getElementById('toggle-examples-speech-btn');

    // Сделайте кнопку неактивной при загрузке
    if (toggleExamplesSpeechButton) {
        toggleExamplesSpeechButton.disabled = true;
    }

    if (toggleSpeechButton) {
        toggleSpeechButton.addEventListener('click', toggleSpeech);
    }

    if (toggleExamplesSpeechButton) {
        toggleExamplesSpeechButton.addEventListener('click', toggleExamplesSpeech);
    }
});


function handleRating(event) {
    if (!event.target.matches('.rating-btn')) return;

    const ratingButtons = document.querySelectorAll('.rating-btn');
    ratingButtons.forEach(btn => btn.disabled = true);

    const rating = parseInt(event.target.dataset.rating, 10);
    const isNew = currentCard.interval === 0;

    const cardState = {
        card: { ...currentCard },
        rating: rating,
        isNew: isNew,
        cardId: currentCard.id
    };
    cardHistory.push(cardState);

    updateMasteredWords(currentCard.id, rating);

    updateCardInterval(rating);
    
    if (rating >= 3) {
        const updatedStats = updateTodayStats(1);
        window.sessionStats.done = updatedStats.done;
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
    let { easeFactor, interval, lastReviewDate } = currentCard;
    const now = new Date();

    if (rating < 3) {
        interval = 5 * 60 * 1000; 
        easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    } else {
        if (interval === 0) {
            interval = 0.5;
        } else {
            interval = interval * easeFactor;
        }
        
        if (rating < 5) {
            easeFactor = Math.max(MIN_EASE, easeFactor - 0.1);
        } else {
            easeFactor += 0.1;
        }
    }
    
    currentCard.interval = interval;
    currentCard.easeFactor = easeFactor;
    currentCard.lastReviewDate = now.toISOString();
    
    const nextReview = new Date(now.getTime() + (rating < 3 ? 5 * 60 * 1000 : interval * ONE_DAY_MS));
    currentCard.nextReviewDate = nextReview.toISOString();
}

function previewNextReviewDate(card, rating) {
    const MIN_EASE = 1.3;
    let easeFactor = card.easeFactor || 2.5;
    let interval = card.interval || 0;

    if (rating < 3) {
        return new Date(Date.now() + 5 * 60 * 1000);
    }

    if (interval === 0) {
        interval = 1;
    } else if (interval === 1) {
        interval = 4;
    } else {
        interval = Math.round(interval * easeFactor);
    }

    return new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
}

function updateMasteredWords(cardId, rating) {
    let masteredWords = JSON.parse(localStorage.getItem(MASTERED_KEY) || '{}');
    
    if (rating >= 5) {
        masteredWords[cardId] = {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
    } else {
        if (masteredWords[cardId]) {
            delete masteredWords[cardId];
        }
    }

    localStorage.setItem(MASTERED_KEY, JSON.stringify(masteredWords));
    updateMasteredCount();
}

function updateMasteredCount() {
    const now = new Date();
    const saved = localStorage.getItem(MASTERED_KEY);
    let mastered = saved ? JSON.parse(saved) : {};
    
    for (const [cardId, data] of Object.entries(mastered)) {
        if (data && new Date(data.expires) <= now) {
            delete mastered[cardId];
        }
    }
    
    localStorage.setItem(MASTERED_KEY, JSON.stringify(mastered));
    
    const count = Object.keys(mastered).length;
    masteredNumberEl.textContent = count;
}

function endSession() {
    cardContainer.classList.add('hidden');
    ratingContainer.classList.add('hidden');
    
    sessionEndElement.classList.remove('hidden');

    const endMessageText = document.getElementById('end-message-text');
    const restartBtn = document.getElementById('restart-btn');
    
    restartBtn.classList.remove('hidden');

    const futureCards = fullDeck.filter(card => new Date(card.nextReviewDate) > new Date());

    if (futureCards.length > 0) {
        const nextReviewDate = new Date(Math.min(...futureCards.map(card => new Date(card.nextReviewDate))));
        const diffMinutes = Math.ceil((nextReviewDate - new Date()) / (1000 * 60));
        
        let timeToNext = '';
        if (diffMinutes < 60) {
            timeToNext = `примерно через ${diffMinutes} мин.`;
        } else if (diffMinutes < 1440) {
            timeToNext = `примерно через ${Math.round(diffMinutes / 60)} ч.`;
        } else {
            timeToNext = `примерно через ${Math.round(diffMinutes / 1440)} д.`;
        }
        
        endMessageText.textContent = `Вы отлично поработали! Следующее повторение ${timeToNext}`;
    } else {
        endMessageText.textContent = 'Поздравляем! Вы выучили все слова.';
    }
}

function setupAutoSync() {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        
        if ([DECK_KEY, DAILY_STATS_KEY, MASTERED_KEY].includes(key)) {
            if (syncManager.isConnected) {
                syncManager.syncToRemote();
            }
        }
    };
    
    setInterval(() => {
        if (syncManager.isConnected) {
            syncManager.updateSyncStatus('Синхронизация активна', '🟢');
        }
    }, 30000);
}

function handleConnectionError() {
    syncManager.updateSyncStatus('Нет соединения', '🔴');
    
    setTimeout(() => {
        if (syncManager.currentSyncCode && !syncManager.isConnected) {
            syncManager.connectToExistingSync();
        }
    }, 30000);
}

window.addEventListener('online', () => {
    if (syncManager.currentSyncCode && !syncManager.isConnected) {
        syncManager.connectToExistingSync();
    }
});

window.addEventListener('offline', () => {
    syncManager.updateSyncStatus('Оффлайн режим', '🔴');
});

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#ef4444';
    } else {
        notification.style.backgroundColor = '#3b82f6';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyles);

const originalSyncToRemote = syncManager.syncToRemote;
syncManager.syncToRemote = async function() {
    try {
        await originalSyncToRemote.call(this);
        if (this.lastSyncStatus === 'error') {
            showNotification('Синхронизация восстановлена', 'success');
        }
        this.lastSyncStatus = 'success';
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        this.updateSyncStatus('Ошибка синхронизации', '🔴');
        this.lastSyncStatus = 'error';
        showNotification('Ошибка синхронизации', 'error');
    }
};

const originalConnectToSync = syncManager.connectToSync;
syncManager.connectToSync = async function() {
    try {
        await originalConnectToSync.call(this);
        showNotification('Подключено к синхронизации', 'success');
    } catch (error) {
        showNotification('Ошибка подключения', 'error');
        throw error;
    }
};

setupAutoSync();

window.addEventListener('beforeunload', () => {
    if (syncManager.isConnected) {
        syncManager.syncToRemote();
    }
});

function checkSyncStatus() {
    if (syncManager.isConnected && syncManager.currentSyncCode) {
        return {
            connected: true,
            code: syncManager.currentSyncCode,
            lastSync: syncManager.lastSyncTime
        };
    }
    return {
        connected: false,
        code: null,
        lastSync: null
    };
}

function getCardsReadyForReview() {
    const now = new Date();
    return fullDeck.filter(card => {
        const nextReviewDate = new Date(card.nextReviewDate);
        return nextReviewDate <= now;
    });
}

function checkSessionCompletion() {
    const readyCards = getCardsReadyForReview();
    
    if (readyCards.length === 0 && sessionQueue.length === 0) {
        endSession();
        return true;
    }
    return false;
}

function debugShowNextReviewTimes() {
    console.log('Время следующего повторения для каждого слова:');
    fullDeck.forEach((card, index) => {
        const nextReview = new Date(card.nextReviewDate);
        const now = new Date();
        const diffMinutes = Math.round((nextReview - now) / (1000 * 60));
        
        console.log(`${index + 1}. ${card.german} - через ${diffMinutes} минут (${nextReview.toLocaleString()})`);
    });
}

window.debugReviewTimes = debugShowNextReviewTimes;
window.syncStatus = checkSyncStatus;

console.log('WordLab синхронизация инициализирована');
console.log('Для проверки статуса используйте: window.syncStatus()');