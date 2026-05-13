const folderView = document.getElementById('folder-view');
const listView = document.getElementById('list-view');
const calcView = document.getElementById('calc-view');
const searchBar = document.getElementById('search-bar');
const historyPanel = document.getElementById('history-panel');
const canvas = document.getElementById('graphCanvas'), ctx = canvas.getContext('2d');

// Check if required elements exist
if (!folderView || !listView || !calcView || !searchBar || !historyPanel) {
    console.error('Required DOM elements not found. Page may not load correctly.');
    alert('Feil: Noen nødvendige elementer mangler. Siden kan ikke lastes riktig.');
}

function gcd(a, b) { return b === 0 ? Math.abs(a) : gcd(b, a % b); }

function setTheme(primary, secondary, index) {
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--secondary', secondary);
    document.querySelectorAll('.theme-dot').forEach((dot, idx) => dot.classList.toggle('active', idx === index));
    localStorage.setItem('calcTheme', JSON.stringify({p: primary, s: secondary, i: index}));
}

function setBackground(mode) {
    // Remove all background mode classes
    document.documentElement.classList.remove('bg-light', 'bg-dim');
    
    // Add the new mode class if not normal
    if (mode === 'light') {
        document.documentElement.classList.add('bg-light');
    } else if (mode === 'dim') {
        document.documentElement.classList.add('bg-dim');
    }
    
    // Update button states
    document.querySelectorAll('#background-selector .appearance-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', ['light', 'normal', 'dim'][idx] === mode);
    });
    localStorage.setItem('calcBackground', mode);
}

function setFontSize(size) {
    let scale;
    switch(size) {
        case 'compact': scale = 0.85; break;
        case 'large': scale = 1.15; break;
        default: scale = 1;
    }
    document.documentElement.style.setProperty('--font-scale', scale);
    document.querySelectorAll('#fontsize-selector .appearance-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', ['compact', 'normal', 'large'][idx] === size);
    });
    localStorage.setItem('calcFontSize', size);
}

function setContrast(mode) {
    let boost = mode === 'high' ? 0.3 : 0;
    document.documentElement.style.setProperty('--contrast-boost', boost);
    document.querySelectorAll('#contrast-selector .appearance-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', ['normal', 'high'][idx] === (mode === 'high' ? 1 : 0));
    });
    localStorage.setItem('calcContrast', mode);
}

function safeParseJSON(value, fallback = null) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch (err) {
        console.warn('Ugyldig JSON i localStorage, nullstiller verdi:', err);
        return fallback;
    }
}

let savedTheme = safeParseJSON(localStorage.getItem('calcTheme'));
if (savedTheme && savedTheme.p && savedTheme.s) setTheme(savedTheme.p, savedTheme.s, savedTheme.i);
else setTheme('#00d2ff', '#3a7bd5', 0);

// Load saved appearance settings
let savedBackground = localStorage.getItem('calcBackground') || 'normal';
setBackground(savedBackground);

let savedFontSize = localStorage.getItem('calcFontSize') || 'normal';
setFontSize(savedFontSize);

let savedContrast = localStorage.getItem('calcContrast') || 'normal';
setContrast(savedContrast);

let favorites = safeParseJSON(localStorage.getItem('calcFavorites'), []) || [];
let historyData = safeParseJSON(localStorage.getItem('calcHistory'), []) || [];
let currentFolder = null;
let currentCalc = null;

// Check if calculators array is loaded
if (typeof calculators === 'undefined' || !Array.isArray(calculators) || calculators.length === 0) {
    console.error('Calculators array not loaded properly');
    alert('Feil: Kalkulatorene kunne ikke lastes. Siden fungerer ikke riktig.');
}

// --- GRAF-VARIABLER ---
let currentGraphFunc = null;
let graphScale = 30; 
let graphOffsetX = 0;
let graphOffsetY = 0;
let isDraggingGraph = false;
let dragStartX = 0;
let dragStartY = 0;
let showSteps = false;
let currentQuiz = null;
let studyCardIndex = -1;
let quizTotal = 0;
let quizCorrect = 0;
let currentHintVisible = false;

// ========== NYE LÆRINGSSYSTEMER ==========
// 1. VANSKELIGHETSGRADER
let currentDifficulty = 'easy'; // easy, medium, hard
let practiceMode = false;
let practiceModeCount = 0;
let practiceModeCorrect = 0;

// 2. LÆRINGSVEIER - Hvilke temaer bygger på hverandre
const learningPaths = {
    'Grunnleggende': [],
    'Prosent': ['Grunnleggende'],
    'Algebra': ['Grunnleggende', 'Prosent'],
    'Geometri': ['Grunnleggende'],
    'Statistikk': ['Grunnleggende', 'Prosent'],
    'Trigonometri': ['Geometri'],
    'Fysikk': ['Algebra', 'Geometri']
};

// 3. LOKAL ANALYSE - Spor progresjon per tema
let learningAnalytics = safeParseJSON(localStorage.getItem('calcAnalytics'), {}) || {};

function initializeAnalytics() {
    Object.keys(learningTopics).forEach(topic => {
        if (!learningAnalytics[topic]) {
            learningAnalytics[topic] = {
                totalAttempts: 0,
                correctAnswers: 0,
                difficulty: { easy: 0, medium: 0, hard: 0 },
                correctByDifficulty: { easy: 0, medium: 0, hard: 0 },
                difficulty_scores: { easy: 0, medium: 0, hard: 0 },
                last_attempted: null,
                streak: 0,
                difficult_questions: []
            };
        }
    });
    saveAnalytics();
}

function saveAnalytics() {
    localStorage.setItem('calcAnalytics', JSON.stringify(learningAnalytics));
}

// 4. GJENTAKING-SYSTEM - Spor vanskelige spørsmål
function addToDifficultQuestions(topic, quiz, wasCorrect) {
    if (!learningAnalytics[topic]) return;
    
    if (!wasCorrect || Math.random() < 0.3) {
        const existing = learningAnalytics[topic].difficult_questions.find(q => q.text === quiz.text);
        if (existing) {
            existing.attempts++;
            if (!wasCorrect) existing.failures++;
        } else {
            learningAnalytics[topic].difficult_questions.push({
                text: quiz.text,
                answer: quiz.answer,
                attempts: 1,
                failures: !wasCorrect ? 1 : 0,
                added: new Date().toISOString()
            });
        }
    }
    learningAnalytics[topic].difficult_questions = learningAnalytics[topic].difficult_questions.slice(0, 10);
    saveAnalytics();
}

// 5. PRAKSIS-MODUS
function startPracticeMode() {
    practiceMode = true;
    practiceModeCount = 0;
    practiceModeCorrect = 0;
    loadQuizQuestion();
    document.getElementById('practice-status').style.display = 'block';
    updatePracticeStatus();
}

function updatePracticeStatus() {
    const accuracy = practiceModeCount > 0 ? ((practiceModeCorrect / practiceModeCount) * 100).toFixed(0) : 0;
    document.getElementById('practice-status').innerHTML = `
        <div style="padding: 12px; background: rgba(0,255,0,0.1); border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #00ff00;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap;">
                <div>
                    <strong style="color: var(--primary);">🎯 Praksis-modus aktiv:</strong><br>
                    <span style="font-size: 0.95rem; color: #ccc;">${practiceModeCount} oppgaver | 
                    <span style="color: var(--primary); font-weight: bold;">${practiceModeCorrect} riktige</span> | 
                    <span style="color: #00ff00; font-weight: bold;">${accuracy}%</span> nøyaktighet</span>
                </div>
                <button class="action-btn small" onclick="endPracticeMode()" style="min-width: 130px;">Avslutt praksis</button>
            </div>
        </div>
    `;
}

function endPracticeMode() {
    practiceMode = false;
    document.getElementById('practice-status').style.display = 'none';
    document.getElementById('quiz-feedback').innerText = `Praksis-modus avsluttet! Du svarte riktig på ${practiceModeCorrect}/${practiceModeCount} oppgaver.`;
}

const learningTopics = {
    Prosent: {
        label: 'Prosent',
        summary: 'Prosent er en måte å uttrykke deler av et heltall på. Det brukes i alt fra rabatter i butikken til renteberegninger i banken. Å forstå prosent gjør deg bedre til å ta økonomiske beslutninger og tolke statistikk.',
        lessons: [
            'Prosent betyr "per hundre". 25% betyr 25 per hundre, eller 25/100 = 0,25.',
            'For å finne x% av et tall: Del x på 100 og gang med tallet. Eksempel: 15% av 200 = 0,15 × 200 = 30.',
            'Prosentendring viser hvor mye noe har økt eller minket: Formel: (ny verdi - gammel verdi) / gammel verdi × 100%.',
            'Hvis du vet en del og totalen, finner du prosent ved: (del / total) × 100%. Eksempel: 3 av 12 elever = 3/12 × 100% = 25%.',
            'Praktisk eksempel: En jakke koster 400 kr. Den er 20% rabatt. Ny pris = 400 × (1 - 0,20) = 320 kr.'
        ],
        generators: [
            () => {
                const percent = [5, 10, 15, 20, 25, 30, 40, 50][Math.floor(Math.random() * 8)];
                const value = Math.floor(Math.random() * 181) + 20;
                const result = Number(((percent / 100) * value).toFixed(2));
                return {
                    text: `Hva er ${percent}% av ${value}?`,
                    answer: result,
                    hint: 'Del prosenten på 100 og gang med tallet.',
                    explanation: `${percent}% av ${value} = ${percent}/100 × ${value} = ${result}`
                };
            },
            () => {
                const oldValue = Math.floor(Math.random() * 91) + 10;
                const diff = Math.floor(Math.random() * 41) - 10;
                const newValue = oldValue + diff;
                const result = Number(((newValue - oldValue) / oldValue * 100).toFixed(1));
                return {
                    text: `Tallet går fra ${oldValue} til ${newValue}. Hvor mange prosent endring er dette?`,
                    answer: result,
                    hint: 'Bruk formelen (ny - gammel) / gammel × 100.',
                    explanation: `(${newValue} - ${oldValue}) / ${oldValue} × 100 = ${result}%`
                };
            },
            () => {
                const part = Math.floor(Math.random() * 9) + 1;
                const total = Math.floor(Math.random() * 91) + 10;
                const result = Number(((part / total) * 100).toFixed(1));
                return {
                    text: `Hvor mange prosent er ${part} av ${total}?`,
                    answer: result,
                    hint: 'Del delen på totalen og gang med 100.',
                    explanation: `${part}/${total} × 100 = ${result}%`
                };
            }
        ]
    },
    Algebra: {
        label: 'Algebra',
        summary: 'Algebra handler om å finne ukjente tall ved hjelp av ligninger og funksjoner. Dette er grunnlaget for mye av matematikken vi bruker i vitenskap, økonomi og teknologi. Lineære funksjoner beskriver forhold som går i rett linje.',
        lessons: [
            'En lineær funksjon skrives y = ax + b, der "a" er stigningstallet og "b" er konstantleddet.',
            'Stigningstallet "a" viser hvor bratt linjen er. Positiv a = oppover, negativ a = nedover.',
            'Konstantleddet "b" er der linjen krysser y-aksen (når x = 0).',
            'For å løse ligningen ax + b = c: Trekk b fra begge sider, så del på a: x = (c - b)/a.',
            'Nullpunktet er der grafen krysser x-aksen (y = 0). Sett y = 0 og løs for x.',
            'Praktisk eksempel: En bedrift har faste kostnader på 5000 kr + 200 kr per enhet. Kostnad = 200x + 5000.'
        ],
        generators: [
            () => {
                const a = Math.floor(Math.random() * 8) + 1;
                const b = Math.floor(Math.random() * 11) - 5;
                const x = Math.floor(Math.random() * 11) - 3;
                const result = a * x + b;
                return {
                    text: `Funksjonen y = ${a}x ${b >= 0 ? '+' + b : b}. Hva er y når x = ${x}?`,
                    answer: result,
                    hint: 'Sett x inn i uttrykket og regn ut.',
                    explanation: `${a} × ${x} ${b >= 0 ? '+' + b : b} = ${result}`
                };
            },
            () => {
                const a = Math.floor(Math.random() * 8) + 1;
                const b = Math.floor(Math.random() * 11) - 5;
                const result = Number((-b / a).toFixed(2));
                return {
                    text: `Finn nullpunktet for ligningen ${a}x ${b >= 0 ? '+' + b : b} = 0. Hva er x?`,
                    answer: result,
                    hint: 'Løs for x ved å flytte b til andre siden og dele på a.',
                    explanation: `x = ${-b} / ${a} = ${result}`
                };
            },
            () => {
                const a = Math.floor(Math.random() * 6) + 1;
                const x = Math.floor(Math.random() * 11) - 3;
                const b = Math.floor(Math.random() * 11) - 5;
                const y = a * x + b;
                return {
                    text: `I y = ${a}x ${b >= 0 ? '+' + b : b}, er x = ${x}. Hva er y?`,
                    answer: y,
                    hint: 'Sett x inn og regn ut.',
                    explanation: `${a} × ${x} ${b >= 0 ? '+' + b : b} = ${y}`
                };
            },
            () => {
                const a = Math.floor(Math.random() * 5) + 1;
                const c = Math.floor(Math.random() * 21) - 10;
                const b = Math.floor(Math.random() * 11) - 5;
                const result = Number(((c - b) / a).toFixed(2));
                return {
                    text: `Løs ligningen ${a}x ${b >= 0 ? '+' + b : b} = ${c}. Hva er x?`,
                    answer: result,
                    hint: 'Flytt b til andre siden og del på a.',
                    explanation: `${a}x = ${c - b}, x = ${c - b} / ${a} = ${result}`
                };
            }
        ]
    },
    Geometri: {
        label: 'Geometri',
        summary: 'Geometri handler om former, størrelser og rom. Vi lærer å beregne areal og volum av forskjellige figurer. Dette brukes i alt fra arkitektur og design til dagligdagse oppgaver som å male et rom eller bygge noe.',
        lessons: [
            'Areal måler hvor stor en flat overflate er. Volum måler hvor mye plass et 3D-objekt fyller.',
            'Sirkel: Areal = π × r², der r er radius. Omkrets = 2 × π × r.',
            'Rektangel: Areal = lengde × bredde. Dette gjelder også for kvadrat (hvor lengde = bredde).',
            'Trapes: Areal = ((a + b) / 2) × h, der a og b er de parallelle sidene, h er høyden.',
            'Sylinder: Volum = π × r² × h. Overflateareal = 2 × π × r × (r + h).',
            'Praktisk eksempel: Du skal legge nytt gulv i et rom som er 4m × 5m. Areal = 4 × 5 = 20 m².'
        ],
        generators: [
            () => {
                const r = Math.floor(Math.random() * 8) + 2;
                const result = Number((Math.PI * r * r).toFixed(2));
                return {
                    text: `Hva er arealet av en sirkel med radius ${r}?`,
                    answer: result,
                    hint: 'Areal = π × r². Bruk π ≈ 3,14.',
                    explanation: `A = π × ${r}² = ${result}`
                };
            },
            () => {
                const a = Math.floor(Math.random() * 11) + 1;
                const b = Math.floor(Math.random() * 11) + 1;
                const h = Math.floor(Math.random() * 11) + 1;
                const result = Number((((a + b) / 2) * h).toFixed(1));
                return {
                    text: `Hva er arealet av et trapes med parallelle sider ${a} og ${b} og høyde ${h}?`,
                    answer: result,
                    hint: 'Areal = ((a + b) / 2) × h.',
                    explanation: `(( ${a} + ${b}) / 2 ) × ${h} = ${result}`
                };
            },
            () => {
                const r = Math.floor(Math.random() * 5) + 2;
                const h = Math.floor(Math.random() * 11) + 1;
                const result = Number((Math.PI * r * r * h).toFixed(1));
                return {
                    text: `Volumet av en sylinder med radius ${r} og høyde ${h} er ?`,
                    answer: result,
                    hint: 'Volum = π × r² × h.',
                    explanation: `V = π × ${r}² × ${h} = ${result}`
                };
            }
        ]
    },
    Statistikk: {
        label: 'Statistikk',
        summary: 'Statistikk handler om å samle, analysere og tolke data. Gjennomsnitt, sannsynlighet og spennvidde hjelper oss å forstå mønstre og ta bedre beslutninger basert på informasjon.',
        lessons: [
            'Gjennomsnittet (aritmetisk middel) = summen av alle tall delt på antallet tall.',
            'Sannsynlighet = antall gunstige utfall / antall mulige utfall. Ofte uttrykt som prosent.',
            'Spennvidde = største verdi - minste verdi. Viser hvor spredt dataene er.',
            'Median er den midterste verdien når tallene er sortert. Gjennomsnittet kan påvirkes av ekstreme verdier.',
            'Praktisk eksempel: Gjennomsnittlig månedslønn i en bedrift med 3 ansatte: 30k, 35k, 40k = (30+35+40)/3 = 35k.'
        ],
        generators: [
            () => {
                const values = [Math.floor(Math.random() * 11) + 1, Math.floor(Math.random() * 11) + 1, Math.floor(Math.random() * 11) + 1];
                const result = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
                return {
                    text: `Hva er gjennomsnittet av ${values.join(', ')}?`,
                    answer: result,
                    hint: 'Legg sammen alle tallene og del på antallet.',
                    explanation: `(${values.join(' + ')}) / ${values.length} = ${result}`
                };
            },
            () => {
                const favorable = Math.floor(Math.random() * 5) + 1;
                const total = Math.floor(Math.random() * 6) + favorable;
                const result = Number(((favorable / total) * 100).toFixed(1));
                return {
                    text: `Hva er sannsynligheten for riktig utfall hvis ${favorable} av ${total} er gunstige?`,
                    answer: result,
                    hint: 'Del gunstige utfall på totalen og gang med 100.',
                    explanation: `(${favorable}/${total}) × 100 = ${result}%`
                };
            },
            () => {
                const a = Math.floor(Math.random() * 12) + 1;
                const b = Math.floor(Math.random() * 12) + 1;
                const c = Math.floor(Math.random() * 12) + 1;
                const result = Number((Math.max(a, b, c) - Math.min(a, b, c)).toFixed(1));
                return {
                    text: `Hva er spennvidden for tallene ${a}, ${b} og ${c}?`,
                    answer: result,
                    hint: 'Spennvidde er største minus minste tall.',
                    explanation: `${Math.max(a, b, c)} - ${Math.min(a, b, c)} = ${result}`
                };
            }
        ]
    },
    Fysikk: {
        label: 'Fysikk',
        summary: 'Fysikk forklarer hvordan verden fungerer - fra bevegelse og energi til lys og lyd. Disse grunnleggende konseptene hjelper oss å forstå alt fra hvorfor ting faller til hvordan bølger fungerer.',
        lessons: [
            'Fart (hastighet) = distanse / tid. Enhet: m/s. Gjennomsnittsfart = total distanse / total tid.',
            'Akselerasjon = endring i fart / tid. Positiv = raskere, negativ = saktere.',
            'Bølgefart = frekvens × bølgelengde. Frekvens (f) måles i Hz, bølgelengde (λ) i meter.',
            'Lydfart i luft avhenger av temperatur: v = 331,3 + 0,6 × t, der t er temperatur i °C.',
            'Energi kan ikke skapes eller ødelegges, bare omformes (energiloven).',
            'Praktisk eksempel: En bil kjører 100 km på 2 timer. Gjennomsnittsfart = 100 km / 2 h = 50 km/t.'
        ],
        generators: [
            () => {
                const speed = Math.floor(Math.random() * 16) + 5;
                const result = Number((speed * 3.6).toFixed(1));
                return {
                    text: `Hvor mange km/t er ${speed} m/s?`,
                    answer: result,
                    hint: 'Gang med 3,6.',
                    explanation: `${speed} × 3.6 = ${result}`
                };
            },
            () => {
                const frequency = Math.floor(Math.random() * 20) + 5;
                const wavelength = Math.floor(Math.random() * 9) + 2;
                const result = Number((frequency * wavelength).toFixed(1));
                return {
                    text: `Bølgefarten er f × λ. Hvor stor er bølgefarten når f = ${frequency} Hz og λ = ${wavelength} m?`,
                    answer: result,
                    hint: 'Gang frekvensen med bølgelengden.',
                    explanation: `${frequency} × ${wavelength} = ${result}`
                };
            },
            () => {
                const temp = Math.floor(Math.random() * 21) + 5;
                const result = Number((331.3 + 0.6 * temp).toFixed(1));
                return {
                    text: `Hva er lydfarten ved ${temp} °C?`,
                    answer: result,
                    hint: 'Bruk formelen 331.3 + 0.6 × t.',
                    explanation: `331.3 + 0.6 × ${temp} = ${result}`
                };
            }
        ]
    },
    Trigonometri: {
        label: 'Trigonometri',
        summary: 'Trigonometri handler om forhold mellom sider og vinkler i trekanter. Sinus, cosinus og tangens brukes i alt fra navigasjon og fysikk til datagrafikk og arkitektur.',
        lessons: [
            'I en rettvinklet trekant: Sin(vinkel) = motstående katet / hypotenusen.',
            'Cos(vinkel) = tilstøtende katet / hypotenusen.',
            'Tan(vinkel) = motstående katet / tilstøtende katet.',
            'Husk SOHCAHTOA: Sin = Opposite/Hypotenuse, Cos = Adjacent/Hypotenuse, Tan = Opposite/Adjacent.',
            'Vinkler: 30° = π/6 radianer, 45° = π/4, 60° = π/3, 90° = π/2.',
            'Praktisk eksempel: En stige på 5m står 3m fra veggen. Vinkel med bakken: tan(θ) = 3/4, så θ ≈ 37°.'
        ],
        generators: [
            () => {
                const angle = [30, 45, 60][Math.floor(Math.random() * 3)];
                const sinVal = Math.sin(angle * Math.PI / 180).toFixed(3);
                return {
                    text: `Hva er sin(${angle}°)?`,
                    answer: sinVal,
                    hint: 'Bruk sinus-tabellen eller kalkulator.',
                    explanation: `sin(${angle}°) = ${sinVal}`
                };
            },
            () => {
                const angle = [30, 45, 60][Math.floor(Math.random() * 3)];
                const cosVal = Math.cos(angle * Math.PI / 180).toFixed(3);
                return {
                    text: `Hva er cos(${angle}°)?`,
                    answer: cosVal,
                    hint: 'Bruk cosinus-tabellen eller kalkulator.',
                    explanation: `cos(${angle}°) = ${cosVal}`
                };
            },
            () => {
                const angle = [30, 45, 60][Math.floor(Math.random() * 3)];
                const tanVal = Math.tan(angle * Math.PI / 180).toFixed(3);
                return {
                    text: `Hva er tan(${angle}°)?`,
                    answer: tanVal,
                    hint: 'Bruk tangens-tabellen eller kalkulator.',
                    explanation: `tan(${angle}°) = ${tanVal}`
                };
            }
        ]
    }
};

