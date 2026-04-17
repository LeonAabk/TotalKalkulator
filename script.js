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
    { id: 14, folder: "Algebra", name: "Nullpunkt (Lineær)", formula: "ax + b = 0", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        return { res: `x = ${-b/a}`, exp: `ax = -b\nx = -${b}/${a}`, graph: (x) => a*x+b };
    }},
    { id: 10, folder: "Algebra", name: "Momentan vekstfart", formula: "f'(x) = 2ax + b", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="x">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), x=parseFloat(document.getElementById('i3').value);
        return { res: `f'(${x}) = ${2*a*x+b}`, exp: `Derivert: ${2*a}x + ${b}\nSatt inn x: ${2*a}*${x} + ${b} = ${2*a*x+b}` };
    }},
    { id: 9, folder: "Algebra", name: "Gj.snittlig vekstfart", formula: "Δy / Δx", html: '<input type="number" id="i1" placeholder="x1"><input type="number" id="i2" placeholder="y1"><input type="number" id="i3" placeholder="x2"><input type="number" id="i4" placeholder="y2">', calc: () => {
        let x1=parseFloat(document.getElementById('i1').value), y1=parseFloat(document.getElementById('i2').value), x2=parseFloat(document.getElementById('i3').value), y2=parseFloat(document.getElementById('i4').value);
        return { res: `Vekstfart: ${(y2-y1)/(x2-x1)}`, exp: `(${y2}-${y1}) / (${x2}-${x1}) = ${(y2-y1)/(x2-x1)}` };
    }},
    { id: 12, folder: "Algebra", name: "Eksponentiell", formula: "y = a * b^x", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="x">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), x=parseFloat(document.getElementById('i3').value);
        return { res: a*Math.pow(b,x), exp: `${a} * ${b}^${x} = ${a*Math.pow(b,x)}`, graph: (v) => a*Math.pow(b,v) };
    }},
    { id: 34, folder: "Algebra", name: "Asymptoter (Rasjonell)", formula: "f(x) = (ax+b)/(cx+d)", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value), d=parseFloat(document.getElementById('i4').value);
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

    // GEOMETRI
    { id: 5, folder: "Geometri", name: "Pytagoras", formula: "a² + b² = c²", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        let c = Math.sqrt(a*a+b*b);
        return { res: `c = ${c.toFixed(2)}`, exp: `√(${a}² + ${b}²) = √(${a*a+b*b}) = ${c.toFixed(2)}` };
    }},
    { id: 24, folder: "Geometri", name: "Areal Sirkel", formula: "πr²", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: (Math.PI*r*r).toFixed(2), exp: `π * ${r}² = ${(Math.PI*r*r).toFixed(2)}` };
    }},
    { id: 25, folder: "Geometri", name: "Kulevolum", formula: "(4/3)πr³", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: ((4/3)*Math.PI*Math.pow(r,3)).toFixed(2), exp: `(4/3)*π*${r}³ = ${((4/3)*Math.PI*Math.pow(r,3)).toFixed(2)}` };
    }},
    { id: 8, folder: "Geometri", name: "Volum Boks", formula: "l * b * h", html: '<input type="number" id="i1" placeholder="l"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="h">', calc: () => {
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

    // MATTE
    { id: 3, folder: "Matte", name: "Brøk (Forenkle)", formula: "a/b -> c/d", html: '<input type="number" id="i1" placeholder="Teller"><input type="number" id="i2" placeholder="Nevner">', calc: () => {
        let a=parseInt(document.getElementById('i1').value), b=parseInt(document.getElementById('i2').value);
        let d = gcd(a,b); return { res: `${a/d} / ${b/d}`, exp: `Deler på største felles divisor: ${d}` };
    }},
    { id: 4, folder: "Matte", name: "Brøk til Desimal", formula: "a / b", html: '<input type="number" id="i1" placeholder="Teller"><input type="number" id="i2" placeholder="Nevner">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        return { res: a/b, exp: `${a} / ${b} = ${a/b}` };
    }},

    // STATISTIKK
    { id: 6, folder: "Statistikk", name: "Sannsynlighet", formula: "g / m", html: '<input type="number" id="i1" placeholder="Gunstige"><input type="number" id="i2" placeholder="Mulige">', calc: () => {
        let g=parseFloat(document.getElementById('i1').value), m=parseFloat(document.getElementById('i2').value);
        return { res: `${((g/m)*100).toFixed(2)}%`, exp: `${g} / ${m} = ${(g/m).toFixed(4)}` };
    }},
    { id: 22, folder: "Statistikk", name: "Gjennomsnitt", formula: "Sum / n", html: '<input type="text" id="i1" placeholder="Eks: 2, 4, 6">', calc: () => {
        let arr = document.getElementById('i1').value.split(',').map(Number).filter(x => !isNaN(x));
        let sum = arr.reduce((a,b)=>a+b,0); return { res: sum/arr.length, exp: `Sum: ${sum}, Antall: ${arr.length}` };
    }},

    // FYSIKK
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

    // ØKONOMI
    { id: 26, folder: "Økonomi", name: "Rentes rente", formula: "K * v^t", html: '<input type="number" id="i1" placeholder="Kapital"><input type="number" id="i2" placeholder="Vekstf. (f.eks 1.05)"><input type="number" id="i3" placeholder="År">', calc: () => {
        let k=parseFloat(document.getElementById('i1').value), v=parseFloat(document.getElementById('i2').value), t=parseFloat(document.getElementById('i3').value);
        return { res: (k*Math.pow(v,t)).toFixed(2), graph: (x) => k*Math.pow(v,x) };
    }},
    { id: 30, folder: "Økonomi", name: "Opprinnelig verdi", formula: "Nåverdi / (1 - r/100)", html: '<input type="number" id="i1" placeholder="Nåværende pris"><input type="number" id="i2" placeholder="Rabatt i %">', calc: () => {
        let p=parseFloat(document.getElementById('i1').value), r=parseFloat(document.getElementById('i2').value);
        let res = p / (1 - r/100);
        return { res: res.toFixed(2) + " kr", exp: `${p} / (1 - ${r}/100) = ${res.toFixed(2)}` };
    }},

    // KONVERTERING
    { id: 31, folder: "Konvertering", name: "CM til Feet", formula: "cm / 30.48", html: '<input type="number" id="i1" placeholder="Centimeter">', calc: () => {
        let cm=parseFloat(document.getElementById('i1').value);
        return { res: (cm / 30.48).toFixed(4) + " ft", exp: `${cm} / 30.48` };
    }},
    { id: 32, folder: "Konvertering", name: "Hekto til Gram", formula: "hg * 100", html: '<input type="number" id="i1" placeholder="Hektogram">', calc: () => {
        let hg=parseFloat(document.getElementById('i1').value);
        return { res: (hg * 100) + " g", exp: `${hg} * 100` };
    }},
    { id: 33, folder: "Konvertering", name: "Liter til dl/ml", formula: "L -> dl & ml", html: '<input type="number" id="i1" placeholder="Liter">', calc: () => {
        let l=parseFloat(document.getElementById('i1').value);
        return { res: `${l*10} dl / ${l*1000} ml` };
    }},

    // DIVERSE
    { id: 29, folder: "Diverse", name: "BMI", formula: "kg / m²", html: '<input type="number" id="i1" placeholder="kg"><input type="number" id="i2" placeholder="meter">', calc: () => {
        let w=parseFloat(document.getElementById('i1').value), h=parseFloat(document.getElementById('i2').value);
        let bmi = w/(h*h); return { res: bmi.toFixed(1), exp: bmi < 18.5 ? "Undervekt" : bmi < 25 ? "Normal" : "Overvekt" };
    }},
    { id: 20, folder: "Diverse", name: "Om appen", formula: "Info", html: '<p>Utviklet av Leon Aabak. V10 Pro.</p>', calc: () => ({res:"Leon Aabak V10 Pro", exp: "Fullstendig bibliotek med 36 funksjoner."}) }
];

