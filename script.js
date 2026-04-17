const folderView = document.getElementById('folder-view');
const listView = document.getElementById('list-view');
const calcView = document.getElementById('calc-view');
const searchBar = document.getElementById('search-bar');
const historyPanel = document.getElementById('history-panel');
const canvas = document.getElementById('graphCanvas'), ctx = canvas.getContext('2d');

function gcd(a, b) { return b === 0 ? Math.abs(a) : gcd(b, a % b); }

function setTheme(primary, secondary, index) {
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--secondary', secondary);
    document.querySelectorAll('.theme-dot').forEach((dot, idx) => dot.classList.toggle('active', idx === index));
    localStorage.setItem('calcTheme', JSON.stringify({p: primary, s: secondary, i: index}));
}

let savedTheme = JSON.parse(localStorage.getItem('calcTheme'));
if(savedTheme) setTheme(savedTheme.p, savedTheme.s, savedTheme.i);
else setTheme('#00d2ff', '#3a7bd5', 0);

let favorites = JSON.parse(localStorage.getItem('calcFavorites')) || [];
let historyData = JSON.parse(localStorage.getItem('calcHistory')) || [];
let currentFolder = null;
let currentCalc = null;

let currentGraphFunc = null;
let graphScale = 30; 
let graphOffsetX = 0;
let graphOffsetY = 0;
let isDraggingGraph = false;