// Initialiser analytics når learningTopics er definert
initializeAnalytics();

const calculators = [
    // GRUNNLEGGENDE (5)
    { id: 1, folder: "Grunnleggende", name: "Prosent", formula: "(p / 100) * tall", html: '<input type="number" id="i1" placeholder="Prosent (%)"><input type="number" id="i2" placeholder="Av tall">', calc: () => {
        let p = parseFloat(document.getElementById('i1').value), t = parseFloat(document.getElementById('i2').value);
        return { res: (p/100)*t, exp: `(${p}/100) * ${t} = ${(p/100)*t}` };
    }},
    { id: 70, folder: "Grunnleggende", name: "Prosentendring", formula: "(ny - gammel) / gammel * 100", html: '<input type="number" id="i1" placeholder="Gammel verdi"><input type="number" id="i2" placeholder="Ny verdi">', calc: () => {
        let oldValue = parseFloat(document.getElementById('i1').value);
        let newValue = parseFloat(document.getElementById('i2').value);
        if (isNaN(oldValue) || isNaN(newValue) || oldValue === 0) return { res: "Feil: Ugyldige verdier" };
        let change = ((newValue - oldValue) / oldValue) * 100;
        return { res: `${change.toFixed(2)}%`, exp: `(${newValue} - ${oldValue}) / ${oldValue} * 100 = ${change.toFixed(2)}%` };
    }},
    { id: 2, folder: "Grunnleggende", name: "Deling", formula: "a / b", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a = parseFloat(document.getElementById('i1').value), b = parseFloat(document.getElementById('i2').value);
        return b === 0 ? {res: "Feil: Kan ikke dele på 0"} : { res: a/b, exp: `${a} / ${b} = ${a/b}` };
    }},
    { id: 7, folder: "Grunnleggende", name: "Gange", formula: "a * b", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a = parseFloat(document.getElementById('i1').value), b = parseFloat(document.getElementById('i2').value);
        return { res: a*b, exp: `${a} * ${b} = ${a*b}` };
    }},
    { id: 21, folder: "Grunnleggende", name: "Potens", formula: "a^b", html: '<input type="number" id="i1" placeholder="Grunntall"><input type="number" id="i2" placeholder="Eksponent">', calc: () => {
        let a = parseFloat(document.getElementById('i1').value), b = parseFloat(document.getElementById('i2').value);
        return { res: Math.pow(a,b), exp: `${a} ^ ${b} = ${Math.pow(a,b)}` };
    }},
    { id: 27, folder: "Grunnleggende", name: "Kvadratrot", formula: "√x", html: '<input type="number" id="i1" placeholder="x">', calc: () => {
        let x = parseFloat(document.getElementById('i1').value);
        return x < 0 ? {res: "Feil: Negativ rot"} : { res: Math.sqrt(x).toFixed(4), exp: `√${x} = ${Math.sqrt(x).toFixed(4)}` };
    }},
    { 
        id: 41, 
        folder: "Grunnleggende", 
        name: "Gange (Flere tall)", 
        formula: "a * b * c ...", 
        html: '<input type="text" id="i1" placeholder="Eks: 2, 3, 4">', 
        calc: () => {
            // Henter tekst, fjerner mellomrom, og gjør om til gyldige tall
            let arr = document.getElementById('i1').value
                .split(',')
                .map(x => x.trim())       // Fjerner mellomrom
                .filter(x => x !== "")    // Ignorerer tomme felter hvis man f.eks. slutter med et komma
                .map(Number)              // Gjør om til tall
                .filter(x => !isNaN(x));  // Sørger for at alt er ekte tall
            
            if (arr.length === 0) {
                return { res: "Feil: Mangler tall", exp: "Husk å skille tallene med komma." };
            }

            let produkt = arr.reduce((a, b) => a * b, 1); 
            
            return { 
                res: produkt, 
                exp: arr.join(" * ") + ` = ${produkt}` 
            };
        }
    },

    // ALGEBRA (10)
    { id: 23, folder: "Algebra", name: "Lineær funksjon", formula: "y = ax + b", html: '<input type="number" id="i1" placeholder="x1"><input type="number" id="i2" placeholder="y1"><input type="number" id="i3" placeholder="x2"><input type="number" id="i4" placeholder="y2">', calc: () => {
        let x1=parseFloat(document.getElementById('i1').value), y1=parseFloat(document.getElementById('i2').value), x2=parseFloat(document.getElementById('i3').value), y2=parseFloat(document.getElementById('i4').value);
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
            return { res: "Feil: Fyll inn alle verdier", exp: "Skriv inn både x1, y1, x2 og y2." };
        }
        if (x1 === x2) {
            return { res: "Feil: x1 og x2 kan ikke være like", exp: "To ulike punkt på en linje må ha forskjellig x-verdi." };
        }
        let a = (y2-y1)/(x2-x1), b = y1-(a*x1);
        return { res: `y = ${a}x ${b>=0?'+':''} ${b}`, exp: `a = (${y2}-${y1})/(${x2}-${x1}) = ${a}\nb = ${y1}-(${a}*${x1}) = ${b}`, graph: (x) => a*x+b };
    }},
    // ALGEBRA: ABC-formelen (Andregradsligning)
    { 
        id: 11, 
        folder: "Algebra", 
        name: "ABC-formelen", 
        formula: "x = (-b ± √(b² - 4ac)) / 2a", 
        html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', 
        calc: () => {
            let a = parseFloat(document.getElementById('i1').value);
            let b = parseFloat(document.getElementById('i2').value);
            let c = parseFloat(document.getElementById('i3').value);

            if (isNaN(a) || isNaN(b) || isNaN(c)) return { res: "Feil: Fyll inn a, b og c" };
            if (a === 0) return { res: "Feil: a kan ikke være 0", exp: "Hvis a er 0, er det ikke en andregradsligning." };

            let d = (b * b) - (4 * a * c);
            let bStr = b < 0 ? `(${b})` : b; // Setter parentes rundt negative tall for ryddigere formel
            
            let expStr = `Formel: x = (-b ± √(b² - 4ac)) / 2a\n\n`;
            expStr += `1. Setter inn tallene:\n   x = (-${bStr} ± √(${bStr}² - 4 * ${a} * ${c})) / (2 * ${a})\n\n`;
            expStr += `2. Regner ut det under roten:\n   d = ${b * b} - (${4 * a * c}) = ${d}\n\n`;

            if (d < 0) {
                expStr += `Siden resultatet under roten (${d}) er mindre enn 0, har ligningen ingen reelle løsninger. Grafen krysser aldri x-aksen.`;
                return { res: "Ingen reell løsning", exp: expStr, graph: (x) => a * x * x + b * x + c };
            }

            let sqrtD = Math.sqrt(d);
            expStr += `3. Finner kvadratroten av ${d}:\n   √${d} = ${sqrtD.toFixed(2)}\n\n`;
            expStr += `4. Deler opp i pluss og minus for å finne x₁ og x₂:\n`;
            
            let x1 = (-b + sqrtD) / (2 * a);
            let x2 = (-b - sqrtD) / (2 * a);

            expStr += `   x₁ = (${-b} + ${sqrtD.toFixed(2)}) / ${2 * a} = ${x1.toFixed(2)}\n`;
            expStr += `   x₂ = (${-b} - ${sqrtD.toFixed(2)}) / ${2 * a} = ${x2.toFixed(2)}`;

            return { 
                res: d === 0 ? `x = ${x1.toFixed(2)} (Dobbeltrot)` : `x₁ = ${x1.toFixed(2)}, x₂ = ${x2.toFixed(2)}`, 
                exp: expStr, 
                graph: (x) => a * x * x + b * x + c 
            };
        }
    },
    { id: 13, folder: "Algebra", name: "Topp/Bunnpunkt", formula: "x = -b / 2a", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value);
        if (isNaN(a) || isNaN(b) || isNaN(c)) return { res: "Feil: Fyll inn a, b og c" };
        if (a === 0) return { res: "Feil: a kan ikke være 0", exp: "Da er funksjonen ikke en andregradsfunksjon." };
        let x = -b/(2*a), y = a*x*x+b*x+c;
        return { res: `Punkt: (${x.toFixed(2)}, ${y.toFixed(2)})`, exp: `x = -${b}/(2*${a}) = ${x}\ny = f(${x}) = ${y}`, graph: (val) => a*val*val+b*val+c };
    }},
    { id: 14, folder: "Algebra", name: "Nullpunkt (Lineær)", formula: "ax + b = 0", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        if (isNaN(a) || isNaN(b)) return { res: "Feil: Fyll inn a og b" };
        if (a === 0) return { res: "Feil: a kan ikke være 0", exp: "En lineær funksjon må ha en x-koeffisient." };
        return { res: `x = ${(-b/a).toFixed(2)}`, exp: `ax = -b\nx = -${b}/${a} = ${(-b/a).toFixed(2)}`, graph: (x) => a*x+b };
    }},
    { id: 10, folder: "Algebra", name: "Momentan vekstfart", formula: "f'(x) = 2ax + b", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="x">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), x=parseFloat(document.getElementById('i3').value);
        return { res: `f'(${x}) = ${2*a*x+b}`, exp: `Derivert: ${2*a}x + ${b}\nSatt inn x: ${2*a}*${x} + ${b} = ${2*a*x+b}` };
    }},
    { id: 9, folder: "Algebra", name: "Gj.snittlig vekstfart", formula: "Δy / Δx", html: '<input type="number" id="i1" placeholder="x1"><input type="number" id="i2" placeholder="y1"><input type="number" id="i3" placeholder="x2"><input type="number" id="i4" placeholder="y2">', calc: () => {
        let x1=parseFloat(document.getElementById('i1').value), y1=parseFloat(document.getElementById('i2').value), x2=parseFloat(document.getElementById('i3').value), y2=parseFloat(document.getElementById('i4').value);
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return { res: "Feil: Fyll inn alle verdier" };
        if (x2 === x1) return { res: "Feil: x2 kan ikke være lik x1", exp: "Delta x kan ikke være null." };
        return { res: `Vekstfart: ${((y2-y1)/(x2-x1)).toFixed(2)}`, exp: `(${y2}-${y1}) / (${x2}-${x1}) = ${((y2-y1)/(x2-x1)).toFixed(2)}` };
    }},
    { id: 12, folder: "Algebra", name: "Eksponentiell", formula: "y = a * b^x", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="x">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), x=parseFloat(document.getElementById('i3').value);
        return { res: a*Math.pow(b,x), exp: `${a} * ${b}^${x} = ${a*Math.pow(b,x)}`, graph: (v) => a*Math.pow(b,v) };
    }},
    { id: 34, folder: "Algebra", name: "Asymptoter (Rasjonell)", formula: "f(x) = (ax+b)/(cx+d)", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value), d=parseFloat(document.getElementById('i4').value);
        if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return { res: "Feil: Fyll inn a, b, c og d" };
        if (c === 0) return { res: "Feil: c kan ikke være 0", exp: "Da er funksjonen ikke rasjonell med den forventede formelen." };
        let vert = -d/c; let hori = a/c;
        return { res: `Vertikal: x = ${vert.toFixed(2)}, Horisontal: y = ${hori.toFixed(2)}`, exp: `Vertikal: cx+d=0 -> x = -d/c = -${d}/${c}\nHorisontal: x->∞ -> y = a/c = ${a}/${c}`, graph: (x) => (a*x+b)/(c*x+d) };
    }},
    { id: 35, folder: "Algebra", name: "Rasjonal ligning", formula: "(ax+b)/(cx+d) = k", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d"><input type="number" id="i5" placeholder="k">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value), d=parseFloat(document.getElementById('i4').value), k=parseFloat(document.getElementById('i5').value);
        let x = (k*d - b) / (a - k*c);
        return { res: `x = ${x.toFixed(2)}`, exp: `Ligning: ax+b = k(cx+d)\nax+b = kcx + kd\nx(a-kc) = kd-b\nx = (kd-b)/(a-kc)` };
    }},
    { id: 36, folder: "Algebra", name: "Symmetrilinje", formula: "x = -b / 2a", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        let x = -b/(2*a);
        return { res: `x = ${x.toFixed(2)}`, exp: `Symmetrilinje (der f'(x)=0):\nx = -b / 2a = -${b} / (2*${a})` };
    }},
    { id: 48, folder: "Algebra", name: "Faktorisering (Andregrad)", formula: "ax² + bx + c", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', calc: () => {
        let a = parseFloat(document.getElementById('i1').value);
        let b = parseFloat(document.getElementById('i2').value);
        let c = parseFloat(document.getElementById('i3').value);

        if (isNaN(a) || isNaN(b) || isNaN(c)) return { res: "Feil: Fyll inn a, b og c" };
        if (a === 0) return { res: "Feil: a kan ikke være 0" };

        let d = (b * b) - (4 * a * c);
        if (d < 0) return { res: "Kan ikke faktoriseres", exp: "Diskriminanten er negativ. Uttrykket har ingen reelle røtter." };

        let x1 = (-b + Math.sqrt(d)) / (2 * a);
        let x2 = (-b - Math.sqrt(d)) / (2 * a);

        let formatTerm = (r) => {
            if (r === 0) return "x";
            return r > 0 ? `(x - ${r.toFixed(2)})` : `(x + ${Math.abs(r).toFixed(2)})`;
        };

        let aStr = a === 1 ? "" : a === -1 ? "-" : `${a}`;
        let resStr = "";

        if (d === 0) resStr = `${aStr}${formatTerm(x1)}²`; 
        else resStr = `${aStr}${formatTerm(x1)}${formatTerm(x2)}`;

        resStr = resStr.replace(/\.00/g, "");

        return {
            res: resStr,
            exp: `1. Finner røttene med ABC-formelen:\n   x1 = ${x1.toFixed(2)}, x2 = ${x2.toFixed(2)}\n\n2. Setter inn i formelen a(x - x1)(x - x2):\n   Resultat: ${resStr}`,
            graph: (x) => a * x * x + b * x + c
        };
    }},
    { id: 49, folder: "Algebra", name: "Faktorisering (Tredjegrad)", formula: "ax³ + bx² + cx + d", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d">', calc: () => {
        let a = parseFloat(document.getElementById('i1').value);
        let b = parseFloat(document.getElementById('i2').value);
        let c = parseFloat(document.getElementById('i3').value);
        let d = parseFloat(document.getElementById('i4').value);

        if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return { res: "Feil: Fyll inn a, b, c og d" };
        if (a === 0) return { res: "Feil: a kan ikke være 0" };

        let root1 = null;
        for (let i = -1000; i <= 1000; i++) {
            if (Math.abs(a*i*i*i + b*i*i + c*i + d) < 0.0001) {
                root1 = i;
                break;
            }
        }

        if (root1 === null) {
            return { res: "For komplisert", exp: "Kalkulatoren støtter kun faktorisering hvis minst én av røttene er et heltall." };
        }

        let A = a;
        let B = b + A * root1;
        let C = c + B * root1;

        let disk = (B * B) - (4 * A * C);
        let root2 = null, root3 = null;

        if (disk >= 0) {
            root2 = (-B + Math.sqrt(disk)) / (2 * A);
            root3 = (-B - Math.sqrt(disk)) / (2 * A);
        }

        let formatTerm = (r) => {
            if (r === 0) return "x";
            return r > 0 ? `(x - ${r.toFixed(2)})` : `(x + ${Math.abs(r).toFixed(2)})`;
        };

        let aStr = a === 1 ? "" : a === -1 ? "-" : `${a}`;
        let resStr = `${aStr}${formatTerm(root1)}`;
        let expStr = `1. Gjettet første rot ved å prøve heltall:\n   x1 = ${root1}\n\n2. Utførte polynomdivisjon med (x - ${root1}).\n   Fikk: ${A}x² + ${B}x + ${C}\n\n`;

        if (disk < 0) {
            resStr += `(${A}x² ${B >= 0 ? '+ '+B : '- '+Math.abs(B)}x ${C >= 0 ? '+ '+C : '- '+Math.abs(C)})`;
            expStr += `3. Andregradsuttrykket kan ikke faktoriseres videre (negativ diskriminant).`;
        } else if (disk === 0) {
            resStr += `${formatTerm(root2)}²`;
            expStr += `3. Faktoriserte andregradsuttrykket og fikk en dobbeltrot: x = ${root2.toFixed(2)}`;
        } else {
            resStr += `${formatTerm(root2)}${formatTerm(root3)}`;
            expStr += `3. Faktoriserte andregradsuttrykket med ABC-formelen.\n   x2 = ${root2.toFixed(2)}, x3 = ${root3.toFixed(2)}`;
        }

        resStr = resStr.replace(/\.00/g, "");

        return {
            res: resStr,
            exp: expStr,
            graph: (x) => a*x*x*x + b*x*x + c*x + d
        };
    }},
    { 
        id: 52, 
        folder: "Algebra", 
        name: "Proporsjonalitet", 
        formula: "y = kx  (k = y/x)", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Finn konstanten (k):</p>
            <input type="number" id="i1" placeholder="x (f.eks. antall)">
            <input type="number" id="i2" placeholder="y (f.eks. pris)">
            <p style="font-size: 0.9rem; color: #ccc; margin-top: 10px; margin-bottom: 5px;">Regn ut ny verdi (Valgfritt):</p>
            <input type="number" id="i3" placeholder="Ny x-verdi">`, 
        calc: () => {
            let x1 = parseFloat(document.getElementById('i1').value);
            let y1 = parseFloat(document.getElementById('i2').value);
            let x2 = parseFloat(document.getElementById('i3').value);

            if (isNaN(x1) || isNaN(y1)) return { res: "Feil: Fyll inn x og y" };
            if (x1 === 0) return { res: "Feil: x kan ikke være 0" };

            let k = y1 / x1;
            let exp = `Konstant (k) = ${y1} / ${x1} = ${k.toFixed(2)}\nFormel: y = ${k.toFixed(2)}x`;

            if (!isNaN(x2)) {
                let y2 = k * x2;
                return {
                    res: `y = ${y2.toFixed(2)} (k = ${k.toFixed(2)})`,
                    exp: `${exp}\n\nNår x er ${x2}, blir y:\n${k.toFixed(2)} * ${x2} = ${y2.toFixed(2)}`,
                    graph: (x) => k * x
                };
            }

            return {
                res: `Konstant k = ${k.toFixed(2)}`,
                exp: exp,
                graph: (x) => k * x
            };
        }
    },
    // ALGEBRA: Likningssett (To ukjente)
    { 
        id: 56, 
        folder: "Algebra", 
        name: "To Ukjente (Likningssett)", 
        formula: "Løs x og y", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Likning 1: a₁x + b₁y = c₁</p>
            <div style="display:flex;gap:5px;">
                <input type="number" id="l1a" placeholder="a₁">
                <input type="number" id="l1b" placeholder="b₁">
                <input type="number" id="l1c" placeholder="c₁">
            </div>
            <p style="font-size: 0.9rem; color: #ccc; margin-top: 10px; margin-bottom: 5px;">Likning 2: a₂x + b₂y = c₂</p>
            <div style="display:flex;gap:5px;">
                <input type="number" id="l2a" placeholder="a₂">
                <input type="number" id="l2b" placeholder="b₂">
                <input type="number" id="l2c" placeholder="c₂">
            </div>
        `, 
        calc: () => {
            let a1 = parseFloat(document.getElementById('l1a').value);
            let b1 = parseFloat(document.getElementById('l1b').value);
            let c1 = parseFloat(document.getElementById('l1c').value);
            let a2 = parseFloat(document.getElementById('l2a').value);
            let b2 = parseFloat(document.getElementById('l2b').value);
            let c2 = parseFloat(document.getElementById('l2c').value);

            if (isNaN(a1) || isNaN(b1) || isNaN(c1) || isNaN(a2) || isNaN(b2) || isNaN(c2)) {
                return { res: "Feil: Fyll inn alle 6 felt" };
            }

            // Bruker Cramers regel (Determinanter) for å løse settet
            let D = a1 * b2 - a2 * b1;
            let Dx = c1 * b2 - c2 * b1;
            let Dy = a1 * c2 - a2 * c1;

            if (D === 0) {
                if (Dx === 0 && Dy === 0) return { res: "Uendelig antall løsninger", exp: "Linjene ligger nøyaktig oppå hverandre." };
                return { res: "Ingen løsning", exp: "Linjene er parallelle og krysser aldri hverandre." };
            }

            let x = Dx / D;
            let y = Dy / D;

            return {
                res: `x = ${x.toFixed(2)}, y = ${y.toFixed(2)}`,
                exp: `Bruker Cramers regel:\nD = (${a1} * ${b2}) - (${a2} * ${b1}) = ${D}\nDx = (${c1} * ${b2}) - (${c2} * ${b1}) = ${Dx}\nDy = (${a1} * ${c2}) - (${a2} * ${c1}) = ${Dy}\n\nx = Dx / D = ${x.toFixed(2)}\ny = Dy / D = ${y.toFixed(2)}`
            };
        }
    },
    // ALGEBRA: Fullstendig Kvadrat
    { 
        id: 57, 
        folder: "Algebra", 
        name: "Fullstendig Kvadrat", 
        formula: "a(x + h)² + k", 
        html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', 
        calc: () => {
            let a = parseFloat(document.getElementById('i1').value);
            let b = parseFloat(document.getElementById('i2').value);
            let c = parseFloat(document.getElementById('i3').value);

            if (isNaN(a) || isNaN(b) || isNaN(c)) return { res: "Feil: Fyll inn a, b og c" };
            if (a === 0) return { res: "Feil: a kan ikke være 0", exp: "Dette er en lineær ligning, ikke en andregradsligning." };

            // Regner ut h og k for a(x + h)^2 + k
            let h = b / (2 * a);
            let k = c - (a * Math.pow(h, 2));

            // Formaterer teksten slik at den ser ut som ekte matte (unngår "x + -2")
            let hStr = h === 0 ? "x" : (h > 0 ? `(x + ${h.toFixed(2)})` : `(x - ${Math.abs(h).toFixed(2)})`);
            let aStr = a === 1 ? "" : (a === -1 ? "-" : a.toString());
            let kStr = k === 0 ? "" : (k > 0 ? ` + ${k.toFixed(2)}` : ` - ${Math.abs(k).toFixed(2)}`);

            let resStr = `${aStr}${h === 0 ? "x²" : hStr + "²"}${kStr}`;
            
            // Fjerner ".00" for å holde det ryddig hvis det er hele tall
            resStr = resStr.replace(/\.00/g, ""); 

            let expStr = `Start: ${a}x² ${b>=0?'+':''} ${b}x ${c>=0?'+':''} ${c}\n\n`;
            expStr += `1. Finner 'h' ved b / 2a:\n   h = ${b} / (2 * ${a}) = ${h}\n\n`;
            expStr += `2. Finner 'k' ved c - ah²:\n   k = ${c} - (${a} * ${h}²) = ${k}\n\n`;
            expStr += `Satt inn i a(x + h)² + k:\nResultat: ${resStr}`;

            return {
                res: resStr,
                exp: expStr,
                graph: (x) => a * x * x + b * x + c
            };
        }
    },
    // ALGEBRA: Tangentens ligning (Ettpunktsformelen)
    { 
        id: 59, 
        folder: "Algebra", 
        name: "Tangentens Ligning", 
        formula: "y - y₁ = f'(x₁)(x - x₁)", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Funksjon: f(x) = ax² + bx + c</p>
            <div style="display:flex;gap:5px;">
                <input type="number" id="i1" placeholder="a">
                <input type="number" id="i2" placeholder="b">
                <input type="number" id="i3" placeholder="c">
            </div>
            <p style="font-size: 0.9rem; color: #ccc; margin-top: 10px; margin-bottom: 5px;">Hvor skal tangenten treffe?</p>
            <input type="number" id="i4" placeholder="x-verdi">
        `, 
        calc: () => {
            let a = parseFloat(document.getElementById('i1').value) || 0;
            let b = parseFloat(document.getElementById('i2').value) || 0;
            let c = parseFloat(document.getElementById('i3').value) || 0;
            let x1 = parseFloat(document.getElementById('i4').value);

            if (isNaN(x1)) return { res: "Feil: Mangler x-verdi" };
            if (a === 0 && b === 0 && c === 0) return { res: "Feil: Fyll inn funksjonen" };

            // 1. Finner y-koordinatet: f(x1)
            let y1 = a * x1 * x1 + b * x1 + c;
            
            // 2. Finner stigningstallet: f'(x1) = 2ax + b
            let stigning = 2 * a * x1 + b;

            // 3. Setter inn i ettpunktsformelen: y = a(x - x1) + y1
            let konstant = y1 - (stigning * x1);

            let stigningStr = stigning === 1 ? "" : (stigning === -1 ? "-" : stigning.toFixed(2));
            let konstantStr = konstant === 0 ? "" : (konstant > 0 ? ` + ${konstant.toFixed(2)}` : ` - ${Math.abs(konstant).toFixed(2)}`);
            let resStr = stigning === 0 ? `y = ${konstant.toFixed(2)}` : `y = ${stigningStr}x${konstantStr}`;
            
            // Fjerner unødvendige .00
            resStr = resStr.replace(/\.00/g, "");

            let exp = `1. Finner treffpunktet (x₁, y₁):\n   y₁ = f(${x1}) = ${a}(${x1})² + ${b}(${x1}) + ${c} = ${y1}\n   Punkt: (${x1}, ${y1})\n\n`;
            exp += `2. Finner stigningstallet f'(x₁):\n   f'(x) = ${2*a}x + ${b}\n   f'(${x1}) = ${2*a}(${x1}) + ${b} = ${stigning}\n\n`;
            exp += `3. Ettpunktsformelen:\n   y - ${y1} = ${stigning}(x - ${x1})\n   y = ${stigning}x - ${stigning * x1} + ${y1}\n   Resultat: ${resStr}`;

            return {
                res: resStr,
                exp: exp,
                graph: (x) => stigning * x + konstant
            };
        }
    },


    // GEOMETRI (8)
    { id: 5, folder: "Geometri", name: "Pytagoras", formula: "a² + b² = c²", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        let c = Math.sqrt(a*a+b*b);
        return { res: `c = ${c.toFixed(2)}`, exp: `√(${a}² + ${b}²) = √(${a*a+b*b}) = ${c.toFixed(2)}` };
    }},
    { id: 24, folder: "Geometri / Areal", name: "Areal Sirkel", formula: "πr²", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: (Math.PI*r*r).toFixed(2), exp: `π * ${r}² = ${(Math.PI*r*r).toFixed(2)}` };
    }},
    { id: 71, folder: "Geometri / Areal", name: "Areal Trekant", formula: "(b * h) / 2", html: '<input type="number" id="i1" placeholder="Grunnlinje (b)"><input type="number" id="i2" placeholder="Høyde (h)">', calc: () => {
        let b=parseFloat(document.getElementById('i1').value);
        let h=parseFloat(document.getElementById('i2').value);
        if (isNaN(b) || isNaN(h)) return { res: "Feil: Fyll inn b og h" };
        let area = (b * h) / 2;
        return { res: area.toFixed(2), exp: `(${b} * ${h}) / 2 = ${area.toFixed(2)}` };
    }},
    { id: 72, folder: "Geometri / Areal", name: "Omkrets Sirkel", formula: "2πr", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        if (isNaN(r)) return { res: "Feil: Fyll inn radius" };
        let circumference = 2 * Math.PI * r;
        return { res: circumference.toFixed(2), exp: `2 * π * ${r} = ${circumference.toFixed(2)}` };
    }},
    { id: 73, folder: "Geometri / Areal", name: "Overflate Kule", formula: "4πr²", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        if (isNaN(r)) return { res: "Feil: Fyll inn radius" };
        let area = 4 * Math.PI * Math.pow(r, 2);
        return { res: area.toFixed(2), exp: `4 * π * ${r}² = ${area.toFixed(2)}` };
    }},
    { id: 25, folder: "Geometri / Volum", name: "Kulevolum", formula: "(4/3)πr³", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: ((4/3)*Math.PI*Math.pow(r,3)).toFixed(2), exp: `(4/3)*π*${r}³ = ${((4/3)*Math.PI*Math.pow(r,3)).toFixed(2)}` };
    }},
    // GEOMETRI: Areal av Trapes
    { 
        id: 62, 
        folder: "Geometri / Areal", 
        name: "Areal Trapes", 
        formula: "A = ((a + b) / 2) * h", 
        html: '<input type="number" id="i1" placeholder="Side a"><input type="number" id="i2" placeholder="Side b"><input type="number" id="i3" placeholder="Høyde (h)">', 
        calc: () => {
            let a = parseFloat(document.getElementById('i1').value);
            let b = parseFloat(document.getElementById('i2').value);
            let h = parseFloat(document.getElementById('i3').value);
            if (isNaN(a) || isNaN(b) || isNaN(h)) return { res: "Feil: Fyll inn alle mål" };
            let areal = ((a + b) / 2) * h;
            return { res: areal.toFixed(2), exp: `(( ${a} + ${b} ) / 2) * ${h} = ${areal.toFixed(2)}` };
        }
    },

    // GEOMETRI: Volum av Pyramide (Kvadratisk grunnflate)
    { 
        id: 63, 
        folder: "Geometri / Volum", 
        name: "Volum Pyramide", 
        formula: "V = (s² * h) / 3", 
        html: '<input type="number" id="i1" placeholder="Sidekant grunnflate (s)"><input type="number" id="i2" placeholder="Høyde (h)">', 
        calc: () => {
            let s = parseFloat(document.getElementById('i1').value);
            let h = parseFloat(document.getElementById('i2').value);
            if (isNaN(s) || isNaN(h)) return { res: "Feil: Fyll inn s og h" };
            let volum = (Math.pow(s, 2) * h) / 3;
            return { res: volum.toFixed(2), exp: `(${s}² * ${h}) / 3 = ${volum.toFixed(2)}` };
        }
    },

    // GEOMETRI: Volum av Kjegle
    { 
        id: 64, 
        folder: "Geometri / Volum", 
        name: "Volum Kjegle", 
        formula: "V = (π * r² * h) / 3", 
        html: '<input type="number" id="i1" placeholder="Radius (r)"><input type="number" id="i2" placeholder="Høyde (h)">', 
        calc: () => {
            let r = parseFloat(document.getElementById('i1').value);
            let h = parseFloat(document.getElementById('i2').value);
            if (isNaN(r) || isNaN(h)) return { res: "Feil: Fyll inn r og h" };
            let volum = (Math.PI * Math.pow(r, 2) * h) / 3;
            return { res: volum.toFixed(2), exp: "(π * " + r + "² * " + h + ") / 3 = " + volum.toFixed(2) };
        }
    },

    // GEOMETRI: Overflateareal av Sylinder
    { 
        id: 65, 
        folder: "Geometri / Areal", 
        name: "Overflate Sylinder", 
        formula: "A = 2πr² + 2πrh", 
        html: '<input type="number" id="i1" placeholder="Radius (r)"><input type="number" id="i2" placeholder="Høyde (h)">', 
        calc: () => {
            let r = parseFloat(document.getElementById('i1').value);
            let h = parseFloat(document.getElementById('i2').value);
            if (isNaN(r) || isNaN(h)) return { res: "Feil: Fyll inn r og h" };
            let grunnflater = 2 * Math.PI * Math.pow(r, 2);
            let krumflate = 2 * Math.PI * r * h;
            let totalt = grunnflater + krumflate;
            return { 
                res: totalt.toFixed(2), 
                exp: `Topper: 2 * π * ${r}² = ${grunnflater.toFixed(2)}\nSide: 2 * π * ${r} * ${h} = ${krumflate.toFixed(2)}\nTotalt: ${totalt.toFixed(2)}` 
            };
        }
    },

    // GEOMETRI: Areal av Rombe / Drage
    { 
        id: 66, 
        folder: "Geometri / Areal", 
        name: "Areal Rombe", 
        formula: "A = (p * q) / 2", 
        html: '<input type="number" id="i1" placeholder="Diagonal 1 (p)"><input type="number" id="i2" placeholder="Diagonal 2 (q)">', 
        calc: () => {
            let p = parseFloat(document.getElementById('i1').value);
            let q = parseFloat(document.getElementById('i2').value);
            if (isNaN(p) || isNaN(q)) return { res: "Feil: Fyll inn begge diagonaler" };
            let areal = (p * q) / 2;
            return { res: areal.toFixed(2), exp: `(${p} * ${q}) / 2 = ${areal.toFixed(2)}` };
        }
    },
    { id: 8, folder: "Geometri / Volum", name: "Volum Boks", formula: "l * b * h", html: '<input type="number" id="i1" placeholder="l"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="h">', calc: () => {
        let l=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), h=parseFloat(document.getElementById('i3').value);
        return { res: l*b*h, exp: `${l} * ${b} * ${h} = ${l*b*h}` };
    }},
    { id: 15, folder: "Geometri", name: "Trigonometri (Vinkel)", formula: "sin(v), cos(v)", html: '<input type="number" id="i1" placeholder="Grader">', calc: () => {
        let v=parseFloat(document.getElementById('i1').value), r = v*(Math.PI/180);
        return { res: `Sin: ${Math.sin(r).toFixed(3)}, Cos: ${Math.cos(r).toFixed(3)}`, graph: (x) => Math.sin(x) };
    }},
    { id: 16, folder: "Geometri", name: "Eksakt Trig", formula: "Vinkelverdier", html: '<select id="i1"><option value="30">30°</option><option value="45">45°</option><option value="60">60°</option><option value="90">90°</option></select>', calc: () => {
        let v=document.getElementById('i1').value;
        const m = {"30":"Sin: 1/2, Cos: √3/2", "45":"Sin: √2/2, Cos: √2/2", "60":"Sin: √3/2, Cos: 1/2", "90":"Sin: 1, Cos: 0"};
        return { res: m[v] };
    }},
    { id: 17, folder: "Geometri", name: "Trigonometri (Lengde)", formula: "v = sin⁻¹(o/h)", html: '<input type="number" id="i1" placeholder="Motstående"><input type="number" id="i2" placeholder="Hypotenus">', calc: () => {
        let o=parseFloat(document.getElementById('i1').value), h=parseFloat(document.getElementById('i2').value);
        let grad = Math.asin(o/h)*(180/Math.PI);
        return { res: `Vinkel: ${grad.toFixed(2)}°`, exp: `asin(${o}/${h}) = ${grad.toFixed(2)}°` };
    }},
    { id: 38, folder: "Geometri", name: "Trekantløseren", formula: "Sinus- & Cosinussetningen", html: `
        <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 10px;">Fyll inn <b>minst 3 verdier</b> (inkludert minst én side). Bruk grader for vinkler.</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <input type="number" id="trigA" placeholder="Side a">
            <input type="number" id="trigvA" placeholder="Vinkel A (°)">
            <input type="number" id="trigB" placeholder="Side b">
            <input type="number" id="trigvB" placeholder="Vinkel B (°)">
            <input type="number" id="trigC" placeholder="Side c">
            <input type="number" id="trigvC" placeholder="Vinkel C (°)">
        </div>`, 
        calc: () => {
            const rad = (deg) => deg * (Math.PI / 180);
            const deg = (rad) => rad * (180 / Math.PI);
            
            let a = parseFloat(document.getElementById('trigA').value);
            let b = parseFloat(document.getElementById('trigB').value);
            let c = parseFloat(document.getElementById('trigC').value);
            let A = parseFloat(document.getElementById('trigvA').value);
            let B = parseFloat(document.getElementById('trigvB').value);
            let C = parseFloat(document.getElementById('trigvC').value);

            let kjente = [a, b, c, A, B, C].filter(val => !isNaN(val)).length;
            let kjenteSider = [a, b, c].filter(val => !isNaN(val)).length;

            if (kjente < 3 || kjenteSider === 0) {
                return { res: "Feil: Trenger mer info", exp: "Du må fylle inn minst 3 verdier, og minst én av dem må være en lengde (side)." };
            }
            
            let forrigeKjente = 0;
            let iterations = 0;
            
            while (kjente < 6 && iterations < 10 && forrigeKjente !== kjente) {
                forrigeKjente = kjente;
                iterations++;

                if (!isNaN(A) && !isNaN(B) && isNaN(C)) C = 180 - A - B;
                if (!isNaN(A) && !isNaN(C) && isNaN(B)) B = 180 - A - C;
                if (!isNaN(B) && !isNaN(C) && isNaN(A)) A = 180 - B - C;

                if (isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(A)) a = Math.sqrt(b*b + c*c - 2*b*c*Math.cos(rad(A)));
                if (isNaN(b) && !isNaN(a) && !isNaN(c) && !isNaN(B)) b = Math.sqrt(a*a + c*c - 2*a*c*Math.cos(rad(B)));
                if (isNaN(c) && !isNaN(a) && !isNaN(b) && !isNaN(C)) c = Math.sqrt(a*a + b*b - 2*a*b*Math.cos(rad(C)));

                if (isNaN(A) && !isNaN(a) && !isNaN(b) && !isNaN(c)) A = deg(Math.acos((b*b + c*c - a*a) / (2*b*c)));
                if (isNaN(B) && !isNaN(a) && !isNaN(b) && !isNaN(c)) B = deg(Math.acos((a*a + c*c - b*b) / (2*a*c)));
                if (isNaN(C) && !isNaN(a) && !isNaN(b) && !isNaN(c)) C = deg(Math.acos((a*a + b*b - c*c) / (2*a*b)));

                if (!isNaN(A) && !isNaN(a)) {
                    let forholdsTall = a / Math.sin(rad(A));
                    if (isNaN(b) && !isNaN(B)) b = forholdsTall * Math.sin(rad(B));
                    if (isNaN(c) && !isNaN(C)) c = forholdsTall * Math.sin(rad(C));
                }
                if (!isNaN(B) && !isNaN(b)) {
                    let forholdsTall = b / Math.sin(rad(B));
                    if (isNaN(a) && !isNaN(A)) a = forholdsTall * Math.sin(rad(A));
                    if (isNaN(c) && !isNaN(C)) c = forholdsTall * Math.sin(rad(C));
                }

                kjente = [a, b, c, A, B, C].filter(val => !isNaN(val)).length;
            }

            if (kjente < 6) {
                 return { res: "Ufullstendig", exp: "Informasjonen er ikke nok til å løse hele trekanten, eller kombinasjonen er matematisk umulig." };
            }

            let s = (a + b + c) / 2;
            let areal = Math.sqrt(s * (s - a) * (s - b) * (s - c));

            document.getElementById('trigA').value = a.toFixed(2);
            document.getElementById('trigB').value = b.toFixed(2);
            document.getElementById('trigC').value = c.toFixed(2);
            document.getElementById('trigvA').value = A.toFixed(2);
            document.getElementById('trigvB').value = B.toFixed(2);
            document.getElementById('trigvC').value = C.toFixed(2);

            return { 
                res: "Trekant Løst!", 
                exp: `Areal: ${areal.toFixed(2)}\n\nSider:\na = ${a.toFixed(2)}\nb = ${b.toFixed(2)}\nc = ${c.toFixed(2)}\n\nVinkler:\n∠A = ${A.toFixed(2)}°\n∠B = ${B.toFixed(2)}°\n∠C = ${C.toFixed(2)}°` 
            };
        }
    },
    { 
        id: 53, 
        folder: "Geometri", 
        name: "Formlikhet", 
        formula: "a / A = b / B", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Figur 1 (Kjente sider):</p>
            <input type="number" id="i1" placeholder="Side a">
            <input type="number" id="i2" placeholder="Side b">
            <p style="font-size: 0.9rem; color: #ccc; margin-top: 10px; margin-bottom: 5px;">Figur 2 (Tilsvarende side):</p>
            <input type="number" id="i3" placeholder="Side A (tilsvarer a)">`, 
        calc: () => {
            let a = parseFloat(document.getElementById('i1').value);
            let b = parseFloat(document.getElementById('i2').value);
            let A = parseFloat(document.getElementById('i3').value);

            if (isNaN(a) || isNaN(b) || isNaN(A)) return { res: "Feil: Fyll inn alle 3 felt" };
            if (a === 0) return { res: "Feil: Kan ikke dele på 0" };

            let k = A / a; // Forholdstall / Skalafaktor
            let B = b * k;

            return {
                res: `Ukjent side (B) = ${B.toFixed(2)}`,
                exp: `1. Finner forholdstallet (skalafaktoren):\n   A / a = ${A} / ${a} = ${k.toFixed(2)}\n\n2. Ganger Side b med forholdstallet:\n   B = ${b} * ${k.toFixed(2)} = ${B.toFixed(2)}`
            };
        }
    },
    { 
        id: 54, 
        folder: "Geometri", 
        name: "Kongruens-sjekk (Trekant)", 
        formula: "Er de identiske?", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Trekant 1 (Tre sider):</p>
            <div style="display:flex;gap:5px;">
                <input type="number" id="t1a" placeholder="s1">
                <input type="number" id="t1b" placeholder="s2">
                <input type="number" id="t1c" placeholder="s3">
            </div>
            <p style="font-size: 0.9rem; color: #ccc; margin-top: 10px; margin-bottom: 5px;">Trekant 2 (Tre sider):</p>
            <div style="display:flex;gap:5px;">
                <input type="number" id="t2a" placeholder="s1">
                <input type="number" id="t2b" placeholder="s2">
                <input type="number" id="t2c" placeholder="s3">
            </div>`, 
        calc: () => {
            let t1 = [parseFloat(document.getElementById('t1a').value), parseFloat(document.getElementById('t1b').value), parseFloat(document.getElementById('t1c').value)];
            let t2 = [parseFloat(document.getElementById('t2a').value), parseFloat(document.getElementById('t2b').value), parseFloat(document.getElementById('t2c').value)];

            if (t1.some(isNaN) || t2.some(isNaN)) return { res: "Feil: Fyll inn alle 6 sider" };

            // Sorterer lengdene fra kortest til lengst for å kunne sammenligne dem riktig
            t1.sort((x, y) => x - y);
            t2.sort((x, y) => x - y);

            // Trekantulikheten (Summen av de to korteste må være lengre enn den lengste)
            let valid1 = (t1[0] + t1[1] > t1[2]);
            let valid2 = (t2[0] + t2[1] > t2[2]);

            if (!valid1 || !valid2) {
                return { res: "Ugyldige trekanter", exp: "Matematisk umulig! Summen av de to korteste sidene må alltid være større enn den lengste siden for å kunne lukke en trekant." };
            }

            // Sjekker SSS (Side-Side-Side)
            let isCongruent = (t1[0] === t2[0] && t1[1] === t2[1] && t1[2] === t2[2]);

            if (isCongruent) {
                return {
                    res: "✅ De er kongruente!",
                    exp: `Trekant 1: ${t1.join(", ")}\nTrekant 2: ${t2.join(", ")}\n\nBegge trekantene har nøyaktig samme sidelengder. Ifølge SSS-postulatet (Side-Side-Side) er de matematiske kopier av hverandre.`
                };
            } else {
                return {
                    res: "❌ Ikke kongruente",
                    exp: `Trekant 1: ${t1.join(", ")}\nTrekant 2: ${t2.join(", ")}\n\nSidene er ikke identiske. Trekantene har dermed forskjellig form eller størrelse.`
                };
            }
        }
    },

    // MATTE (2)
    { id: 3, folder: "Matte", name: "Brøk (Forenkle)", formula: "a/b -> c/d", html: '<input type="number" id="i1" placeholder="Teller"><input type="number" id="i2" placeholder="Nevner">', calc: () => {
        let a=parseInt(document.getElementById('i1').value), b=parseInt(document.getElementById('i2').value);
        let d = gcd(a,b); return { res: `${a/d} / ${b/d}`, exp: `Deler på største felles divisor: ${d}` };
    }},
    { id: 4, folder: "Matte", name: "Brøk til Desimal", formula: "a / b", html: '<input type="number" id="i1" placeholder="Teller"><input type="number" id="i2" placeholder="Nevner">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        return { res: a/b, exp: `${a} / ${b} = ${a/b}` };
    }},
    // MATTE: Derivasjon av Polynom (opp til 3. grad)
    { 
        id: 58, 
        folder: "Matte", 
        name: "Derivasjon (Polynom)", 
        formula: "f(x) = ax³ + bx² + cx + d", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 10px;">Fyll inn tallene for funksjonen din. La felter du ikke har stå tomme.</p>
            <input type="number" id="i1" placeholder="a (foran x³)">
            <input type="number" id="i2" placeholder="b (foran x²)">
            <input type="number" id="i3" placeholder="c (foran x)">
            <input type="number" id="i4" placeholder="d (konstant)">
        `, 
        calc: () => {
            let a = parseFloat(document.getElementById('i1').value) || 0;
            let b = parseFloat(document.getElementById('i2').value) || 0;
            let c = parseFloat(document.getElementById('i3').value) || 0;
            let d = parseFloat(document.getElementById('i4').value) || 0;

            if (a === 0 && b === 0 && c === 0 && d === 0) return { res: "Feil: Fyll inn minst ett tall" };

            // Regner ut derivert: 3ax^2 + 2bx + c
            let dA = 3 * a;
            let dB = 2 * b;
            let dC = c;

            // Hjelpefunksjon for å bygge en pen tekst-streng av funksjonen
            let formatTerm = (coef, varStr, isFirst) => {
                if (coef === 0) return "";
                let sign = coef > 0 ? (isFirst ? "" : " + ") : (isFirst ? "-" : " - ");
                let val = Math.abs(coef) === 1 && varStr !== "" ? "" : Math.abs(coef);
                return `${sign}${val}${varStr}`;
            };

            let opprinnelig = formatTerm(a, "x³", true) + formatTerm(b, "x²", a === 0) + formatTerm(c, "x", a === 0 && b === 0) + formatTerm(d, "", a === 0 && b === 0 && c === 0);
            
            let resStr = formatTerm(dA, "x²", true) + formatTerm(dB, "x", dA === 0) + formatTerm(dC, "", dA === 0 && dB === 0);
            if (resStr === "") resStr = "0";

            let expStr = `Opprinnelig funksjon:\nf(x) = ${opprinnelig}\n\n`;
            expStr += `Bruker potensregelen:\n`;
            if (a !== 0) expStr += `• ${a}x³  ->  3 * ${a}x² = ${dA}x²\n`;
            if (b !== 0) expStr += `• ${b}x²  ->  2 * ${b}x = ${dB}x\n`;
            if (c !== 0) expStr += `• ${c}x  ->  ${c}\n`;
            if (d !== 0) expStr += `• ${d}  ->  0 (Konstanter forsvinner)\n`;

            return {
                res: `f'(x) = ${resStr}`,
                exp: expStr.trim(),
                graph: (x) => dA*x*x + dB*x + dC
            };
        }
    },

    // STATISTIKK (2)
    { id: 6, folder: "Statistikk", name: "Sannsynlighet", formula: "g / m", html: '<input type="number" id="i1" placeholder="Gunstige"><input type="number" id="i2" placeholder="Mulige">', calc: () => {
        let g=parseFloat(document.getElementById('i1').value), m=parseFloat(document.getElementById('i2').value);
        return { res: `${((g/m)*100).toFixed(2)}%`, exp: `${g} / ${m} = ${(g/m).toFixed(4)}` };
    }},
    { id: 22, folder: "Statistikk", name: "Gjennomsnitt", formula: "Sum / n", html: '<input type="text" id="i1" placeholder="Eks: 2, 4, 6">', calc: () => {
        let arr = document.getElementById('i1').value.split(',').map(Number).filter(x => !isNaN(x));
        if (arr.length === 0) return { res: "Feil: Skriv inn verdier" };
        let sum = arr.reduce((a,b)=>a+b,0);
        return { res: (sum/arr.length).toFixed(2), exp: `Sum: ${sum}, Antall: ${arr.length}` };
    }},
    { id: 74, folder: "Statistikk", name: "Median", formula: "Midterste verdi", html: '<input type="text" id="i1" placeholder="Eks: 2, 5, 3">', calc: () => {
        let arr = document.getElementById('i1').value.split(',').map(Number).filter(x => !isNaN(x));
        if (arr.length === 0) return { res: "Feil: Skriv inn verdier" };
        arr.sort((a,b) => a-b);
        let middle = Math.floor(arr.length / 2);
        let median = arr.length % 2 === 1 ? arr[middle] : ((arr[middle-1] + arr[middle]) / 2);
        return { res: median.toFixed(2), exp: `Sortert: ${arr.join(', ')}\nMedian: ${median.toFixed(2)}` };
    }},
    { 
        id: 55, 
        folder: "Statistikk", 
        name: "Lineær Regresjon", 
        formula: "Beste tilpasning: y = ax + b", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Skriv inn verdier separert med komma:</p>
            <input type="text" id="i1" placeholder="x-verdier (f.eks: 1, 2, 3)">
            <input type="text" id="i2" placeholder="y-verdier (f.eks: 2.1, 4.0, 6.2)">
        `, 
        calc: () => {
            let xArr = document.getElementById('i1').value.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x));
            let yArr = document.getElementById('i2').value.split(',').map(y => parseFloat(y.trim())).filter(y => !isNaN(y));

            if (xArr.length === 0 || yArr.length === 0 || xArr.length !== yArr.length) {
                return { res: "Feil: Ugyldig data", exp: "Du må ha like mange x-verdier som y-verdier, og de må skilles med komma." };
            }

            let n = xArr.length;
            let sumX = xArr.reduce((a, b) => a + b, 0);
            let sumY = yArr.reduce((a, b) => a + b, 0);
            let sumXY = xArr.reduce((sum, x, i) => sum + (x * yArr[i]), 0);
            let sumX2 = xArr.reduce((sum, x) => sum + (x * x), 0);

            let nevner = (n * sumX2) - (sumX * sumX);
            if (nevner === 0) return { res: "Feil: Vertikal linje", exp: "Alle x-verdiene er like. Regresjon krever spredning i x." };

            let a = ((n * sumXY) - (sumX * sumY)) / nevner;
            let b = (sumY - (a * sumX)) / n;

            let aStr = a.toFixed(3);
            let bStr = b >= 0 ? `+ ${b.toFixed(3)}` : `- ${Math.abs(b).toFixed(3)}`;

            return {
                res: `y = ${aStr}x ${bStr}`,
                exp: `Beregnet med minste kvadraters metode basert på ${n} punkter.\n\nStigningstall (a) ≈ ${aStr}\nSkjæringspunkt (b) ≈ ${b.toFixed(3)}`,
                graph: (x) => a * x + b
            };
        }
    },

    // FYSIKK (3)
    { id: 18, folder: "Fysikk", name: "Bølge", formula: "v = f * λ", html: '<input type="number" id="i1" placeholder="f (Hz)"><input type="number" id="i2" placeholder="λ (m)">', calc: () => {
        let f=parseFloat(document.getElementById('i1').value), l=parseFloat(document.getElementById('i2').value);
        return { res: `${f*l} m/s`, graph: (x) => Math.sin(x) };
    }},
    { id: 19, folder: "Fysikk", name: "Lydfart", formula: "331.3 + 0.6t", html: '<input type="number" id="i1" placeholder="Temp °C">', calc: () => {
        let t=parseFloat(document.getElementById('i1').value);
        return { res: `${(331.3 + 0.606*t).toFixed(2)} m/s` };
    }},
    { id: 28, folder: "Fysikk", name: "Fart, Vei, Tid", formula: "v = s / t", html: '<input type="number" id="i1" placeholder="v"><input type="number" id="i2" placeholder="s"><input type="number" id="i3" placeholder="t">', calc: () => {
        let v=document.getElementById('i1').value, s=document.getElementById('i2').value, t=document.getElementById('i3').value;
        if(!v) return {res: `v = ${s/t}`}; if(!s) return {res: `s = ${v*t}`}; return {res: `t = ${s/v}`};
    }},

    // NY FYSIKK-FUNKSJON: Kinetisk Energi
    { 
        id: 39, // 
        folder: "Fysikk", 
        name: "Kinetisk Energi", 
        formula: "E = ½mv²", 
        html: '<input type="number" id="i1" placeholder="Masse (kg)"><input type="number" id="i2" placeholder="Fart (m/s)">', 
        calc: () => {
            let m = parseFloat(document.getElementById('i1').value);
            let v = parseFloat(document.getElementById('i2').value);
            let e = 0.5 * m * Math.pow(v, 2);
            return { 
                res: `${e.toFixed(2)} Joule`, 
                exp: `½ * ${m} * ${v}² = ${e.toFixed(2)} J`,
                graph: (x) => 0.5 * m * Math.pow(x, 2) // Viser hvordan energien øker med farten (x)
            };
        }
    },

    // NY GEOMETRI-FUNKSJON: Volum Sylinder
    { 
        id: 40, 
        folder: "Geometri / Volum", 
        name: "Volum Sylinder", 
        formula: "V = πr²h", 
        html: '<input type="number" id="i1" placeholder="Radius (r)"><input type="number" id="i2" placeholder="Høyde (h)">', 
        calc: () => {
            let r = parseFloat(document.getElementById('i1').value);
            let h = parseFloat(document.getElementById('i2').value);
            let v = Math.PI * Math.pow(r, 2) * h;
            return { 
                res: `${v.toFixed(2)}`, 
                exp: `π * ${r}² * ${h} = ${v.toFixed(2)}` 
            };
        }
    },

    // ØKONOMI (3)
    { id: 26, folder: "Økonomi", name: "Rentes rente", formula: "K * v^t", html: '<input type="number" id="i1" placeholder="Kapital"><input type="number" id="i2" placeholder="Vekstf. (f.eks 1.05)"><input type="number" id="i3" placeholder="År">', calc: () => {
        let k=parseFloat(document.getElementById('i1').value), v=parseFloat(document.getElementById('i2').value), t=parseFloat(document.getElementById('i3').value);
        return { res: (k*Math.pow(v,t)).toFixed(2), graph: (x) => k*Math.pow(v,x) };
    }},
    { id: 30, folder: "Økonomi", name: "Opprinnelig verdi", formula: "Nåverdi / (1 - r/100)", html: '<input type="number" id="i1" placeholder="Nåværende pris"><input type="number" id="i2" placeholder="Rabatt i %">', calc: () => {
        let p=parseFloat(document.getElementById('i1').value), r=parseFloat(document.getElementById('i2').value);
        let res = p / (1 - r/100);
        return { res: res.toFixed(2) + " kr", exp: `${p} / (1 - ${r}/100) = ${res.toFixed(2)}` };
    }},
    { id: 37, folder: "Økonomi", name: "Valuta (Sanntid)", formula: "Henter live kurser...", html: '<input type="number" id="i1" placeholder="Beløp" value="100"><select id="i2"><option value="NOK">Fra: Norske Kroner (NOK)</option><option value="USD">Fra: Amerikanske Dollar (USD)</option><option value="EUR">Fra: Euro (EUR)</option><option value="GBP">Fra: Britiske Pund (GBP)</option><option value="SEK">Fra: Svenske Kroner (SEK)</option><option value="DKK">Fra: Danske Kroner (DKK)</option></select><select id="i3"><option value="USD">Til: Amerikanske Dollar (USD)</option><option value="NOK">Til: Norske Kroner (NOK)</option><option value="EUR">Til: Euro (EUR)</option><option value="GBP">Til: Britiske Pund (GBP)</option><option value="SEK">Til: Svenske Kroner (SEK)</option><option value="DKK">Til: Danske Kroner (DKK)</option></select>', calc: async () => {
        let amount = parseFloat(document.getElementById('i1').value);
        let from = document.getElementById('i2').value;
        let to = document.getElementById('i3').value;
        if (isNaN(amount)) return {res: "Feil: Skriv inn et gyldig beløp"};
        
        document.getElementById('result-box').innerText = "Henter kurser...";
        try {
            let response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
            let data = await response.json();
            let rate = data.rates[to];
            let converted = amount * rate;
            let date = new Date(data.time_last_update_utc).toLocaleDateString('no-NO');
            return { res: `${converted.toFixed(2)} ${to}`, exp: `1 ${from} = ${rate.toFixed(4)} ${to}\nKurser sist oppdatert: ${date}` };
        } catch (e) {
            return { res: "Feil ved henting", exp: "Sjekk internettforbindelsen din, eller prøv igjen senere." };
        }
    }},
    // ØKONOMI: Lånekalkulator (Annuitetslån)
    { 
        id: 60, 
        folder: "Økonomi", 
        name: "Lånekalkulator", 
        formula: "Månedlig kostnad", 
        html: `
            <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 5px;">Regn ut hva lånet koster i måneden:</p>
            <input type="number" id="l_belop" placeholder="Lånebeløp (kr)">
            <input type="number" id="l_rente" placeholder="Årlig rente (%)">
            <input type="number" id="l_aar" placeholder="Nedbetalingstid (år)">
        `, 
        calc: () => {
            let belop = parseFloat(document.getElementById('l_belop').value);
            let renteAar = parseFloat(document.getElementById('l_rente').value);
            let aar = parseFloat(document.getElementById('l_aar').value);

            if (isNaN(belop) || isNaN(renteAar) || isNaN(aar) || aar === 0) {
                return { res: "Feil: Fyll inn alle felt" };
            }

            // Gjøre om årlig rente i prosent til månedlig desimaltall
            let r = (renteAar / 100) / 12;
            let n = aar * 12; // Totalt antall måneder

            // Formel for annuitetslån
            let terminbelop = belop * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            let totaltBetalt = terminbelop * n;
            let bareRenter = totaltBetalt - belop;

            // Formaterer tallene pent med mellomrom for tusenskilletegn
            let formatKr = (tall) => Math.round(tall).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

            return {
                res: `${formatKr(terminbelop)} kr / mnd`,
                exp: `Nedbetalingsplan over ${aar} år (${n} måneder):\n\nLånebeløp: ${formatKr(belop)} kr\nTotalt i renter: ${formatKr(bareRenter)} kr\nTotalt å betale tilbake: ${formatKr(totaltBetalt)} kr\n\n(Dette er et annuitetslån, som betyr at du betaler nøyaktig samme sum hver måned helt til lånet er nedbetalt.)`
            };
        }
    },

    // KONVERTERING (3)
    { id: 31, folder: "Konvertering", name: "CM til Feet", formula: "cm / 30.48", html: '<input type="number" id="i1" placeholder="Centimeter">', calc: () => {
        let cm=parseFloat(document.getElementById('i1').value);
        return { res: (cm / 30.48).toFixed(4) + " ft", exp: `${cm} / 30.48 = ${(cm / 30.48).toFixed(4)} ft` };
    }},
    { id: 32, folder: "Konvertering", name: "Hekto til Gram", formula: "hg * 100", html: '<input type="number" id="i1" placeholder="Hektogram">', calc: () => {
        let hg=parseFloat(document.getElementById('i1').value);
        return { res: (hg * 100) + " g", exp: `${hg} * 100 = ${hg * 100} g` };
    }},
    { id: 33, folder: "Konvertering", name: "Liter til dl/ml", formula: "L -> dl & ml", html: '<input type="number" id="i1" placeholder="Liter">', calc: () => {
        let l=parseFloat(document.getElementById('i1').value);
        return { res: `${l*10} dl / ${l*1000} ml`, exp: `${l} L = ${l*10} dl = ${l*1000} ml` };
    }},
    { id: 67, folder: "Konvertering", name: "M/S til KM/T", formula: "v * 3.6", html: '<input type="number" id="i1" placeholder="M/S">', calc: () => {
        let v = parseFloat(document.getElementById('i1').value);
        let kmh = v * 3.6;
        return { res: `${kmh.toFixed(1)} km/t`, exp: `${v} * 3.6 = ${kmh.toFixed(1)} km/t` };
    }},
    { id: 68, folder: "Konvertering", name: "Gram til Kilogram", formula: "g / 1000", html: '<input type="number" id="i1" placeholder="Gram">', calc: () => {
        let g = parseFloat(document.getElementById('i1').value);
        let kg = g / 1000;
        return { res: `${kg.toFixed(3)} kg`, exp: `${g} / 1000 = ${kg.toFixed(3)} kg` };
    }},
    { id: 69, folder: "Fysikk", name: "Energien i hvilemasse", formula: "E = m c²", html: '<input type="number" id="i1" placeholder="Masse (kg)">', calc: () => {
        let m = parseFloat(document.getElementById('i1').value);
        const c = 299792458;
        let e = m * c * c;
        return { res: `${e.toExponential(3)} J`, exp: `E = m c²\nE = ${m} * ${c}² = ${e.toExponential(3)} J` };
    }},
    { 
        id: 43, 
        folder: "Konvertering", 
        name: "Temperatur", 
        formula: "°C ↔ °F ↔ K", 
        html: '<input type="number" id="i1" placeholder="Temperatur"><select id="i2"><option value="C">Fra Celsius (°C)</option><option value="F">Fra Fahrenheit (°F)</option><option value="K">Fra Kelvin (K)</option></select>', 
        calc: () => {
            let t = parseFloat(document.getElementById('i1').value);
            let unit = document.getElementById('i2').value;
            if (isNaN(t)) return { res: "Feil: Skriv inn temperatur" };

            let c, f, k;
            // Regner ut alle verdiene uansett hva brukeren valgte som start
            if (unit === "C") { c = t; f = (t * 9/5) + 32; k = t + 273.15; }
            else if (unit === "F") { c = (t - 32) * 5/9; f = t; k = c + 273.15; }
            else if (unit === "K") { c = t - 273.15; f = (c * 9/5) + 32; k = t; }

            // Returnerer de TO andre enhetene basert på hva brukeren valgte
            if (unit === "C") return { res: `${f.toFixed(1)} °F / ${k.toFixed(1)} K`, exp: `${t}°C er lik:\nFahrenheit: (${t} * 9/5) + 32 = ${f.toFixed(2)}\nKelvin: ${t} + 273.15 = ${k.toFixed(2)}` };
            if (unit === "F") return { res: `${c.toFixed(1)} °C / ${k.toFixed(1)} K`, exp: `${t}°F er lik:\nCelsius: (${t} - 32) * 5/9 = ${c.toFixed(2)}\nKelvin: ${c.toFixed(2)} + 273.15 = ${k.toFixed(2)}` };
            if (unit === "K") return { res: `${c.toFixed(1)} °C / ${f.toFixed(1)} °F`, exp: `${t}K er lik:\nCelsius: ${t} - 273.15 = ${c.toFixed(2)}\nFahrenheit: (${c.toFixed(2)} * 9/5) + 32 = ${f.toFixed(2)}` };
        }
    },

    // DIVERSE (2)
    { id: 29, folder: "Diverse", name: "BMI", formula: "kg / m²", html: '<input type="number" id="i1" placeholder="kg"><input type="number" id="i2" placeholder="meter">', calc: () => {
        let w=parseFloat(document.getElementById('i1').value), h=parseFloat(document.getElementById('i2').value);
        let bmi = w/(h*h); return { res: bmi.toFixed(1), exp: bmi < 18.5 ? "Undervekt" : bmi < 25 ? "Normal" : "Overvekt" };
    }},
    { 
        id: 45, 
        folder: "Diverse", 
        name: "Tilfeldig tall", 
        formula: "Min ≤ x ≤ Maks", 
        html: '<input type="number" id="i1" placeholder="Minimum (f.eks. 1)"><input type="number" id="i2" placeholder="Maksimum (f.eks. 100)">', 
        calc: () => {
            let min = parseInt(document.getElementById('i1').value);
            let max = parseInt(document.getElementById('i2').value);
            
            if (isNaN(min) || isNaN(max)) return { res: "Feil: Skriv inn to tall" };
            
            // Bytter plass på min og max hvis brukeren skrev det største tallet først
            if (min > max) { 
                let temp = min; 
                min = max; 
                max = temp; 
            } 
            
            // Trekker et tilfeldig heltall
            let tilfeldig = Math.floor(Math.random() * (max - min + 1)) + min;
            
            return { 
                res: tilfeldig, 
                exp: `Datamaskinen trakk et tilfeldig heltall mellom ${min} og ${max}.` 
            };
        }
    },
    { 
        id: 44, 
        folder: "Diverse", 
        name: "Dato-differanse", 
        formula: "Dato 2 - Dato 1", 
        html: '<label style="color:var(--text-muted); font-size:0.9rem; margin-bottom: 5px; display:block; text-align:left;">Startdato:</label><input type="date" id="i1"><label style="color:var(--text-muted); font-size:0.9rem; margin-bottom: 5px; display:block; text-align:left;">Sluttdato:</label><input type="date" id="i2">', 
        calc: () => {
            let d1 = new Date(document.getElementById('i1').value);
            let d2 = new Date(document.getElementById('i2').value);
            
            if (isNaN(d1) || isNaN(d2)) return { res: "Feil: Velg to datoer" };
            
            // Regner ut differansen i millisekunder og gjør det om til dager
            let diffTid = Math.abs(d2 - d1);
            let diffDager = Math.ceil(diffTid / (1000 * 60 * 60 * 24));
            
            return { 
                res: `${diffDager} dager`, 
                exp: `Tid mellom ${d1.toLocaleDateString('no-NO')} og ${d2.toLocaleDateString('no-NO')} er nøyaktig ${diffDager} dager.` 
            };
        }
    },
    { id: 20, folder: "Diverse", name: "Om appen", formula: "Versjon 11", html: `
        <div style="text-align: left; padding: 10px; color: #ccc; line-height: 1.6;">
            <p style="margin-bottom: 15px;">Dette er et komplett, web-basert matematikkverktøy utviklet av <b style="color: var(--primary);">Leon Aabak</b>.</p>
            <ul style="margin-bottom: 15px; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><b>80+ Funksjoner:</b> Alt fra prosent til algebra og Trekantløser.</li>
                <li style="margin-bottom: 8px;"><b>Valuta i sanntid:</b> Henter oppdaterte kurser direkte fra nettet.</li>
                <li style="margin-bottom: 8px;"><b>Avansert Grafmotor:</b> Tegner grafer med interaktiv zoom og panorering.</li>
                <li><b>Enhetssirkel:</b> Visuell og dynamisk forståelse av trigonometri.</li>
            </ul>
            <p style="font-size: 0.9rem; color: var(--text-muted);">
                <i>Tips: Bruk søkefeltet for å raskt finne funksjonen du trenger, og stjernemerk favorittene dine for kjapp tilgang.</i>
            </p>
        </div>`, 
        calc: () => ({
            res: "Leon Aabak V11", 
            exp: "Håper du får god bruk for Total Kalkulator!"
        }) 
    }
];

function clearHistory() {
    if(confirm("Slette hele loggen?")) {
        historyData = [];
        localStorage.setItem('calcHistory', JSON.stringify(historyData));
        renderHistory();
    }
}

function getTopLevelFolders() {
    return [...new Set(calculators.map(c => c.folder.split(" / ")[0]))];
}

function getSubfolders(folderName) {
    return [...new Set(calculators
        .map(c => c.folder)
        .filter(path => path.startsWith(folderName + " / "))
        .map(path => path.slice((folderName + " / ").length).split(" / ")[0])
    )];
}

function renderFolders() {
    try {
        folderView.innerHTML = ''; 
        folderView.style.display = 'grid'; 
        listView.style.display = 'none'; 
        calcView.style.display = 'none'; 
        document.getElementById('learning-view').style.display = 'none';
        historyPanel.style.display = 'block';
        document.getElementById('hurtig-graf-panel').style.display = 'block';
        document.getElementById('enhetssirkel-panel').style.display = 'block';
        
        const folderIcons = { "Favoritter": "⭐", "Grunnleggende": "🧮", "Algebra": "📉", "Geometri": "📐", "Matte": "➕", "Statistikk": "📊", "Fysikk": "🧪", "Økonomi": "💰", "Konvertering": "🔄", "Diverse": "✨" };
        
        if(favorites.length > 0) {
            const favCard = document.createElement('div'); 
            favCard.className = 'card glass-panel';
            favCard.innerHTML = `<span style="font-size: 2rem">${folderIcons["Favoritter"]}</span><br>Favoritter`;
            favCard.onclick = () => openFolder("Favoritter"); 
            folderView.appendChild(favCard);
        }

        const learningCard = document.createElement('div');
        learningCard.className = 'card glass-panel';
        learningCard.innerHTML = `<span style="font-size: 2rem">🎓</span><br>Læringsstudio`;
        learningCard.onclick = () => showLearningStudio();
        folderView.appendChild(learningCard);
        
        const folderNames = getTopLevelFolders();
        folderNames.forEach(name => {
            const card = document.createElement('div'); 
            card.className = 'card glass-panel';
            const icon = folderIcons[name] || "📁";
            card.innerHTML = `<span style="font-size: 2rem">${icon}</span><br>${name}`;
            card.onclick = () => openFolder(name); 
            folderView.appendChild(card);
        });
        renderHistory();
    } catch (error) {
        console.error('Error in renderFolders:', error);
        alert('Feil ved lasting av mapper: ' + error.message);
    }
}

function openFolder(name) {
    currentFolder = name; 
    folderView.style.display = 'none'; 
    listView.style.display = 'grid'; 
    
    // Show/hide navigation based on folder type
    const listNav = document.getElementById('list-nav');
    listNav.style.display = 'block';
    const backBtn = listNav.querySelector('.back-btn');
    
    const isSubfolder = name.includes(' / ');
    backBtn.textContent = isSubfolder ? '← Tilbake' : '← Hjem';
    backBtn.onclick = isSubfolder 
        ? () => openFolder(name.split(' / ')[0]) 
        : showHome;
    
    let html = '';
    
    const folderIcons = { "Favoritter": "⭐", "Grunnleggende": "🧮", "Algebra": "📉", "Geometri": "📐", "Matte": "➕", "Statistikk": "📊", "Fysikk": "🧪", "Økonomi": "💰", "Konvertering": "🔄", "Diverse": "✨" };
    
    if (name !== "Favoritter") {
        const subfolders = getSubfolders(name);
        subfolders.forEach(sub => {
            const fullPath = `${name} / ${sub}`;
            html += `
                <div class="card glass-panel" onclick="openFolder('${fullPath}')">
                    <span style="font-size: 2rem">${folderIcons[name.split(' / ')[0]] || "📁"}</span><br>${sub}
                </div>
            `;
        });
    }

    let list = name === "Favoritter"
        ? calculators.filter(c => favorites.includes(c.id))
        : calculators.filter(c => c.folder === name);

    list.forEach((c, index) => {
        const isFav = favorites.includes(c.id);
        html += `
            <div class="card glass-panel" onclick="openCalcByIndex(${index}, '${name === 'Favoritter' ? 'favorites' : 'regular'}')">
                <button class="star-btn ${isFav ? 'active' : ''}" onclick="toggleFav(${c.id}, event)">★</button> ${c.name}
            </div>
        `;
    });
    
    // Store the current list for openCalcByIndex to access
    window.currentCalcList = list;
    
    listView.innerHTML = html;
}

function toggleFav(id, e) {
    e.stopPropagation();
    if(favorites.includes(id)) favorites = favorites.filter(x => x !== id); 
    else favorites.push(id);
    localStorage.setItem('calcFavorites', JSON.stringify(favorites)); 
    openFolder(currentFolder);
}

function openCalcByIndex(index, type) {
    const c = window.currentCalcList[index];
    if (c) {
        openCalc(c);
    }
}

function openCalc(c) {
    setLearningMode(false);
    currentCalc = c; 
    currentGraphFunc = null;
    listView.style.display = 'none'; 
    document.getElementById('list-nav').style.display = 'none';
    calcView.style.display = 'block';
    document.getElementById('learning-view').style.display = 'none';
    
    if (window.innerWidth <= 800) {
        document.getElementById('hurtig-graf-panel').style.display = 'none';
        document.getElementById('enhetssirkel-panel').style.display = 'none';
        historyPanel.style.display = 'none';
    }
    
    document.getElementById('btn-back-list').style.display = searchBar.value ? 'none' : 'block';
    document.getElementById('calc-title').innerText = c.name; 
    document.getElementById('pre-calc-formula').innerText = c.formula;
    document.getElementById('input-container').innerHTML = c.html; 
    document.getElementById('result-container').style.display = 'none';
    document.getElementById('explanation-box').innerText = '';
    updateGraphButtons(false);
}

function setLearningMode(active) {
    document.body.classList.toggle('learning-active', active);
    const learningBtn = document.getElementById('learning-studio-btn');
    if (learningBtn) learningBtn.classList.toggle('active', active);
}

function showHome() { 
    searchBar.value = ''; 
    setLearningMode(false);
    document.getElementById('list-nav').style.display = 'none';
    renderFolders(); 
}

function showLearningStudio() {
    setLearningMode(true);
    document.getElementById('folder-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('calc-view').style.display = 'none';
    document.getElementById('learning-view').style.display = 'block';
    document.getElementById('result-container').style.display = 'none';
    document.getElementById('hurtig-graf-panel').style.display = 'none';
    document.getElementById('enhetssirkel-panel').style.display = 'none';
    document.getElementById('prosjektil-panel').style.display = 'none';
    document.getElementById('statistikk-panel').style.display = 'none';
    loadLessonCard();
    loadQuizQuestion();
}

async function executeCalc() {
    if(!currentCalc) return;
    
    document.getElementById('result-container').style.display = 'block';
    const res = await currentCalc.calc();
    
    document.getElementById('result-box').innerText = "Svar: " + res.res;
    renderExplanation(res.exp || "");
    
    if(res.graph && typeof res.graph === 'function') {
        document.getElementById('graph-container').style.display = 'block';
        currentGraphFunc = res.graph;
        graphOffsetX = 0;
        graphOffsetY = 0;
        graphScale = 30;
        try {
            drawGraph();
            updateGraphButtons(true);
        } catch (err) {
            currentGraphFunc = null;
            document.getElementById('graph-container').style.display = 'none';
            updateGraphButtons(false);
            renderExplanation((res.exp || '') + `\n\nGrafen kunne ikke vises: ${err.message}`);
        }
    } else {
        document.getElementById('graph-container').style.display = 'none';
        currentGraphFunc = null;
        updateGraphButtons(false);
    }
    
    historyData = [{name: currentCalc.name, res: res.res}, ...historyData].slice(0, 10);
    localStorage.setItem('calcHistory', JSON.stringify(historyData)); 
    renderHistory();
}

function copyResult() {
    navigator.clipboard.writeText(document.getElementById('result-box').innerText);
    const t = document.getElementById('toast'); 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

function updateGraphButtons(enable) {
    const downloadBtn = document.getElementById('download-graph-btn');
    const shareBtn = document.getElementById('share-graph-btn');
    downloadBtn.disabled = !enable;
    shareBtn.disabled = !enable || !navigator.share;
}

function toggleSteps() {
    showSteps = !showSteps;
    document.getElementById('toggle-steps-btn').innerText = showSteps ? 'Skjul steg' : 'Vis steg';
    renderExplanation(document.getElementById('explanation-box').dataset.content || document.getElementById('explanation-box').innerText);
}

function renderExplanation(exp) {
    const box = document.getElementById('explanation-box');
    box.dataset.content = exp;
    if (!exp) {
        box.innerText = '';
        return;
    }

    if (showSteps) {
        box.innerHTML = exp.split('\n').map(line => `<div class="step-line">${line || '&nbsp;'}</div>`).join('');
    } else {
        box.innerText = exp;
    }
}

function downloadGraph() {
    if (!currentGraphFunc) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `graf-${currentCalc ? currentCalc.name.replace(/\s+/g, '_') : 'graf'}.png`;
    a.click();
}

async function shareGraph() {
    if (!currentGraphFunc || !navigator.share) {
        alert('Deling av graf er ikke tilgjengelig her.');
        return;
    }
    try {
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'graf.png', { type: 'image/png' });
        await navigator.share({
            title: currentCalc ? `Graf: ${currentCalc.name}` : 'Graf fra Total Kalkulator',
            text: 'Se denne grafen fra Total Kalkulator.',
            files: [file]
        });
    } catch (err) {
        console.warn(err);
        alert('Kunne ikke dele grafen akkurat nå.');
    }
}

function getSelectedLearningTopic() {
    return document.getElementById('learning-topic') ? document.getElementById('learning-topic').value : 'Prosent';
}

function loadLessonCard() {
    const topic = learningTopics[getSelectedLearningTopic()];
    if (!topic) return;
    
    let lessonsHtml = '<h3 style="color: var(--primary); margin-bottom: 15px;">📚 Leksjoner</h3>';
    topic.lessons.forEach((lesson, index) => {
        lessonsHtml += `<p style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid var(--primary);">
            <strong>${index + 1}.</strong> ${lesson}
        </p>`;
    });
    
    document.getElementById('learning-card').innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: var(--primary); margin-bottom: 10px;">📖 Om ${topic.label}</h3>
            <p style="color: #ccc; line-height: 1.6; font-size: 1.05rem;">${topic.summary}</p>
        </div>
        ${lessonsHtml}
        <div style="margin-top: 15px; padding: 15px; background: rgba(0,150,255,0.08); border-radius: 8px; border-left: 4px solid #0096ff;">
            <p style="font-size: 0.95rem; color: #ccc; line-height: 1.5;">
                💡 <strong>Tips:</strong> Disse leksjonene bygger på hverandre. Start med den første og arbeid deg oppover!
            </p>
        </div>
    `;
}

