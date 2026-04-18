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

// --- GRAF-VARIABLER ---
let currentGraphFunc = null;
let graphScale = 30; 
let graphOffsetX = 0;
let graphOffsetY = 0;
let isDraggingGraph = false;
let dragStartX = 0;
let dragStartY = 0;

const calculators = [
    // ==========================================
    // GRATIS MAPPER
    // ==========================================

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

    // DIVERSE
    { id: 29, folder: "Diverse", name: "BMI", formula: "kg / m²", html: '<input type="number" id="i1" placeholder="kg"><input type="number" id="i2" placeholder="meter">', calc: () => {
        let w=parseFloat(document.getElementById('i1').value), h=parseFloat(document.getElementById('i2').value);
        let bmi = w/(h*h); return { res: bmi.toFixed(1), exp: bmi < 18.5 ? "Undervekt" : bmi < 25 ? "Normal" : "Overvekt" };
    }},
    { id: 20, folder: "Diverse", name: "Om appen", formula: "Versjon 10 Pro", html: `
        <div style="text-align: left; padding: 10px; color: #ccc; line-height: 1.6;">
            <p style="margin-bottom: 15px;">Dette er et komplett, web-basert matematikkverktøy utviklet av <b style="color: var(--primary);">Leon Aabak</b>.</p>
            <ul style="margin-bottom: 15px; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><b>38 Funksjoner:</b> Alt fra prosent til trigonometri og Trekantløser.</li>
                <li style="margin-bottom: 8px;"><b>Valuta i sanntid:</b> Hent oppdaterte kurser direkte fra nettet.</li>
                <li style="margin-bottom: 8px;"><b>Avansert Grafmotor:</b> Tegn grafer med interaktiv zoom og panorering.</li>
                <li><b>Enhetssirkel:</b> Visuell og dynamisk forståelse av trigonometri.</li>
            </ul>
        </div>`, 
        calc: () => ({ res: "Leon Aabak V10 Pro", exp: "Håper du får god bruk for Total Kalkulator!" }) 
    },


    // ==========================================
    // PRO MAPPER (Krever Memberstack)
    // ==========================================

    // ALGEBRA
    { id: 23, requiresPro: true, folder: "Algebra", name: "Lineær funksjon", formula: "y = ax + b", html: '<input type="number" id="i1" placeholder="x1"><input type="number" id="i2" placeholder="y1"><input type="number" id="i3" placeholder="x2"><input type="number" id="i4" placeholder="y2">', calc: () => {
        let x1=parseFloat(document.getElementById('i1').value), y1=parseFloat(document.getElementById('i2').value), x2=parseFloat(document.getElementById('i3').value), y2=parseFloat(document.getElementById('i4').value);
        let a = (y2-y1)/(x2-x1), b = y1-(a*x1);
        return { res: `y = ${a}x ${b>=0?'+':''} ${b}`, exp: `a = (${y2}-${y1})/(${x2}-${x1}) = ${a}\nb = ${y1}-(${a}*${x1}) = ${b}`, graph: (x) => a*x+b };
    }},
    { id: 11, requiresPro: true, folder: "Algebra", name: "Andregrad (ABC)", formula: "ax² + bx + c = 0", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value);
        let d = (b*b)-(4*a*c);
        if(d<0) return {res: "Ingen reell løsning", graph: (x) => a*x*x+b*x+c};
        let x1 = (-b+Math.sqrt(d))/(2*a), x2 = (-b-Math.sqrt(d))/(2*a);
        return { res: `x1: ${x1.toFixed(2)}, x2: ${x2.toFixed(2)}`, exp: `Diskriminant: ${d}\nx = (-${b} ± √${d}) / ${2*a}`, graph: (x) => a*x*x+b*x+c };
    }},
    { id: 13, requiresPro: true, folder: "Algebra", name: "Topp/Bunnpunkt", formula: "x = -b / 2a", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value);
        let x = -b/(2*a), y = a*x*x+b*x+c;
        return { res: `Punkt: (${x.toFixed(2)}, ${y.toFixed(2)})`, exp: `x = -${b}/(2*${a}) = ${x}\ny = f(${x}) = ${y}`, graph: (val) => a*val*val+b*val+c };
    }},
    { id: 14, requiresPro: true, folder: "Algebra", name: "Nullpunkt (Lineær)", formula: "ax + b = 0", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        return { res: `x = ${-b/a}`, exp: `ax = -b\nx = -${b}/${a}`, graph: (x) => a*x+b };
    }},
    { id: 10, requiresPro: true, folder: "Algebra", name: "Momentan vekstfart", formula: "f'(x) = 2ax + b", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="x">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), x=parseFloat(document.getElementById('i3').value);
        return { res: `f'(${x}) = ${2*a*x+b}`, exp: `Derivert: ${2*a}x + ${b}\nSatt inn x: ${2*a}*${x} + ${b} = ${2*a*x+b}` };
    }},
    { id: 9, requiresPro: true, folder: "Algebra", name: "Gj.snittlig vekstfart", formula: "Δy / Δx", html: '<input type="number" id="i1" placeholder="x1"><input type="number" id="i2" placeholder="y1"><input type="number" id="i3" placeholder="x2"><input type="number" id="i4" placeholder="y2">', calc: () => {
        let x1=parseFloat(document.getElementById('i1').value), y1=parseFloat(document.getElementById('i2').value), x2=parseFloat(document.getElementById('i3').value), y2=parseFloat(document.getElementById('i4').value);
        return { res: `Vekstfart: ${(y2-y1)/(x2-x1)}`, exp: `(${y2}-${y1}) / (${x2}-${x1}) = ${(y2-y1)/(x2-x1)}` };
    }},
    { id: 12, requiresPro: true, folder: "Algebra", name: "Eksponentiell", formula: "y = a * b^x", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="x">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), x=parseFloat(document.getElementById('i3').value);
        return { res: a*Math.pow(b,x), exp: `${a} * ${b}^${x} = ${a*Math.pow(b,x)}`, graph: (v) => a*Math.pow(b,v) };
    }},
    { id: 34, requiresPro: true, folder: "Algebra", name: "Asymptoter (Rasjonell)", formula: "f(x) = (ax+b)/(cx+d)", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value), d=parseFloat(document.getElementById('i4').value);
        let vert = -d/c; let hori = a/c;
        return { res: `Vertikal: x = ${vert.toFixed(2)}, Horisontal: y = ${hori.toFixed(2)}`, exp: `Vertikal: cx+d=0 -> x = -d/c = -${d}/${c}\nHorisontal: x->∞ -> y = a/c = ${a}/${c}`, graph: (x) => (a*x+b)/(c*x+d) };
    }},
    { id: 35, requiresPro: true, folder: "Algebra", name: "Rasjonal ligning", formula: "(ax+b)/(cx+d) = k", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="c"><input type="number" id="i4" placeholder="d"><input type="number" id="i5" placeholder="k">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), c=parseFloat(document.getElementById('i3').value), d=parseFloat(document.getElementById('i4').value), k=parseFloat(document.getElementById('i5').value);
        let x = (k*d - b) / (a - k*c);
        return { res: `x = ${x.toFixed(2)}`, exp: `Ligning: ax+b = k(cx+d)\nax+b = kcx + kd\nx(a-kc) = kd-b\nx = (kd-b)/(a-kc)` };
    }},
    { id: 36, requiresPro: true, folder: "Algebra", name: "Symmetrilinje", formula: "x = -b / 2a", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        let x = -b/(2*a);
        return { res: `x = ${x.toFixed(2)}`, exp: `Symmetrilinje (der f'(x)=0):\nx = -b / 2a = -${b} / (2*${a})` };
    }},

    // GEOMETRI
    { id: 5, requiresPro: true, folder: "Geometri", name: "Pytagoras", formula: "a² + b² = c²", html: '<input type="number" id="i1" placeholder="a"><input type="number" id="i2" placeholder="b">', calc: () => {
        let a=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value);
        let c = Math.sqrt(a*a+b*b);
        return { res: `c = ${c.toFixed(2)}`, exp: `√(${a}² + ${b}²) = √(${a*a+b*b}) = ${c.toFixed(2)}` };
    }},
    { id: 24, requiresPro: true, folder: "Geometri", name: "Areal Sirkel", formula: "πr²", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: (Math.PI*r*r).toFixed(2), exp: `π * ${r}² = ${(Math.PI*r*r).toFixed(2)}` };
    }},
    { id: 25, requiresPro: true, folder: "Geometri", name: "Kulevolum", formula: "(4/3)πr³", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: ((4/3)*Math.PI*Math.pow(r,3)).toFixed(2), exp: `(4/3)*π*${r}³ = ${((4/3)*Math.PI*Math.pow(r,3)).toFixed(2)}` };
    }},
    { id: 8, requiresPro: true, folder: "Geometri", name: "Volum Boks", formula: "l * b * h", html: '<input type="number" id="i1" placeholder="l"><input type="number" id="i2" placeholder="b"><input type="number" id="i3" placeholder="h">', calc: () => {
        let l=parseFloat(document.getElementById('i1').value), b=parseFloat(document.getElementById('i2').value), h=parseFloat(document.getElementById('i3').value);
        return { res: l*b*h, exp: `${l} * ${b} * ${h} = ${l*b*h}` };
    }},
    { id: 15, requiresPro: true, folder: "Geometri", name: "Trigonometri (Vinkel)", formula: "sin(v), cos(v)", html: '<input type="number" id="i1" placeholder="Grader">', calc: () => {
        let v=parseFloat(document.getElementById('i1').value), r = v*(Math.PI/180);
        return { res: `Sin: ${Math.sin(r).toFixed(3)}, Cos: ${Math.cos(r).toFixed(3)}`, graph: (x) => Math.sin(x) };
    }},
    { id: 16, requiresPro: true, folder: "Geometri", name: "Eksakt Trig", formula: "Vinkelverdier", html: '<select id="i1"><option value="30">30°</option><option value="45">45°</option><option value="60">60°</option><option value="90">90°</option></select>', calc: () => {
        let v=document.getElementById('i1').value;
        const m = {"30":"Sin: 1/2, Cos: √3/2", "45":"Sin: √2/2, Cos: √2/2", "60":"Sin: √3/2, Cos: 1/2", "90":"Sin: 1, Cos: 0"};
        return { res: m[v] };
    }},
    { id: 17, requiresPro: true, folder: "Geometri", name: "Trigonometri (Lengde)", formula: "v = sin⁻¹(o/h)", html: '<input type="number" id="i1" placeholder="Motstående"><input type="number" id="i2" placeholder="Hypotenus">', calc: () => {
        let o=parseFloat(document.getElementById('i1').value), h=parseFloat(document.getElementById('i2').value);
        let grad = Math.asin(o/h)*(180/Math.PI);
        return { res: `Vinkel: ${grad.toFixed(2)}°`, exp: `asin(${o}/${h}) = ${grad.toFixed(2)}°` };
    }},
    { id: 38, requiresPro: true, folder: "Geometri", name: "Trekantløseren", formula: "Sinus- & Cosinussetningen", html: `
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

    // FYSIKK
    { id: 18, requiresPro: true, folder: "Fysikk", name: "Bølge", formula: "v = f * λ", html: '<input type="number" id="i1" placeholder="f (Hz)"><input type="number" id="i2" placeholder="λ (m)">', calc: () => {
        let f=parseFloat(document.getElementById('i1').value), l=parseFloat(document.getElementById('i2').value);
        return { res: `${f*l} m/s`, graph: (x) => Math.sin(x) };
    }},
    { id: 19, requiresPro: true, folder: "Fysikk", name: "Lydfart", formula: "331.3 + 0.6t", html: '<input type="number" id="i1" placeholder="Temp °C">', calc: () => {
        let t=parseFloat(document.getElementById('i1').value);
        return { res: `${(331.3 + 0.606*t).toFixed(2)} m/s` };
    }},
    { id: 28, requiresPro: true, folder: "Fysikk", name: "Fart, Vei, Tid", formula: "v = s / t", html: '<input type="number" id="i1" placeholder="v"><input type="number" id="i2" placeholder="s"><input type="number" id="i3" placeholder="t">', calc: () => {
        let v=document.getElementById('i1').value, s=document.getElementById('i2').value, t=document.getElementById('i3').value;
        if(!v) return {res: `v = ${s/t}`}; if(!s) return {res: `s = ${v*t}`}; return {res: `t = ${s/v}`};
    }},

    // ØKONOMI
    { id: 26, requiresPro: true, folder: "Økonomi", name: "Rentes rente", formula: "K * v^t", html: '<input type="number" id="i1" placeholder="Kapital"><input type="number" id="i2" placeholder="Vekstf. (f.eks 1.05)"><input type="number" id="i3" placeholder="År">', calc: () => {
        let k=parseFloat(document.getElementById('i1').value), v=parseFloat(document.getElementById('i2').value), t=parseFloat(document.getElementById('i3').value);
        return { res: (k*Math.pow(v,t)).toFixed(2), graph: (x) => k*Math.pow(v,x) };
    }},
    { id: 30, requiresPro: true, folder: "Økonomi", name: "Opprinnelig verdi", formula: "Nåverdi / (1 - r/100)", html: '<input type="number" id="i1" placeholder="Nåværende pris"><input type="number" id="i2" placeholder="Rabatt i %">', calc: () => {
        let p=parseFloat(document.getElementById('i1').value), r=parseFloat(document.getElementById('i2').value);
        let res = p / (1 - r/100);
        return { res: res.toFixed(2) + " kr", exp: `${p} / (1 - ${r}/100) = ${res.toFixed(2)}` };
    }},
    { id: 37, requiresPro: true, folder: "Økonomi", name: "Valuta (Sanntid)", formula: "Henter live kurser...", html: '<input type="number" id="i1" placeholder="Beløp" value="100"><select id="i2"><option value="NOK">Fra: Norske Kroner (NOK)</option><option value="USD">Fra: Amerikanske Dollar (USD)</option><option value="EUR">Fra: Euro (EUR)</option><option value="GBP">Fra: Britiske Pund (GBP)</option><option value="SEK">Fra: Svenske Kroner (SEK)</option><option value="DKK">Fra: Danske Kroner (DKK)</option></select><select id="i3"><option value="USD">Til: Amerikanske Dollar (USD)</option><option value="NOK">Til: Norske Kroner (NOK)</option><option value="EUR">Til: Euro (EUR)</option><option value="GBP">Til: Britiske Pund (GBP)</option><option value="SEK">Til: Svenske Kroner (SEK)</option><option value="DKK">Til: Danske Kroner (DKK)</option></select>', calc: async () => {
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

    // KONVERTERING
    { id: 31, requiresPro: true, folder: "Konvertering", name: "CM til Feet", formula: "cm / 30.48", html: '<input type="number" id="i1" placeholder="Centimeter">', calc: () => {
        let cm=parseFloat(document.getElementById('i1').value);
        return { res: (cm / 30.48).toFixed(4) + " ft", exp: `${cm} / 30.48` };
    }},
    { id: 32, requiresPro: true, folder: "Konvertering", name: "Hekto til Gram", formula: "hg * 100", html: '<input type="number" id="i1" placeholder="Hektogram">', calc: () => {
        let hg=parseFloat(document.getElementById('i1').value);
        return { res: (hg * 100) + " g", exp: `${hg} * 100` };
    }},
    { id: 33, requiresPro: true, folder: "Konvertering", name: "Liter til dl/ml", formula: "L -> dl & ml", html: '<input type="number" id="i1" placeholder="Liter">', calc: () => {
        let l=parseFloat(document.getElementById('i1').value);
        return { res: `${l*10} dl / ${l*1000} ml` };
    }}
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
    
    // Gjenopprett synlighet for verktøy på forsiden
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
    listView.style.display = 'grid'; 
    listView.innerHTML = '';
    
    let list = name === "Favoritter" ? calculators.filter(c => favorites.includes(c.id)) : calculators.filter(c => c.folder === name);
    list.forEach(c => {
        const el = document.createElement('div'); 
        el.className = 'card glass-panel';
        const isFav = favorites.includes(c.id);
        const proIcon = c.requiresPro ? ' <span style="font-size: 0.8rem; opacity: 0.7;">🔒</span>' : '';
        
        el.innerHTML = `<button class="star-btn ${isFav ? 'active' : ''}" onclick="toggleFav(${c.id}, event)">★</button> ${c.name}${proIcon}`;
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

// === SJEKKER MEMBERSTACK FØR KALKULATOREN ÅPNES ===
async function openCalc(c) {
    if (c.requiresPro) {
        try {
            const memberstack = window.$memberstackDom;
            if (!memberstack) {
                alert("Laster betalingssystemet... prøv igjen om et sekund.");
                return;
            }
            
            const { data: member } = await memberstack.getCurrentMember();
            const hasProPlan = member && member.planConnections && member.planConnections.some(plan => plan.planId === 'pro');

            if (!hasProPlan) {
                alert(`Låst funksjon!\n\n"${c.name}" krever et Total Kalkulator Pro-abonnement. Oppgrader i menyen øverst for å få tilgang.`);
                return; 
            }
        } catch (error) {
            console.error("Feil ved sjekk av abonnement:", error);
            alert("Kunne ikke bekrefte abonnementet ditt. Vennligst sjekk at du er logget inn.");
            return;
        }
    }

    currentCalc = c; 
    listView.style.display = 'none'; 
    calcView.style.display = 'block';
    
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
}

function showHome() { 
    searchBar.value = ''; 
    // Sikrer at kalkulatoren skjules og mappene vises
    calcView.style.display = 'none';
    listView.style.display = 'none';
    
    // Viser verktøyene igjen på små skjermer
    document.getElementById('hurtig-graf-panel').style.display = 'block';
    document.getElementById('enhetssirkel-panel').style.display = 'block';
    historyPanel.style.display = 'block';
    
    renderFolders(); 
}

document.getElementById('btn-back-list').onclick = () => {
    document.getElementById('calc-view').style.display = 'none';
    document.getElementById('result-container').style.display = 'none';
    
    // Viser verktøyene igjen
    document.getElementById('hurtig-graf-panel').style.display = 'block';
    document.getElementById('enhetssirkel-panel').style.display = 'block';
    historyPanel.style.display = 'block';
    
    // Hvis vi var i et søk, gå tilbake til forsiden. 
    // Hvis ikke, tegn opp den mappen vi var i på nytt for å være sikker på at den er der.
    if (searchBar.value) {
        showHome();
    } else {
        openFolder(currentFolder);
    }
};

async function executeCalc() {
    if(!currentCalc) return;
    
    document.getElementById('result-container').style.display = 'block';
    const res = await currentCalc.calc();
    
    document.getElementById('result-box').innerText = "Svar: " + res.res;
    document.getElementById('explanation-box').innerText = res.exp || "";
    
    if(res.graph) { 
        document.getElementById('graph-container').style.display = 'block'; 
        currentGraphFunc = res.graph;
        graphOffsetX = 0; 
        graphOffsetY = 0; 
        graphScale = 30; 
        drawGraph(); 
    } else { 
        document.getElementById('graph-container').style.display = 'none'; 
        currentGraphFunc = null;
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

// =========================================
// INTERAKTIV GRAF MOTOR (HOVED)
// =========================================

function drawGraph() {
    if (!currentGraphFunc) return;
    
    const w = canvas.width = canvas.parentElement.clientWidth; 
    const h = canvas.height = 350;
    
    ctx.clearRect(0, 0, w, h); 
    
    const ox = w / 2 + graphOffsetX; 
    const oy = h / 2 + graphOffsetY; 
    
    let step = 1;
    if (graphScale < 15) step = 5;
    if (graphScale < 5) step = 10;
    if (graphScale > 60) step = 0.5;
    if (graphScale > 150) step = 0.1;

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#222'; 
    ctx.lineWidth = 1; 

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; ox + i * graphScale < w || ox - i * graphScale > 0; i += step) {
        let px = ox + i * graphScale;
        if (px <= w && px >= 0) {
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
            if (i !== 0) ctx.fillText(i, px, oy + 5);
        }
        let nx = ox - i * graphScale;
        if (i !== 0 && nx >= 0 && nx <= w) {
            ctx.beginPath(); ctx.moveTo(nx, 0); ctx.lineTo(nx, h); ctx.stroke();
            ctx.fillText(-i, nx, oy + 5);
        }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; oy + i * graphScale < h || oy - i * graphScale > 0; i += step) {
        let py = oy + i * graphScale;
        if (py <= h && py >= 0) {
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
            if (i !== 0) ctx.fillText(-i, ox - 5, py);
        }
        let ny = oy - i * graphScale;
        if (i !== 0 && ny >= 0 && ny <= h) {
            ctx.beginPath(); ctx.moveTo(0, ny); ctx.lineTo(w, ny); ctx.stroke();
            ctx.fillText(i, ox - 5, ny);
        }
    }
    
    ctx.strokeStyle = '#555'; 
    ctx.lineWidth = 2; 
    ctx.beginPath(); 
    ctx.moveTo(0, oy); ctx.lineTo(w, oy); 
    ctx.moveTo(ox, 0); ctx.lineTo(ox, h); 
    ctx.stroke();

    ctx.fillText("0", ox - 5, oy + 12);
    
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#00d2ff'; 
    ctx.lineWidth = 2; 
    ctx.beginPath();
    
    let lastY = null;
    for(let px = 0; px <= w; px += 1) { 
        let mx = (px - ox) / graphScale; 
        let my = currentGraphFunc(mx);   
        let py = oy - (my * graphScale); 
        
        if (lastY !== null && Math.abs(py - lastY) > h/2) {
            ctx.stroke(); 
            ctx.beginPath(); 
            ctx.moveTo(px, py);
        } else if (!isNaN(py) && isFinite(py)) {
            if (lastY === null) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        lastY = py;
    } 
    ctx.stroke();
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
const hurtigCtx = hurtigCanvas ? hurtigCanvas.getContext('2d') : null;
const hurtigInput = document.getElementById('hurtigGrafInput');

function tegnHurtigGraf() {
    if(!hurtigCtx) return;
    const w = hurtigCanvas.width, h = hurtigCanvas.height, s = 15;
    hurtigCtx.clearRect(0,0,w,h);
    
    hurtigCtx.strokeStyle = 'rgba(255,255,255,0.2)'; 
    hurtigCtx.lineWidth = 1;
    hurtigCtx.beginPath();
    hurtigCtx.moveTo(0, h/2); hurtigCtx.lineTo(w, h/2); 
    hurtigCtx.moveTo(w/2, 0); hurtigCtx.lineTo(w/2, h); 
    hurtigCtx.stroke();
    
    let expr = hurtigInput.value.trim();
    if (!expr) return;
    
    expr = expr.replace(/x/g, '(x)')
               .replace(/\^/g, '**')
               .replace(/sin/g, 'Math.sin')
               .replace(/cos/g, 'Math.cos')
               .replace(/tan/g, 'Math.tan')
               .replace(/sqrt/g, 'Math.sqrt');
               
    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#ffffff';
    hurtigCtx.strokeStyle = primaryColor;
    hurtigCtx.lineWidth = 2;
    hurtigCtx.beginPath();
    
    let isDrawing = false;
    for(let px=0; px<=w; px++) {
        let x = (px - w/2) / s;
        try {
            let y = eval(expr);
            let py = h/2 - y*s;
            if (isNaN(py) || !isFinite(py)) {
                isDrawing = false;
            } else {
                if(!isDrawing) { hurtigCtx.moveTo(px, py); isDrawing = true; } 
                else { hurtigCtx.lineTo(px, py); }
            }
        } catch(e) {
            break;
        }
    }
    hurtigCtx.stroke();
}
if(hurtigInput) hurtigInput.addEventListener('input', tegnHurtigGraf);


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
    const radius = 90; 

    let grader = parseFloat(vinkelInput.value) || 0;
    let radianer = grader * (Math.PI / 180);

    let sinVerdi = Math.sin(radianer);
    let cosVerdi = Math.cos(radianer);

    document.getElementById('sinVerdi').innerText = sinVerdi.toFixed(3);
    document.getElementById('cosVerdi').innerText = cosVerdi.toFixed(3);

    let punktX = senterX + (cosVerdi * radius);
    let punktY = senterY - (sinVerdi * radius);

    ctxSirkel.clearRect(0, 0, canvasSirkel.width, canvasSirkel.height);
    
    ctxSirkel.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxSirkel.lineWidth = 1;
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(0, senterY);
    ctxSirkel.lineTo(canvasSirkel.width, senterY);
    ctxSirkel.moveTo(senterX, 0);
    ctxSirkel.lineTo(senterX, canvasSirkel.height);
    ctxSirkel.stroke();

    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#ffffff';
    ctxSirkel.strokeStyle = primaryColor;
    ctxSirkel.lineWidth = 2;
    ctxSirkel.beginPath();
    ctxSirkel.arc(senterX, senterY, radius, 0, 2 * Math.PI);
    ctxSirkel.stroke();

    ctxSirkel.strokeStyle = '#ffffff';
    ctxSirkel.beginPath();
    ctxSirkel.moveTo(senterX, senterY);
    ctxSirkel.lineTo(punktX, punktY);
    ctxSirkel.stroke();
    
    ctxSirkel.fillStyle = primaryColor;
    ctxSirkel.beginPath();
    ctxSirkel.arc(punktX, punktY, 6, 0, 2 * Math.PI);
    ctxSirkel.fill();
}

if (vinkelInput) {
    vinkelInput.addEventListener('input', oppdaterSirkel);
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
        const proIcon = c.requiresPro ? ' <span style="font-size: 0.8rem; opacity: 0.7;">🔒</span>' : '';
        el.innerHTML = c.name + proIcon;
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
    document.getElementById('result-container').style.display = 'none';
    
    document.getElementById('hurtig-graf-panel').style.display = 'block';
    document.getElementById('enhetssirkel-panel').style.display = 'block';
    historyPanel.style.display = 'block';
};

// Start appen
renderFolders();
oppdaterSirkel();
tegnHurtigGraf();