const calculators = [
    // GRUNNLEGGENDE
    { id: 1, folder: "Grunnleggende", name: "Prosent", formula: "(p / 100) * tall", html: '<input type="number" id="i1" placeholder="Prosent (%)"><input type="number" id="i2" placeholder="Av tall">', calc: () => {
        let p = parseFloat(document.getElementById('i1').value), t = parseFloat(document.getElementById('i2').value);
        return { res: (p/100)*t, exp: `(${p}/100) * ${t} = ${(p/100)*t}` };
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

    // ALGEBRA
    { id: 23, folder: "Algebra", name: "Lineær funksjon", formula: "y = ax + b", html: '<input type="number" id="i1" placeholder="x1"><input type="number" id="i2" placeholder="y1"><input type="number" id="i3" placeholder="x2"><input type="number" id="i4" placeholder="y2">', calc: () => {
        let x1=parseFloat(document.getElementById('i1').value), y1=parseFloat(document.getElementById('i2').value), x2=parseFloat(document.getElementById('i3').value), y2=parseFloat(document.getElementById('i4').value);
        let a = (y2-y1)/(x2-x1), b = y1-(a*x1);
        return { res: `y = ${a}x ${b>=0?'+':''} ${b}`, exp: `a = (${y2}-${y1})/(${x2}-${x1}) = ${a}\nb = ${y1}-(${a}*${x1}) = ${b}`, graph: (x) => a*x+b };
    }},
    { id: 11, folder: "Algebra", name: "Andregrad (ABC)", formula: "ax² + bx + c = 0", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value);
        let d = (b*b)-(4*a*c);
        if(d<0) return {res: "Ingen reell løsning", graph: (x) => a*x*x+b*x+c};
        let x1 = (-b+Math.sqrt(d))/(2*a), x2 = (-b-Math.sqrt(d))/(2*a);
        return { res: `x1: ${x1.toFixed(2)}, x2: ${x2.toFixed(2)}`, exp: `Diskriminant: ${d}\nx = (-${b} ± √${d}) / ${2*a}`, graph: (x) => a*x*x+b*x+c };
    }},
    { id: 13, folder: "Algebra", name: "Topp/Bunnpunkt", formula: "x = -b / 2a", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value);
        let x = -b/(2*a), y = a*x*x+b*x+c;
        return { res: `Punkt: (${x.toFixed(2)}, ${y.toFixed(2)})`, exp: `x = -${b}/(2*${a}) = ${x}\ny = f(${x}) = ${y}`, graph: (val) => a*val*val+b*val+c };
    }},
    { id: 34, folder: "Algebra", name: "Asymptoter (Rasjonell)", formula: "f(x) = (ax+b)/(cx+d)", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value), d=parseFloat(document.getElementById('i4').value);
        let vert = -d/c; let hori = a/c;
        return { res: `Vertikal: x = ${vert.toFixed(2)}, Horisontal: y = ${hori.toFixed(2)}`, exp: `Vertikal: cx+d=0 -> x = -d/c = -${d}/${c}\nHorisontal: x->∞ -> y = a/c = ${a}/${c}`, graph: (x) => (a*x+b)/(c*x+d) };
    }},

    // GEOMETRI
    { id: 5, folder: "Geometri", name: "Pytagoras", formula: "a² + b² = c²", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        let c = Math.sqrt(a*a+b*b);
        return { res: `c = ${c.toFixed(2)}`, exp: `√(${a}² + ${b}²) = √(${a*a+b*b}) = ${c.toFixed(2)}` };
    }},
    { id: 38, folder: "Geometri", name: "Trekantløseren", formula: "Sinus- & Cosinussetningen", html: '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"><input type="number" id="trigA" placeholder="Side a"><input type="number" id="trigvA" placeholder="Vinkel A (°)"> <input type="number" id="trigB" placeholder="Side b"><input type="number" id="trigvB" placeholder="Vinkel B (°)"> <input type="number" id="trigC" placeholder="Side c"><input type="number" id="trigvC" placeholder="Vinkel C (°)"></div>', calc: () => {
            const rad = (d) => d * (Math.PI / 180); const deg = (r) => r * (180 / Math.PI);
            let a = parseFloat(document.getElementById('trigA').value), b = parseFloat(document.getElementById('trigB').value), c = parseFloat(document.getElementById('trigC').value);
            let A = parseFloat(document.getElementById('trigvA').value), B = parseFloat(document.getElementById('trigvB').value), C = parseFloat(document.getElementById('trigvC').value);
            let k = [a,b,c,A,B,C].filter(v => !isNaN(v)).length;
            if(k < 3) return {res: "Mangler info"};
            for(let i=0; i<10; i++) {
                if(!isNaN(A) && !isNaN(B) && isNaN(C)) C = 180-A-B; if(!isNaN(A) && !isNaN(C) && isNaN(B)) B = 180-A-C; if(!isNaN(B) && !isNaN(C) && isNaN(A)) A = 180-B-C;
                if(isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(A)) a = Math.sqrt(b*b+c*c-2*b*c*Math.cos(rad(A)));
                if(isNaN(b) && !isNaN(a) && !isNaN(c) && !isNaN(B)) b = Math.sqrt(a*a+c*c-2*a*c*Math.cos(rad(B)));
                if(isNaN(c) && !isNaN(a) && !isNaN(b) && !isNaN(C)) c = Math.sqrt(a*a+b*b-2*a*b*Math.cos(rad(C)));
                if(isNaN(A) && !isNaN(a) && !isNaN(b) && !isNaN(c)) A = deg(Math.acos((b*b+c*c-a*a)/(2*b*c)));
                if(!isNaN(A) && !isNaN(a)) { if(isNaN(b) && !isNaN(B)) b = a*Math.sin(rad(B))/Math.sin(rad(A)); if(isNaN(c) && !isNaN(C)) c = a*Math.sin(rad(C))/Math.sin(rad(A)); }
            }
            return { res: `a:${a.toFixed(1)} b:${b.toFixed(1)} c:${c.toFixed(1)}`, exp: `A:${A.toFixed(1)}° B:${B.toFixed(1)}° C:${C.toFixed(1)}°` };
        }
    },

    // ØKONOMI
    { id: 37, folder: "Økonomi", name: "Valuta (Sanntid)", formula: "Live kurser", html: '<input type="number" id="i1" value="100"><select id="i2"><option value="NOK">NOK</option><option value="USD">USD</option><option value="EUR">EUR</option></select><select id="i3"><option value="USD">USD</option><option value="NOK">NOK</option></select>', calc: async () => {
        let am = document.getElementById('i1').value, f = document.getElementById('i2').value, t = document.getElementById('i3').value;
        try { let r = await fetch(`https://open.er-api.com/v6/latest/${f}`); let d = await r.json(); let res = am * d.rates[t]; return { res: `${res.toFixed(2)} ${t}`, exp: `Kurs hentet nå.` }; }
        catch(e) { return { res: "Feil" }; }
    }},

    // DIVERSE
    { id: 20, folder: "Diverse", name: "Om appen", formula: "Info", html: '<p>Total Kalkulator V10 Pro av Leon Aabak.</p>', calc: () => ({res:"Leon Aabak V10 Pro"}) }
];

function clearHistory() { historyData = []; localStorage.setItem('calcHistory', '[]'); renderHistory(); }

function renderFolders() {
    folderView.innerHTML = ''; folderView.style.display = 'grid'; listView.style.display = 'none'; calcView.style.display = 'none';
    const folderIcons = { "Favoritter": "⭐", "Grunnleggende": "🧮", "Algebra": "📉", "Geometri": "📐", "Økonomi": "💰", "Diverse": "✨" };
    if(favorites.length > 0) {
        const f = document.createElement('div'); f.className = 'card glass-panel'; f.innerHTML = `⭐ Favoritter`;
        f.onclick = () => openFolder("Favoritter"); folderView.appendChild(f);
    }
    [...new Set(calculators.map(c => c.folder))].forEach(n => {
        const c = document.createElement('div'); c.className = 'card glass-panel'; c.innerHTML = `${folderIcons[n] || "📁"} ${n}`;
        c.onclick = () => openFolder(n); folderView.appendChild(c);
    });
    renderHistory();
}

