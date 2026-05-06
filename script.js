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

let savedTheme = JSON.parse(localStorage.getItem('calcTheme'));
if(savedTheme) setTheme(savedTheme.p, savedTheme.s, savedTheme.i);
else setTheme('#00d2ff', '#3a7bd5', 0);

// Load saved appearance settings
let savedBackground = localStorage.getItem('calcBackground') || 'normal';
setBackground(savedBackground);

let savedFontSize = localStorage.getItem('calcFontSize') || 'normal';
setFontSize(savedFontSize);

let savedContrast = localStorage.getItem('calcContrast') || 'normal';
setContrast(savedContrast);

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
    // GRUNNLEGGENDE (5)
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
    { id: 24, folder: "Geometri", name: "Areal Sirkel", formula: "πr²", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: (Math.PI*r*r).toFixed(2), exp: `π * ${r}² = ${(Math.PI*r*r).toFixed(2)}` };
    }},
    { id: 25, folder: "Geometri", name: "Kulevolum", formula: "(4/3)πr³", html: '<input type="number" id="i1" placeholder="r">', calc: () => {
        let r=parseFloat(document.getElementById('i1').value);
        return { res: ((4/3)*Math.PI*Math.pow(r,3)).toFixed(2), exp: `(4/3)*π*${r}³ = ${((4/3)*Math.PI*Math.pow(r,3)).toFixed(2)}` };
    }},
    // GEOMETRI: Areal av Trapes
    { 
        id: 62, 
        folder: "Geometri", 
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
        folder: "Geometri", 
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
        folder: "Geometri", 
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
        folder: "Geometri", 
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
        folder: "Geometri", 
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
        let sum = arr.reduce((a,b)=>a+b,0); return { res: sum/arr.length, exp: `Sum: ${sum}, Antall: ${arr.length}` };
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
        folder: "Geometri", 
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
                <li style="margin-bottom: 8px;"><b>55 Funksjoner:</b> Alt fra prosent til trigonometri og Trekantløser.</li>
                <li style="margin-bottom: 8px;"><b>Valuta i sanntid:</b> Hent oppdaterte kurser direkte fra nettet.</li>
                <li style="margin-bottom: 8px;"><b>Avansert Grafmotor:</b> Tegn grafer med interaktiv zoom og panorering.</li>
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

function renderFolders() {
    folderView.innerHTML = ''; 
    folderView.style.display = 'grid'; 
    listView.style.display = 'none'; 
    calcView.style.display = 'none'; 
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
    renderFolders(); 
}

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
const hurtigCtx = hurtigCanvas.getContext('2d');
const hurtigInput = document.getElementById('hurtigGrafInput');

function tegnHurtigGraf() {
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
hurtigInput.addEventListener('input', tegnHurtigGraf);
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
renderFolders();
oppdaterSirkel();
tegnHurtigGraf();
 
if (typeof tegnKastbane === 'function') tegnKastbane();
if (typeof tegnNormalfordeling === 'function') tegnNormalfordeling();
  