function renderLearningStats() {
    document.getElementById('quiz-score').innerText = quizCorrect;
    document.getElementById('quiz-total').innerText = quizTotal;
    document.getElementById('quiz-correct').innerText = quizCorrect;
    
    const progressPercent = quizTotal > 0 ? (quizCorrect / quizTotal) * 100 : 0;
    document.getElementById('progress-fill').style.width = progressPercent + '%';
}

function resetQuizScore() {
    quizCorrect = 0;
    quizTotal = 0;
    renderLearningStats();
    document.getElementById('quiz-feedback').innerText = 'Poeng nullstilt!';
    setTimeout(() => document.getElementById('quiz-feedback').innerText = '', 2000);
}

// FUNKSJON: Vis detaljert progresjonstatistikk
function showLearningAnalytics() {
    const topic = getSelectedLearningTopic();
    const stats = learningAnalytics[topic];
    
    if (!stats || stats.totalAttempts === 0) {
        alert('Ingen data ennå. Løs oppgaver for å se statistikk!');
        return;
    }
    
    const accuracy = ((stats.correctAnswers / stats.totalAttempts) * 100).toFixed(1);
    const easyAccuracy = stats.difficulty.easy > 0 ? ((stats.correctByDifficulty.easy / stats.difficulty.easy) * 100).toFixed(0) : '-';
    const mediumAccuracy = stats.difficulty.medium > 0 ? ((stats.correctByDifficulty.medium / stats.difficulty.medium) * 100).toFixed(0) : '-';
    const hardAccuracy = stats.difficulty.hard > 0 ? ((stats.correctByDifficulty.hard / stats.difficulty.hard) * 100).toFixed(0) : '-';
    
    const lastAttempt = stats.last_attempted ? new Date(stats.last_attempted).toLocaleString('no-NO') : 'Aldri';
    
    const analyticsHTML = `
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: var(--primary); margin-bottom: 15px;">📊 Din progresjon i ${learningTopics[topic].label}</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(0,255,0,0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #00ff00;">
                    <div style="font-size: 0.9rem; color: #aaa;">Samlet nøyaktighet</div>
                    <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${accuracy}%</div>
                    <div style="font-size: 0.85rem; color: #999;">Basert på ${stats.totalAttempts} forsøk</div>
                </div>
                
                <div style="background: rgba(0,150,255,0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #0096ff;">
                    <div style="font-size: 0.9rem; color: #aaa;">Streke</div>
                    <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${stats.streak}</div>
                    <div style="font-size: 0.85rem; color: #999;">Siste riktige svar på rad</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #ccc; margin-bottom: 10px;">Nøyaktighet etter vanskelighetsgrad:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div style="background: rgba(0,255,0,0.08); padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.8rem; color: #999;">Lett (🟢)</div>
                        <div style="font-size: 1.3rem; font-weight: bold;">${easyAccuracy}%</div>
                    </div>
                    <div style="background: rgba(255,200,0,0.08); padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.8rem; color: #999;">Middels (🟡)</div>
                        <div style="font-size: 1.3rem; font-weight: bold;">${mediumAccuracy}%</div>
                    </div>
                    <div style="background: rgba(255,0,0,0.08); padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.8rem; color: #999;">Vanskelig (🔴)</div>
                        <div style="font-size: 1.3rem; font-weight: bold;">${hardAccuracy}%</div>
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border-left: 2px solid var(--primary);">
                <div style="font-size: 0.85rem; color: #999;">Sist forsøkt: ${lastAttempt}</div>
            </div>
        </div>
    `;
    
    document.getElementById('learning-card').innerHTML = analyticsHTML;
}