function openFolder(n) {
    currentFolder = n; folderView.style.display = 'none'; listView.style.display = 'grid'; listView.innerHTML = '';
    let l = n === "Favoritter" ? calculators.filter(c => favorites.includes(c.id)) : calculators.filter(c => c.folder === n);
    l.forEach(c => {
        const el = document.createElement('div'); el.className = 'card glass-panel'; el.innerHTML = c.name;
        el.onclick = () => openCalc(c); listView.appendChild(el);
    });
}

function openCalc(c) {
    currentCalc = c; listView.style.display = 'none'; calcView.style.display = 'block';
    document.getElementById('calc-title').innerText = c.name; document.getElementById('pre-calc-formula').innerText = c.formula;
    document.getElementById('input-container').innerHTML = c.html; document.getElementById('result-container').style.display = 'none';
}

function showHome() { searchBar.value = ''; renderFolders(); }

async function executeCalc() {
    const res = await currentCalc.calc();
    document.getElementById('result-box').innerText = "Svar: " + res.res;
    document.getElementById('explanation-box').innerText = res.exp || "";
    document.getElementById('result-container').style.display = 'block';
    if(res.graph) { document.getElementById('graph-container').style.display = 'block'; currentGraphFunc = res.graph; drawGraph(); }
    else { document.getElementById('graph-container').style.display = 'none'; }
    historyData = [{name: currentCalc.name, res: res.res}, ...historyData].slice(0, 5);
    localStorage.setItem('calcHistory', JSON.stringify(historyData)); renderHistory();
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = historyData.length ? historyData.map(h => `<div class="history-item"><b>${h.name}</b><span>${h.res}</span></div>`).join('') : '<i>Tomt.</i>';
}

// --- HURTIG GRAF ---
const hurtigCanvas = document.getElementById('hurtigCanvas');
const hurtigCtx = hurtigCanvas.getContext('2d');
const hurtigInput = document.getElementById('hurtigGrafInput');

function tegnHurtigGraf() {
    const w = hurtigCanvas.width, h = hurtigCanvas.height, s = 15;
    hurtigCtx.clearRect(0,0,w,h);
    hurtigCtx.strokeStyle = '#333'; hurtigCtx.beginPath();
    hurtigCtx.moveTo(0, h/2); hurtigCtx.lineTo(w, h/2); hurtigCtx.moveTo(w/2, 0); hurtigCtx.lineTo(w/2, h); hurtigCtx.stroke();
    
    let expr = hurtigInput.value.replace(/x/g, '(x)').replace(/\^/g, '**');
    hurtigCtx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--primary');
    hurtigCtx.beginPath();
    for(let px=0; px<w; px++) {
        let x = (px - w/2) / s;
        try {
            let y = eval(expr);
            let py = h/2 - y*s;
            if(px===0) hurtigCtx.moveTo(px, py); else hurtigCtx.lineTo(px, py);
        } catch(e) {}
    }
    hurtigCtx.stroke();
}
hurtigInput.addEventListener('input', tegnHurtigGraf);

// --- ENHETSSIRKEL ---
const sirkelCanvas = document.getElementById('enhetssirkel');
const sirkelCtx = sirkelCanvas.getContext('2d');
const vinkelInput = document.getElementById('vinkelInput');

function oppdaterSirkel() {
    const w = sirkelCanvas.width, h = sirkelCanvas.height, r = 80;
    const v = parseFloat(vinkelInput.value) || 0, rad = v * Math.PI/180;
    const sin = Math.sin(rad), cos = Math.cos(rad);
    
    document.getElementById('sinVerdi').innerText = sin.toFixed(2);
    document.getElementById('cosVerdi').innerText = cos.toFixed(2);
    
    sirkelCtx.clearRect(0,0,w,h);
    sirkelCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    sirkelCtx.beginPath(); sirkelCtx.arc(w/2, h/2, r, 0, Math.PI*2); sirkelCtx.stroke();
    sirkelCtx.beginPath(); sirkelCtx.moveTo(0, h/2); sirkelCtx.lineTo(w, h/2); sirkelCtx.moveTo(w/2, 0); sirkelCtx.lineTo(w/2, h); sirkelCtx.stroke();
    
    sirkelCtx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--primary');
    sirkelCtx.beginPath(); sirkelCtx.moveTo(w/2, h/2); sirkelCtx.lineTo(w/2 + cos*r, h/2 - sin*r); sirkelCtx.stroke();
}
vinkelInput.addEventListener('input', oppdaterSirkel);

searchBar.oninput = () => {
    const q = searchBar.value.toLowerCase(); if(!q) return showHome();
    folderView.style.display = 'none'; listView.style.display = 'grid'; listView.innerHTML = '';
    calculators.filter(c => c.name.toLowerCase().includes(q)).forEach(c => {
        const el = document.createElement('div'); el.className = 'card glass-panel'; el.innerHTML = c.name;
        el.onclick = () => openCalc(c); listView.appendChild(el);
    });
};

renderFolders(); oppdaterSirkel(); tegnHurtigGraf();