function clearHistory() {
    if(confirm("Slette hele loggen?")) {
        historyData = [];
        localStorage.setItem('calcHistory', JSON.stringify(historyData));
        renderHistory();
    }
}

function renderFolders() {
    folderView.innerHTML = ''; 
    folderView.style.display = 'grid'; 
    listView.style.display = 'none'; 
    calcView.style.display = 'none'; 
    historyPanel.style.display = 'block';
    
    const folderIcons = { "Favoritter": "⭐", "Grunnleggende": "🧮", "Algebra": "📉", "Geometri": "📐", "Matte": "➕", "Statistikk": "📊", "Fysikk": "🧪", "Økonomi": "💰", "Konvertering": "🔄", "Diverse": "✨" };
    
    if(favorites.length > 0) {
        const favCard = document.createElement('div'); 
        favCard.className = 'card glass-panel';
        favCard.innerHTML = `<span style="font-size: 2rem">${folderIcons["Favoritter"]}</span><br>Favoritter`;
        favCard.onclick = () => openFolder("Favoritter"); 
        folderView.appendChild(favCard);
    }
    
    const folderNames = [...new Set(calculators.map(c => c.folder))];
    folderNames.forEach(name => {
        const card = document.createElement('div'); 
        card.className = 'card glass-panel';
        const icon = folderIcons[name] || "📁";
        card.innerHTML = `<span style="font-size: 2rem">${icon}</span><br>${name}`;
        card.onclick = () => openFolder(name); 
        folderView.appendChild(card);
    });
    renderHistory();
}