// FUNKSJON: Vis læringsveier
function showLearningPaths() {
    const topic = getSelectedLearningTopic();
    const prerequisites = learningPaths[topic] || [];
    const topicData = learningTopics[topic];
    
    let pathsHTML = `
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: var(--primary); margin-bottom: 15px;">🎯 Læringsveier for ${topicData.label}</h3>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #ccc; margin-bottom: 10px;">📚 Forutsetninger:</h4>
    `;
    
    if (prerequisites.length === 0) {
        pathsHTML += `<p style="color: #999; font-style: italic;">Dette er et grunnleggande tema - ingen forutsetninger!</p>`;
    } else {
        prerequisites.forEach(prereq => {
            const stats = learningAnalytics[prereq];
            const completed = stats && stats.totalAttempts > 0;
            const accuracy = completed ? ((stats.correctAnswers / stats.totalAttempts) * 100).toFixed(0) : 0;
            const statusEmoji = completed ? '✅' : '⬜';
            pathsHTML += `
                <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${completed ? 'var(--primary)' : '#666'};">
                    ${statusEmoji} ${learningTopics[prereq]?.label || prereq}
                    ${completed ? `<span style="color: var(--primary);">(${accuracy}%)</span>` : ''}
                </div>
            `;
        });
    }
    
    pathsHTML += `</div>`;
    
    // Vis relaterte temaer
    const relatedTopics = Object.keys(learningPaths).filter(t => learningPaths[t].includes(topic));
    if (relatedTopics.length > 0) {
        pathsHTML += `
            <div>
                <h4 style="color: #ccc; margin-bottom: 10px;">📖 Neste steg:</h4>
        `;
        relatedTopics.forEach(nextTopic => {
            pathsHTML += `
                <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--secondary);">
                    🔜 ${learningTopics[nextTopic]?.label || nextTopic}
                </div>
            `;
        });
        pathsHTML += `</div>`;
    }
    
    pathsHTML += `</div>`;
    document.getElementById('learning-card').innerHTML = pathsHTML;
}

// FUNKSJON: Sett vanskelighetsgrad
function setQuizDifficulty(level) {
    currentDifficulty = level;
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// FUNKSJON: Vis vanskelige spørsmål som trengs repetisjon
function showDifficultQuestions() {
    const topic = getSelectedLearningTopic();
    const difficult = learningAnalytics[topic]?.difficult_questions || [];
    
    if (difficult.length === 0) {
        document.getElementById('learning-card').innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">✨ Ingen vanskelige spørsmål - du klarer deg bra!</p>';
        return;
    }
    
    let html = `
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: var(--primary); margin-bottom: 15px;">🔄 Spørsmål som trenger repetisjon</h3>
            <p style="color: #999; margin-bottom: 15px;">Disse spørsmålene har du eller klientene dine slitt med før:</p>
    `;
    
    difficult.forEach((q, idx) => {
        const added = new Date(q.added).toLocaleDateString('no-NO');
        html += `
            <div style="background: rgba(255,100,0,0.08); padding: 12px; border-radius: 8px; border-left: 3px solid #ff6400; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <strong style="color: #ccc;">🔹 ${q.text}</strong>
                        <div style="font-size: 0.85rem; color: #999; margin-top: 5px;">
                            Forsøk: ${q.attempts} | Feil: ${q.failures} | Lagt til: ${added}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    document.getElementById('learning-card').innerHTML = html;
}

function createQuizQuestion() {
    const topicName = getSelectedLearningTopic();
    const topic = learningTopics[topicName] || learningTopics.Prosent;
    
    // VANSKELIGHETSGRADER: Bruk vanskelighets-spørsmål hvis det finnes vanskelige
    if (currentDifficulty === 'hard' && learningAnalytics[topicName]?.difficult_questions?.length > 0 && Math.random() < 0.4) {
        const difficultQ = learningAnalytics[topicName].difficult_questions[Math.floor(Math.random() * learningAnalytics[topicName].difficult_questions.length)];
        return {
            text: difficultQ.text,
            answer: difficultQ.answer,
            hint: 'Du har fått denne feil før. Prøv å tenk gjennom stegene.',
            explanation: 'Gjentakingsspørsmål',
            isDifficult: true
        };
    }
    
    const generator = topic.generators[Math.floor(Math.random() * topic.generators.length)];
    return generator();
}

function loadQuizQuestion() {
    currentQuiz = createQuizQuestion();
    const topic = learningTopics[getSelectedLearningTopic()];
    const difficultyEmoji = currentDifficulty === 'easy' ? '🟢' : currentDifficulty === 'medium' ? '🟡' : '🔴';
    
    document.getElementById('learning-card').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>${topic.label} - Oppgave</strong>
            <span style="font-size: 1.2rem;" title="Vanskelighetsgrad">${difficultyEmoji}</span>
        </div>
        <p style="margin-top: 10px; color: #ccc; line-height: 1.6;">${currentQuiz.text}</p>
    `;
    document.getElementById('quiz-feedback').innerText = 'Skriv inn svaret og trykk Sjekk svar.';
    document.getElementById('quiz-answer').value = '';
    document.getElementById('quiz-hint').innerText = '';
    document.getElementById('quiz-hint').classList.remove('visible');
    currentHintVisible = false;
    renderLearningStats();
}

function toggleHint() {
    const hintEl = document.getElementById('quiz-hint');
    if (!currentQuiz) {
        hintEl.innerText = 'Start en oppgave først for å se hint.';
        hintEl.classList.add('visible');
        return;
    }
    currentHintVisible = !currentHintVisible;
    if (currentHintVisible) {
        hintEl.innerText = currentQuiz.hint || 'Prøv å bruk formelen du lærte i temaet.';
        hintEl.classList.add('visible');
    } else {
        hintEl.innerText = '';
        hintEl.classList.remove('visible');
    }
}

function checkQuizAnswer() {
    const answerEl = document.getElementById('quiz-answer');
    const feedback = document.getElementById('quiz-feedback');
    const topicName = getSelectedLearningTopic();
    
    if (!currentQuiz) {
        feedback.innerText = 'Trykk på Ny oppgave først.';
        return;
    }
    
    const guess = answerEl.value.trim().replace(',', '.');
    const guessNum = Number(guess);
    
    if (guess === '' || isNaN(guessNum)) {
        feedback.innerText = 'Skriv inn et gyldig tall.';
        return;
    }

    quizTotal += 1;
    const diff = Math.abs(guessNum - Number(currentQuiz.answer));
    const wasCorrect = diff <= 0.1;
    
    // ANALYTICS: Registrer svaret
    if (!learningAnalytics[topicName]) initializeAnalytics();
    learningAnalytics[topicName].totalAttempts++;
    learningAnalytics[topicName].difficulty[currentDifficulty]++;
    learningAnalytics[topicName].last_attempted = new Date().toISOString();
    
    if (wasCorrect) {
        quizCorrect += 1;
        learningAnalytics[topicName].correctAnswers++;
        learningAnalytics[topicName].correctByDifficulty[currentDifficulty]++;
        learningAnalytics[topicName].streak++;
        feedback.innerText = `✅ Riktig! ${currentQuiz.explanation}`;
        
        if (practiceMode) {
            practiceModeCorrect++;
            practiceModeCount++;
            updatePracticeStatus();
            setTimeout(() => loadQuizQuestion(), 1500);
        }
    } else {
        learningAnalytics[topicName].streak = 0;
        feedback.innerText = `❌ Nesten! Riktig svar er ${currentQuiz.answer}. ${currentQuiz.explanation}`;
        
        if (practiceMode) {
            practiceModeCount++;
            updatePracticeStatus();
            setTimeout(() => loadQuizQuestion(), 2000);
        }
    }
    
    // GJENTAKING: Legg til vanskelige spørsmål
    addToDifficultQuestions(topicName, currentQuiz, wasCorrect);
    saveAnalytics();
    renderLearningStats();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = historyData.length ? historyData.map(h => `<div class="history-item"><b>${h.name}</b><span>${h.res}</span></div>`).join('') : '<i>Ingen historikk enda.</i>';
}

// =========================================
// INTERAKTIV GRAF MOTOR (HOVED)
// =========================================

function drawGraph() {
    if (!currentGraphFunc) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.round(rect.width));
    const h = 350;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ox = w / 2 + graphOffsetX;
    const oy = h / 2 + graphOffsetY;

    let gridStep = 1;
    if (graphScale > 150) gridStep = 0.2;
    else if (graphScale > 80) gridStep = 0.5;
    else if (graphScale > 40) gridStep = 1;
    else if (graphScale > 20) gridStep = 2;
    else if (graphScale > 10) gridStep = 5;
    else if (graphScale > 4) gridStep = 10;
    else gridStep = 20;

    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const limit = Math.max(w, h) / graphScale + 4;
    for (let i = 0; i <= limit; i += gridStep) {
        const xPos = ox + i * graphScale;
        if (xPos >= 0 && xPos <= w) {
            ctx.beginPath(); ctx.moveTo(xPos, 0); ctx.lineTo(xPos, h); ctx.stroke();
            if (i !== 0) ctx.fillText(i, xPos, oy + 6);
        }
        if (i !== 0) {
            const xNeg = ox - i * graphScale;
            if (xNeg >= 0 && xNeg <= w) {
                ctx.beginPath(); ctx.moveTo(xNeg, 0); ctx.lineTo(xNeg, h); ctx.stroke();
                ctx.fillText(-i, xNeg, oy + 6);
            }
        }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= limit; i += gridStep) {
        const yPos = oy + i * graphScale;
        if (yPos >= 0 && yPos <= h) {
            ctx.beginPath(); ctx.moveTo(0, yPos); ctx.lineTo(w, yPos); ctx.stroke();
            if (i !== 0) ctx.fillText(-i, ox - 8, yPos);
        }
        if (i !== 0) {
            const yNeg = oy - i * graphScale;
            if (yNeg >= 0 && yNeg <= h) {
                ctx.beginPath(); ctx.moveTo(0, yNeg); ctx.lineTo(w, yNeg); ctx.stroke();
                ctx.fillText(i, ox - 8, yNeg);
            }
        }
    }

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, oy); ctx.lineTo(w, oy);
    ctx.moveTo(ox, 0); ctx.lineTo(ox, h);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0', ox + 6, oy - 6);

    const graphColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#00d2ff';
    ctx.strokeStyle = graphColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    let hasStarted = false;
    let lastPy = 0;
    for (let px = 0; px <= w; px += 1) {
        const mx = (px - ox) / graphScale;
        let my;
        try {
            my = currentGraphFunc(mx);
        } catch (err) {
            hasStarted = false;
            lastPy = null;
            continue;
        }

        if (typeof my !== 'number' || !isFinite(my) || Math.abs(my) > 1e4) {
            hasStarted = false;
            lastPy = null;
            continue;
        }

        const py = oy - my * graphScale;
        if (!hasStarted) {
            ctx.moveTo(px, py);
            hasStarted = true;
        } else {
            if (lastPy !== null && Math.abs(py - lastPy) > h) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        lastPy = py;
    }
    ctx.stroke();
    ctx.restore();
}

canvas.addEventListener('mousedown', (e) => {
    isDraggingGraph = true;
    dragStartX = e.clientX - graphOffsetX;
    dragStartY = e.clientY - graphOffsetY;
});

window.addEventListener('mousemove', (e) => {
    if (!isDraggingGraph) return;
    graphOffsetX = e.clientX - dragStartX;
    graphOffsetY = e.clientY - dragStartY;
    drawGraph();
});

window.addEventListener('mouseup', () => { isDraggingGraph = false; });

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); 
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    let zoom = Math.exp(wheel * zoomIntensity);
    graphScale *= zoom;
    if (graphScale < 2) graphScale = 2;
    if (graphScale > 500) graphScale = 500;
    drawGraph();
}, { passive: false });