function openFolder(name) {
    currentFolder = name; 
    folderView.style.display = 'none'; 
    historyPanel.style.display = 'none'; 
    listView.style.display = 'grid'; 
    listView.innerHTML = '';
    
    let list = name === "Favoritter" ? calculators.filter(c => favorites.includes(c.id)) : calculators.filter(c => c.folder === name);
    list.forEach(c => {
        const el = document.createElement('div'); 
        el.className = 'card glass-panel';
        const isFav = favorites.includes(c.id);
        el.innerHTML = `<button class="star-btn ${isFav ? 'active' : ''}" onclick="toggleFav(${c.id}, event)">★</button> ${c.name}`;
        el.onclick = () => openCalc(c); 
        listView.appendChild(el);
    });
}

function toggleFav(id, e) {
    e.stopPropagation();
    if(favorites.includes(id)) favorites = favorites.filter(x => x !== id); 
    else favorites.push(id);
    localStorage.setItem('calcFavorites', JSON.stringify(favorites)); 
    openFolder(currentFolder);
}

function openCalc(c) {
    currentCalc = c; 
    listView.style.display = 'none'; 
    calcView.style.display = 'block';
    document.getElementById('btn-back-list').style.display = searchBar.value ? 'none' : 'block';
    document.getElementById('calc-title').innerText = c.name; 
    document.getElementById('pre-calc-formula').innerText = c.formula;
    document.getElementById('input-container').innerHTML = c.html; 
    
    // --- KOBLE PÅ ENHETSSIRKEL FOR TRIGONOMETRI ---
    if (c.id === 15 || c.id === 16 || c.id === 17) {
        document.getElementById('result-container').style.display = 'block';
        toggleEnhetssirkel(true);
    } else {
        document.getElementById('result-container').style.display = 'none';
        toggleEnhetssirkel(false);
    }
}

function showHome() { 
    searchBar.value = ''; 
    renderFolders(); 
    toggleEnhetssirkel(false); // Skjuler sirkelen
}