// =========================================
// HURTIG-GRAF (SIDE-PANEL)
// =========================================

const hurtigCanvas = document.getElementById('hurtigCanvas');
const hurtigCtx = hurtigCanvas.getContext('2d');
const hurtigInput = document.getElementById('hurtigGrafInput');
const hurtigStatus = document.getElementById('hurtig-status');
const hurtigResetBtn = document.getElementById('hurtig-reset-btn');

let hurtigGraphZoom = 15;
let hurtigGraphOffsetX = 0;
let hurtigGraphOffsetY = 0;
let hurtigGraphDragging = false;
let hurtigGraphLastPointer = { x: 0, y: 0 };
let hurtigGraphFunction = null;

const hurtigAllowedNames = new Set([
    'x', 'pi', 'e', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sqrt', 'abs', 'log', 'ln', 'exp', 'pow', 'max', 'min',
    'floor', 'ceil', 'round'
]);

function parseHurtigExpression(rawExpr) {
    let expr = rawExpr.trim();
    if (!expr) return { error: 'Skriv en funksjon for å se grafen.' };

    expr = expr.replace(/\^/g, '**');

    const words = expr.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) || [];
    for (const word of words) {
        const lower = word.toLowerCase();
        if (/^\d+$/.test(word)) continue;
        if (!hurtigAllowedNames.has(lower)) {
            return { error: `Ugyldig funksjonsnavn eller variabel: ${word}.` };
        }
    }

    expr = expr.replace(/\bx\b/g, '(x)')
               .replace(/\bpi\b/gi, 'Math.PI')
               .replace(/\be\b/gi, 'Math.E')
               .replace(/\basin\b/gi, 'Math.asin')
               .replace(/\bacos\b/gi, 'Math.acos')
               .replace(/\batan\b/gi, 'Math.atan')
               .replace(/\bsin\b/gi, 'Math.sin')
               .replace(/\bcos\b/gi, 'Math.cos')
               .replace(/\btan\b/gi, 'Math.tan')
               .replace(/\bsqrt\b/gi, 'Math.sqrt')
               .replace(/\babs\b/gi, 'Math.abs')
               .replace(/\blog\b/gi, 'Math.log10')
               .replace(/\bln\b/gi, 'Math.log')
               .replace(/\bexp\b/gi, 'Math.exp')
               .replace(/\bpow\b/gi, 'Math.pow')
               .replace(/\bmax\b/gi, 'Math.max')
               .replace(/\bmin\b/gi, 'Math.min')
               .replace(/\bfloor\b/gi, 'Math.floor')
               .replace(/\bceil\b/gi, 'Math.ceil')
               .replace(/\bround\b/gi, 'Math.round');

    if (/[^0-9A-Za-z()+\-*/%^., _]/.test(expr)) {
        return { error: 'Ugyldige tegn i funksjonen. Bruk tall, x og vanlige funksjoner.' };
    }

    try {
        const fn = new Function('x', '"use strict"; const sin=Math.sin, cos=Math.cos, tan=Math.tan, asin=Math.asin, acos=Math.acos, atan=Math.atan, sqrt=Math.sqrt, abs=Math.abs, log=Math.log10, ln=Math.log, exp=Math.exp, pow=Math.pow, max=Math.max, min=Math.min, floor=Math.floor, ceil=Math.ceil, round=Math.round, pi=Math.PI, e=Math.E; return ' + expr + ';');
        return { fn };
    } catch (parseError) {
        return { error: 'Kunne ikke tolke funksjonen. Sjekk syntaksen.' };
    }
}