function executeCalc() {
    if(!currentCalc) return;
    const res = currentCalc.calc();
    document.getElementById('result-box').innerText = "Svar: " + res.res;
    document.getElementById('explanation-box').innerText = res.exp || "";
    document.getElementById('result-container').style.display = 'block';
    
    if(res.graph) { 
        document.getElementById('graph-container').style.display = 'block'; 
        drawGraph(res.graph); 
    } else { 
        document.getElementById('graph-container').style.display = 'none'; 
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

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = historyData.length ? historyData.map(h => `<div class="history-item"><b>${h.name}</b><span>${h.res}</span></div>`).join('') : '<i>Ingen historikk enda.</i>';
}

function drawGraph(f) {
    canvas.width = canvas.parentElement.clientWidth; 
    canvas.height = 350;
    const w=canvas.width, h=canvas.height, ox=w/2, oy=h/2, s=25;
    ctx.clearRect(0,0,w,h); 
    
    // Grid
    ctx.strokeStyle = '#222'; 
    ctx.lineWidth = 1; 
    ctx.beginPath();
    for(let i=ox%s;i<w;i+=s){ctx.moveTo(i,0);ctx.lineTo(i,h);} 
    for(let i=oy%s;i<h;i+=s){ctx.moveTo(0,i);ctx.lineTo(w,i);} 
    ctx.stroke();
    
    // Akser
    ctx.strokeStyle = '#555'; 
    ctx.lineWidth = 2; 
    ctx.beginPath(); 
    ctx.moveTo(0,oy); ctx.lineTo(w,oy); 
    ctx.moveTo(ox,0); ctx.lineTo(ox,h); 
    ctx.stroke();
    
    // Funksjon
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary'); 
    ctx.lineWidth = 2; 
    ctx.beginPath();
    
    let lastY = null;
    for(let px=0; px<=w; px+=1) { 
        let mx=(px-ox)/s; 
        let my=f(mx); 
        let py=oy-(my*s); 
        
        // Sjekker for asymptoter eller store hopp
        if (lastY !== null && Math.abs(py - lastY) > h/2) {
            ctx.stroke(); // Avslutter nåværende linje
            ctx.beginPath(); // Starter ny linje etter bruddet
            ctx.moveTo(px, py);
        } else if (!isNaN(py) && isFinite(py)) {
            if (lastY === null) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        lastY = py;
    } 
    ctx.stroke();
}

searchBar.oninput = () => {
    const q = searchBar.value.toLowerCase(); 
    if(!q) return showHome();
    
    folderView.style.display = historyPanel.style.display = 'none'; 
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
    // Skjul grafen og resultatene for neste gang
    document.getElementById('result-container').style.display = 'none';
    toggleEnhetssirkel(false); // Skjuler sirkelen
};

renderFolders();


// =========================================
// ENHETSSIRKEL LOGIKK
// =========================================

const canvasSirkel = document.getElementById('enhetssirkel');
const ctxSirkel = canvasSirkel ? canvasSirkel.getContext('2d') : null;
const vinkelInput = document.getElementById('vinkelInput');

function oppdaterSirkel() {
    if (!ctxSirkel) return;
    
    // Canvas er 300x300, så senteret er på 150,150
    const senterX = canvasSirkel.width / 2;
    const senterY = canvasSirkel.height / 2;
    const radius = 100; 

    // Hent vinkel fra input (standard 0 hvis tom)
    let grader = parseFloat(vinkelInput.value) || 0;
    let radianer = grader * (Math.PI / 180);

    let sinVerdi = Math.sin(radianer);
    let cosVerdi = Math.cos(radianer);
    let tanVerdi = Math.tan(radianer);

    // Oppdater tallene i HTML
    document.getElementById('sinVerdi').innerText = sinVerdi.toFixed(4);
    document.getElementById('cosVerdi').innerText = cosVerdi.toFixed(4);
    
    // Håndter uendelig tangens (90 og 270 grader)
    if (grader % 180 === 90 || grader % 180 === -90) {
        document.getElementById('tanVerdi').innerText = "Udefinert";
    } else {
        document.getElementById('tanVerdi').innerText = tanVerdi.toFixed(4);
    }

    // Finn koordinater på sirkelen
    let punktX = senterX + (cosVerdi * radius);
    let punktY = senterY - (sinVerdi * radius);

    // 1. Tøm lerretet for forrige tegning
    ctxSirkel.clearRect(0, 0, canvasSirkel.width, canvasSirkel.height);
    
    // 2. Tegn x- og y-akser (Svake, hvite linjer)
    ctxSirkel.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxSirkel.lineWidth = 1;
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(0, senterY);
    ctxSirkel.lineTo(canvasSirkel.width, senterY);
    ctxSirkel.moveTo(senterX, 0);
    ctxSirkel.lineTo(senterX, canvasSirkel.height);
    ctxSirkel.stroke();

    // 3. Tegn selve enhetssirkelen
    // Prøver å hente CSS-variabelen for primary-fargen, faller tilbake på hvit
    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#ffffff';
    ctxSirkel.strokeStyle = primaryColor;
    ctxSirkel.lineWidth = 2;
    ctxSirkel.beginPath();
    ctxSirkel.arc(senterX, senterY, radius, 0, 2 * Math.PI);
    ctxSirkel.stroke();

    // 4. Tegn hypotenusen (linjen fra senter til punktet)
    ctxSirkel.strokeStyle = '#ffffff';
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(senterX, senterY);
    ctxSirkel.lineTo(punktX, punktY);
    ctxSirkel.stroke();
    
    // 5. Tegn punktet på sirkelbuen
    ctxSirkel.fillStyle = primaryColor;
    ctxSirkel.beginPath();
    ctxSirkel.arc(punktX, punktY, 5, 0, 2 * Math.PI);
    ctxSirkel.fill();
}

// Lytt etter endringer hver gang brukeren skriver et tall
if (vinkelInput) {
    vinkelInput.addEventListener('input', oppdaterSirkel);
}

// Hjelpefunksjon for å vise eller skjule sirkelen
function toggleEnhetssirkel(skalVises) {
    const container = document.getElementById('enhetssirkel-container');
    if (!container) return;
    
    if (skalVises) {
        container.style.display = 'block';
        oppdaterSirkel(); // Tegner sirkelen så snart den blir synlig
    } else {
        container.style.display = 'none';
    }
}