function tegnHurtigGraf() {
    if (!hurtigCanvas || !hurtigCtx) return;

    const rect = hurtigCanvas.getBoundingClientRect();
    const w = Math.max(160, Math.round(rect.width));
    const h = Math.max(120, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    hurtigCanvas.width = Math.round(w * dpr);
    hurtigCanvas.height = Math.round(h * dpr);
    hurtigCanvas.style.width = `${w}px`;
    hurtigCanvas.style.height = `${h}px`;
    hurtigCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hurtigCtx.clearRect(0, 0, w, h);

    const originX = w / 2 + hurtigGraphOffsetX;
    const originY = h / 2 + hurtigGraphOffsetY;

    hurtigCtx.fillStyle = 'rgba(6, 10, 16, 0.95)';
    hurtigCtx.fillRect(0, 0, w, h);

    hurtigCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    hurtigCtx.lineWidth = 1;
    hurtigCtx.setLineDash([3, 3]);

    for (let i = -10; i <= 10; i++) {
        if (i === 0) continue;
        const px = originX + i * hurtigGraphZoom;
        if (px < -hurtigGraphZoom || px > w + hurtigGraphZoom) continue;
        hurtigCtx.beginPath();
        hurtigCtx.moveTo(px, 0);
        hurtigCtx.lineTo(px, h);
        hurtigCtx.stroke();
    }

    for (let i = -6; i <= 6; i++) {
        if (i === 0) continue;
        const py = originY - i * hurtigGraphZoom;
        if (py < -hurtigGraphZoom || py > h + hurtigGraphZoom) continue;
        hurtigCtx.beginPath();
        hurtigCtx.moveTo(0, py);
        hurtigCtx.lineTo(w, py);
        hurtigCtx.stroke();
    }

    hurtigCtx.setLineDash([]);
    hurtigCtx.strokeStyle = 'rgba(255,255,255,0.65)';
    hurtigCtx.lineWidth = 2;
    hurtigCtx.beginPath();
    if (originY >= 0 && originY <= h) {
        hurtigCtx.moveTo(0, originY);
        hurtigCtx.lineTo(w, originY);
    }
    if (originX >= 0 && originX <= w) {
        hurtigCtx.moveTo(originX, 0);
        hurtigCtx.lineTo(originX, h);
    }
    hurtigCtx.stroke();

    hurtigCtx.fillStyle = 'rgba(255,255,255,0.7)';
    hurtigCtx.font = '10px sans-serif';
    hurtigCtx.textAlign = 'center';
    hurtigCtx.textBaseline = 'top';
    for (let i = -4; i <= 4; i++) {
        if (i === 0) continue;
        const px = originX + i * hurtigGraphZoom;
        if (px < 0 || px > w) continue;
        hurtigCtx.fillText(i, px, originY + 8);
    }

    hurtigCtx.textAlign = 'right';
    for (let i = -4; i <= 4; i++) {
        if (i === 0) continue;
        const py = originY - i * hurtigGraphZoom;
        if (py < 0 || py > h) continue;
        hurtigCtx.fillText(i, originX - 6, py + 4);
    }

    const parsed = parseHurtigExpression(hurtigInput.value);
    if (parsed.error) {
        hurtigGraphFunction = null;
        if (hurtigStatus) hurtigStatus.textContent = parsed.error;
        return;
    }

    hurtigGraphFunction = parsed.fn;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ffffff';
    hurtigCtx.strokeStyle = primaryColor;
    hurtigCtx.lineWidth = 2.5;
    hurtigCtx.lineJoin = 'round';
    hurtigCtx.lineCap = 'round';
    hurtigCtx.beginPath();

    let isDrawing = false;
    let lastY = null;

    for (let px = 0; px <= w; px += 1) {
        const x = (px - originX) / hurtigGraphZoom;
        let y;

        try {
            y = hurtigGraphFunction(x);
        } catch (error) {
            isDrawing = false;
            lastY = null;
            continue;
        }

        if (typeof y !== 'number' || !isFinite(y) || Math.abs(y) > 1e5) {
            isDrawing = false;
            lastY = null;
            continue;
        }

        const py = originY - y * hurtigGraphZoom;
        if (lastY !== null && Math.abs(py - lastY) > h) {
            isDrawing = false;
            lastY = null;
        }

        if (!isDrawing) {
            hurtigCtx.moveTo(px, py);
            isDrawing = true;
        } else {
            hurtigCtx.lineTo(px, py);
        }
        lastY = py;
    }

    hurtigCtx.stroke();

    if (hurtigStatus) {
        hurtigStatus.textContent = `Zoom: ${hurtigGraphZoom.toFixed(0)} | Pan: ${(hurtigGraphOffsetX / hurtigGraphZoom).toFixed(1)}, ${(-hurtigGraphOffsetY / hurtigGraphZoom).toFixed(1)}`;
    }
}

function resetHurtigGraf() {
    hurtigGraphZoom = 15;
    hurtigGraphOffsetX = 0;
    hurtigGraphOffsetY = 0;
    tegnHurtigGraf();
}

function setHurtigExample(example) {
    if (!hurtigInput) return;
    hurtigInput.value = example;
    tegnHurtigGraf();
    hurtigInput.focus();
}

function updateHurtigStatus(event) {
    if (!hurtigCanvas || !hurtigStatus) return;
    const rect = hurtigCanvas.getBoundingClientRect();
    const originX = rect.width / 2 + hurtigGraphOffsetX;
    const originY = rect.height / 2 + hurtigGraphOffsetY;
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const x = (px - originX) / hurtigGraphZoom;
    const y = (originY - py) / hurtigGraphZoom;
    if (!hurtigInput.value.trim()) {
        hurtigStatus.textContent = 'Skriv en funksjon for å se grafen.';
        return;
    }

    let hoverText = '';
    if (hurtigGraphFunction) {
        try {
            const graphY = hurtigGraphFunction(x);
            if (typeof graphY === 'number' && Number.isFinite(graphY) && Math.abs(graphY) < 1e5) {
                hoverText = `x=${x.toFixed(2)}, y=${graphY.toFixed(2)} | `;
            }
        } catch (error) {
            hoverText = `x=${x.toFixed(2)}, y≈${y.toFixed(2)} | `;
        }
    }

    hurtigStatus.textContent = `${hoverText}Zoom: ${hurtigGraphZoom.toFixed(0)}`;
}

hurtigInput.addEventListener('input', tegnHurtigGraf);
if (hurtigResetBtn) hurtigResetBtn.addEventListener('click', resetHurtigGraf);

hurtigCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) hurtigGraphZoom *= 1.1;
    else hurtigGraphZoom /= 1.1;
    hurtigGraphZoom = Math.max(5, Math.min(50, hurtigGraphZoom));
    tegnHurtigGraf();
}, { passive: false });

hurtigCanvas.addEventListener('pointerdown', (event) => {
    hurtigGraphDragging = true;
    hurtigGraphLastPointer = { x: event.clientX, y: event.clientY };
    hurtigCanvas.setPointerCapture(event.pointerId);
    hurtigCanvas.style.cursor = 'grabbing';
});

hurtigCanvas.addEventListener('pointermove', (event) => {
    if (hurtigGraphDragging) {
        hurtigGraphOffsetX += event.clientX - hurtigGraphLastPointer.x;
        hurtigGraphOffsetY += event.clientY - hurtigGraphLastPointer.y;
        hurtigGraphLastPointer = { x: event.clientX, y: event.clientY };
        tegnHurtigGraf();
    } else {
        updateHurtigStatus(event);
    }
});

hurtigCanvas.addEventListener('pointerup', (event) => {
    hurtigGraphDragging = false;
    hurtigCanvas.style.cursor = 'grab';
    hurtigCanvas.releasePointerCapture(event.pointerId);
});

hurtigCanvas.addEventListener('pointercancel', () => {
    hurtigGraphDragging = false;
    hurtigCanvas.style.cursor = 'grab';
});
// =========================================
// STATISTIKK LOGIKK (SIDE-PANEL)
// =========================================

const canvasStat = document.getElementById('statCanvas');
const ctxStat = canvasStat ? canvasStat.getContext('2d') : null;
const snittInput = document.getElementById('snittInput');
const avvikInput = document.getElementById('avvikInput');
const verdiInput = document.getElementById('verdiInput');

function tegnNormalfordeling() {
    if (!ctxStat) return;

    let mu = parseFloat(snittInput.value); // Gjennomsnitt
    let sigma = parseFloat(avvikInput.value); // Standardavvik
    let xVal = parseFloat(verdiInput.value); // Testverdi (brukerens verdi)

    if (isNaN(mu) || isNaN(sigma) || sigma <= 0) {
        document.getElementById('statTekst').innerText = "Fyll inn gyldig snitt og avvik (avvik må være over 0).";
        return;
    }

    const w = canvasStat.width;
    const h = canvasStat.height;
    ctxStat.clearRect(0, 0, w, h);

    // Setter skalaen slik at vi alltid ser 4 standardavvik i hver retning
    let minX = mu - 4 * sigma;
    let maxX = mu + 4 * sigma;
    let rangeX = maxX - minX;

    // Finner det høyeste punktet på kurven for å skalere Y-aksen perfekt
    let maxY = 1 / (sigma * Math.sqrt(2 * Math.PI));

    // Hjelpefunksjoner for å gjøre om ekte x/y-verdier til piksler på lerretet
    let getCx = (x) => ((x - minX) / rangeX) * w;
    let getCy = (y) => (h - 10) - (y / maxY) * (h - 20); 

    // Tegner bakken / X-aksen
    ctxStat.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxStat.lineWidth = 1;
    ctxStat.beginPath();
    ctxStat.moveTo(0, h - 10);
    ctxStat.lineTo(w, h - 10);
    ctxStat.stroke();

    // Tegner en stiplet linje i midten for gjennomsnittet
    ctxStat.beginPath();
    ctxStat.setLineDash([4, 4]);
    ctxStat.moveTo(getCx(mu), h - 10);
    ctxStat.lineTo(getCx(mu), getCy(maxY));
    ctxStat.stroke();
    ctxStat.setLineDash([]); // Skrur av stiplet linje for resten av tegningen

    // Tegner selve klokkekurven (Gauss-kurven)
    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#00d2ff';
    ctxStat.strokeStyle = primaryColor;
    ctxStat.lineWidth = 2;
    ctxStat.beginPath();

    for (let px = 0; px <= w; px++) {
        let x = minX + (px / w) * rangeX;
        // Den berømte formelen for normalfordeling:
        let exponent = -0.5 * Math.pow((x - mu) / sigma, 2);
        let y = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);

        if (px === 0) ctxStat.moveTo(px, getCy(y));
        else ctxStat.lineTo(px, getCy(y));
    }
    ctxStat.stroke();

    // Tegner inn brukerens punkt hvis det er fylt ut
    if (!isNaN(xVal)) {
        let zScore = (xVal - mu) / sigma; // Regner ut Z-score (hvor mange avvik unna)
        let zText = Math.abs(zScore).toFixed(1);
        
        let text = "";
        if (Math.abs(zScore) < 0.1) text = "Verdien din ligger nøyaktig på gjennomsnittet! 🎯";
        else if (zScore > 0) text = `Ligger ${zText} standardavvik OVER snittet. 📈`;
        else text = `Ligger ${zText} standardavvik UNDER snittet. 📉`;

        document.getElementById('statTekst').innerText = text;

        let pxX = getCx(xVal);
        let exponent = -0.5 * Math.pow((xVal - mu) / sigma, 2);
        let yVerdiForX = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
        let pxY = getCy(yVerdiForX);

        // Tegner en rød/hvit prikk der verdien treffer kurven
        ctxStat.fillStyle = '#ff4757';
        ctxStat.beginPath();
        ctxStat.arc(pxX, pxY, 5, 0, 2 * Math.PI);
        ctxStat.fill();
        ctxStat.strokeStyle = '#fff';
        ctxStat.lineWidth = 1;
        ctxStat.stroke();

        // Stiplet strek fra prikken ned til x-aksen
        ctxStat.beginPath();
        ctxStat.setLineDash([2, 3]);
        ctxStat.strokeStyle = 'rgba(255, 71, 87, 0.7)';
        ctxStat.moveTo(pxX, pxY);
        ctxStat.lineTo(pxX, h - 10);
        ctxStat.stroke();
        ctxStat.setLineDash([]);
    } else {
        document.getElementById('statTekst').innerText = "Fyll inn din verdi for å se den på kurven.";
    }
}

// Lytter etter endringer slik at grafen oppdaterer seg live når man skriver!
if (snittInput && avvikInput && verdiInput) {
    snittInput.addEventListener('input', tegnNormalfordeling);
    avvikInput.addEventListener('input', tegnNormalfordeling);
    verdiInput.addEventListener('input', tegnNormalfordeling);
}


// =========================================
// ENHETSSIRKEL LOGIKK (SIDE-PANEL)
// =========================================

const canvasSirkel = document.getElementById('enhetssirkel');
const ctxSirkel = canvasSirkel ? canvasSirkel.getContext('2d') : null;
const vinkelInput = document.getElementById('vinkelInput');

function oppdaterSirkel() {
    if (!ctxSirkel) return;
    
    const senterX = canvasSirkel.width / 2;
    const senterY = canvasSirkel.height / 2;
    const radius = 80;
    const padding = 20;

    let grader = parseFloat(vinkelInput.value) || 0;
    let radianer = grader * (Math.PI / 180);

    let sinVerdi = Math.sin(radianer);
    let cosVerdi = Math.cos(radianer);

    document.getElementById('sinVerdi').innerText = sinVerdi.toFixed(3);
    document.getElementById('cosVerdi').innerText = cosVerdi.toFixed(3);

    let punktX = senterX + (cosVerdi * radius);
    let punktY = senterY - (sinVerdi * radius);

    ctxSirkel.clearRect(0, 0, canvasSirkel.width, canvasSirkel.height);
    
    // Tegn bakgrunn
    ctxSirkel.fillStyle = 'rgba(0,0,0,0.1)';
    ctxSirkel.fillRect(0, 0, canvasSirkel.width, canvasSirkel.height);
    
    // Tegn aksene
    ctxSirkel.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxSirkel.lineWidth = 1;
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(0, senterY);
    ctxSirkel.lineTo(canvasSirkel.width, senterY);
    ctxSirkel.moveTo(senterX, 0);
    ctxSirkel.lineTo(senterX, canvasSirkel.height);
    ctxSirkel.stroke();
    
    // Tegn kvadrant labels
    ctxSirkel.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctxSirkel.font = 'bold 11px sans-serif';
    ctxSirkel.textAlign = 'center';
    ctxSirkel.fillText('0°', senterX + radius + 15, senterY + 12);
    ctxSirkel.fillText('90°', senterX - 8, senterY - radius - 8);
    ctxSirkel.fillText('180°', senterX - radius - 15, senterY + 12);
    ctxSirkel.fillText('270°', senterX + 8, senterY + radius + 15);

    // Tegn timarks rundt sirkelen
    for(let deg = 0; deg < 360; deg += 30) {
        let rad = deg * Math.PI / 180;
        let x1 = senterX + (radius) * Math.cos(rad);
        let y1 = senterY - (radius) * Math.sin(rad);
        let x2 = senterX + (radius + 8) * Math.cos(rad);
        let y2 = senterY - (radius + 8) * Math.sin(rad);
        
        ctxSirkel.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctxSirkel.lineWidth = 1;
        ctxSirkel.beginPath();
        ctxSirkel.moveTo(x1, y1);
        ctxSirkel.lineTo(x2, y2);
        ctxSirkel.stroke();
    }

    // Tegn enhetssirkelen
    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#ffffff';
    ctxSirkel.strokeStyle = primaryColor;
    ctxSirkel.lineWidth = 2.5;
    ctxSirkel.beginPath();
    ctxSirkel.arc(senterX, senterY, radius, 0, 2 * Math.PI);
    ctxSirkel.stroke();
    
    // Tegn vinkelarken (fra 0 til gjeldende vinkel)
    const arcRadius = radius * 0.3;
    ctxSirkel.strokeStyle = primaryColor;
    ctxSirkel.lineWidth = 2;
    ctxSirkel.beginPath();
    ctxSirkel.arc(senterX, senterY, arcRadius, 0, radianer);
    ctxSirkel.stroke();
    
    // Tegn vinkel-label
    if(Math.abs(grader) > 5) {
        const labelDeg = grader / 2;
        const labelRad = labelDeg * Math.PI / 180;
        const labelX = senterX + (arcRadius + 15) * Math.cos(labelRad);
        const labelY = senterY - (arcRadius + 15) * Math.sin(labelRad);
        ctxSirkel.fillStyle = primaryColor;
        ctxSirkel.font = '11px sans-serif';
        ctxSirkel.textAlign = 'center';
        ctxSirkel.fillText(`${grader.toFixed(0)}°`, labelX, labelY);
    }

    // Tegn radiuslinjen (fra senter til punkt)
    ctxSirkel.strokeStyle = primaryColor;
    ctxSirkel.lineWidth = 2;
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(senterX, senterY);
    ctxSirkel.lineTo(punktX, punktY);
    ctxSirkel.stroke();
    
    // Tegn cos-projeksjonen (horisontal)
    ctxSirkel.strokeStyle = 'rgba(255, 200, 100, 0.6)';
    ctxSirkel.lineWidth = 1.5;
    ctxSirkel.setLineDash([4, 4]);
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(punktX, senterY);
    ctxSirkel.lineTo(senterX, senterY);
    ctxSirkel.lineTo(senterX, punktY);
    ctxSirkel.stroke();
    ctxSirkel.setLineDash([]);
    
    // Tegn sin og cos som farget linjer
    // Sin (vertikal)
    ctxSirkel.strokeStyle = 'rgba(100, 200, 255, 0.7)';
    ctxSirkel.lineWidth = 2;
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(senterX, senterY);
    ctxSirkel.lineTo(senterX, punktY);
    ctxSirkel.stroke();
    ctxSirkel.fillStyle = 'rgba(100, 200, 255, 0.3)';
    ctxSirkel.fillText('sin', senterX - 15, (senterY + punktY) / 2);
    
    // Cos (horisontal)
    ctxSirkel.strokeStyle = 'rgba(255, 150, 150, 0.7)';
    ctxSirkel.lineWidth = 2;
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(senterX, senterY);
    ctxSirkel.lineTo(punktX, senterY);
    ctxSirkel.stroke();
    ctxSirkel.fillStyle = 'rgba(255, 150, 150, 0.3)';
    ctxSirkel.fillText('cos', (senterX + punktX) / 2, senterY + 15);
    
    // Tegn punktet
    ctxSirkel.fillStyle = primaryColor;
    ctxSirkel.beginPath();
    ctxSirkel.arc(punktX, punktY, 7, 0, 2 * Math.PI);
    ctxSirkel.fill();
    
    // Tegn senter
    ctxSirkel.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctxSirkel.beginPath();
    ctxSirkel.arc(senterX, senterY, 3, 0, 2 * Math.PI);
    ctxSirkel.fill();
}

if (vinkelInput) {
    vinkelInput.addEventListener('input', oppdaterSirkel);
    // Tegn ved oppstart
    setTimeout(oppdaterSirkel, 100);
}


// =========================================
// SØK OG NAVIGASJON
// =========================================

searchBar.oninput = () => {
    const q = searchBar.value.toLowerCase(); 
    if(!q) return showHome();
    
    folderView.style.display = 'none'; 
    listView.style.display = 'grid'; 
    listView.innerHTML = '';
    
    calculators.filter(c => c.name.toLowerCase().includes(q)).forEach(c => {
        const el = document.createElement('div'); 
        el.className = 'card glass-panel'; 
        el.innerHTML = c.name;
        el.onclick = () => openCalc(c); 
        listView.appendChild(el);
    });
};

window.onkeydown = (e) => { 
    if(e.key === 'Enter' && calcView.style.display === 'block') executeCalc(); 
    if(e.key === 'Escape') showHome(); 
};

document.getElementById('btn-back-list').onclick = () => {
    document.getElementById('calc-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'grid';
    document.getElementById('list-nav').style.display = 'block';
    document.getElementById('result-container').style.display = 'none';
    
    document.getElementById('hurtig-graf-panel').style.display = 'block';
    document.getElementById('enhetssirkel-panel').style.display = 'block';
    historyPanel.style.display = 'block';
};
// =========================================
// PROSJEKTILBANE LOGIKK (SIDE-PANEL)
// =========================================

const canvasKast = document.getElementById('prosjektilCanvas');
const ctxKast = canvasKast ? canvasKast.getContext('2d') : null;
const fartInput = document.getElementById('fartInput');
const kastvinkelInput = document.getElementById('kastvinkelInput');

function tegnKastbane() {
    if (!ctxKast) return;
    
    let v0 = parseFloat(fartInput.value) || 0;
    let vinkelGrader = parseFloat(kastvinkelInput.value) || 0;
    
    // Konverterer til radianer
    let radianer = vinkelGrader * (Math.PI / 180);
    let g = 9.81; // Tyngdeakselerasjon

    // Regner ut maksimal lengde og høyde (Fysikk-formler)
    let maxLengde = (Math.pow(v0, 2) * Math.sin(2 * radianer)) / g;
    let maxHoyde = (Math.pow(v0 * Math.sin(radianer), 2)) / (2 * g);

    // Oppdaterer teksten under grafen
    document.getElementById('kastLengde').innerText = maxLengde.toFixed(1) + " m";
    document.getElementById('kastHoyde').innerText = maxHoyde.toFixed(1) + " m";

    const w = canvasKast.width;
    const h = canvasKast.height;
    ctxKast.clearRect(0, 0, w, h);

    // Tegner et rutenett/bakken
    ctxKast.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxKast.lineWidth = 1;
    ctxKast.beginPath();
    ctxKast.moveTo(0, h - 10);
    ctxKast.lineTo(w, h - 10);
    ctxKast.stroke();

    // Sjekker om det er et gyldig kast før vi tegner
    if (v0 <= 0 || vinkelGrader <= 0 || vinkelGrader >= 180) return;

    // Finner en skala slik at kastet alltid passer inni canvas-vinduet
    let skalaX = (w - 20) / maxLengde;
    let skalaY = (h - 20) / maxHoyde;
    let grafSkala = Math.min(skalaX, skalaY); // Beholder proporsjonene

    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#00d2ff';
    ctxKast.strokeStyle = primaryColor;
    ctxKast.lineWidth = 2;
    ctxKast.beginPath();

    // Tegner selve parabelen
    let forrigeX = 0;
    let forrigeY = h - 10;
    ctxKast.moveTo(forrigeX, forrigeY);

    for (let t = 0; t <= 10; t += 0.1) {
        // x = v0 * cos(vinkel) * t
        let xVerdi = v0 * Math.cos(radianer) * t;
        // y = v0 * sin(vinkel) * t - 0.5 * g * t^2
        let yVerdi = (v0 * Math.sin(radianer) * t) - (0.5 * g * t * t);

        if (yVerdi < 0) break; // Stopper grafen når den treffer bakken

        let tegnX = 10 + (xVerdi * grafSkala);
        let tegnY = (h - 10) - (yVerdi * grafSkala);
        
        ctxKast.lineTo(tegnX, tegnY);
    }
    ctxKast.stroke();
}

// Lytter etter endringer slik at grafen oppdaterer seg live
if (fartInput && kastvinkelInput) {
    fartInput.addEventListener('input', tegnKastbane);
    kastvinkelInput.addEventListener('input', tegnKastbane);
    
    // Tegner grafen første gang siden lastes
    tegnKastbane();
}

// Start appen
try {
    renderFolders();
    oppdaterSirkel();
    tegnHurtigGraf();
    loadLessonCard();
    loadQuizQuestion();
} catch (error) {
    console.error('Error initializing app:', error);
    alert('Feil ved oppstart av appen: ' + error.message);
}
 
if (typeof tegnKastbane === 'function') tegnKastbane();
if (typeof tegnNormalfordeling === 'function') tegnNormalfordeling();

// Register service worker for offline support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(registration => console.log('Service Worker registered:', registration))
        .catch(error => console.warn('Service Worker registration failed:', error));
}
 