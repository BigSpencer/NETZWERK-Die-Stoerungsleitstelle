'use strict';
// =====================================================================
//  Spieldaten – alles, was Balancing betrifft, steht hier.
// =====================================================================

// Standard, falls ein alter Spielstand keine Stadt enthält
const DEFAULT_CITY = {
  name: 'Göttingen',
  center: [51.5372, 9.9310],
  radiusKm: 4.0,
  depot: [51.5385, 9.8992],
  depotName: 'Betriebshof Göttingen',
};

// Städte für die Standortwahl: [Name, Breite, Länge, Größe L/M/S]
// Größe bestimmt den Radius des Einsatzgebiets.
const CITY_SIZES = { L: 6, M: 4.5, S: 3.5 };
const CITIES = [
  ['Berlin', 52.5200, 13.4050, 'L'], ['Hamburg', 53.5511, 9.9937, 'L'], ['München', 48.1374, 11.5755, 'L'],
  ['Köln', 50.9375, 6.9603, 'L'], ['Frankfurt am Main', 50.1109, 8.6821, 'L'], ['Stuttgart', 48.7758, 9.1829, 'L'],
  ['Düsseldorf', 51.2277, 6.7735, 'L'], ['Leipzig', 51.3397, 12.3731, 'L'], ['Dortmund', 51.5136, 7.4653, 'L'],
  ['Essen', 51.4556, 7.0116, 'L'], ['Bremen', 53.0793, 8.8017, 'L'], ['Dresden', 51.0504, 13.7373, 'L'],
  ['Hannover', 52.3759, 9.7320, 'L'], ['Nürnberg', 49.4521, 11.0767, 'L'],
  ['Duisburg', 51.4344, 6.7623, 'M'], ['Bochum', 51.4818, 7.2162, 'M'], ['Wuppertal', 51.2562, 7.1508, 'M'],
  ['Bielefeld', 52.0302, 8.5325, 'M'], ['Bonn', 50.7374, 7.0982, 'M'], ['Münster', 51.9607, 7.6261, 'M'],
  ['Mannheim', 49.4875, 8.4660, 'M'], ['Karlsruhe', 49.0069, 8.4037, 'M'], ['Augsburg', 48.3705, 10.8978, 'M'],
  ['Wiesbaden', 50.0782, 8.2398, 'M'], ['Mönchengladbach', 51.1805, 6.4428, 'M'], ['Gelsenkirchen', 51.5177, 7.0857, 'M'],
  ['Aachen', 50.7753, 6.0839, 'M'], ['Braunschweig', 52.2689, 10.5268, 'M'], ['Kiel', 54.3233, 10.1228, 'M'],
  ['Chemnitz', 50.8278, 12.9214, 'M'], ['Halle (Saale)', 51.4969, 11.9688, 'M'], ['Magdeburg', 52.1205, 11.6276, 'M'],
  ['Freiburg im Breisgau', 47.9990, 7.8421, 'M'], ['Krefeld', 51.3388, 6.5853, 'M'], ['Mainz', 49.9929, 8.2473, 'M'],
  ['Lübeck', 53.8655, 10.6866, 'M'], ['Erfurt', 50.9848, 11.0299, 'M'], ['Rostock', 54.0924, 12.0991, 'M'],
  ['Kassel', 51.3127, 9.4797, 'M'], ['Hagen', 51.3671, 7.4633, 'M'], ['Potsdam', 52.3906, 13.0645, 'M'],
  ['Saarbrücken', 49.2402, 6.9969, 'M'], ['Oldenburg', 53.1435, 8.2146, 'M'], ['Osnabrück', 52.2799, 8.0472, 'M'],
  ['Heidelberg', 49.3988, 8.6724, 'M'], ['Darmstadt', 49.8728, 8.6512, 'M'], ['Regensburg', 49.0134, 12.1016, 'M'],
  ['Würzburg', 49.7913, 9.9534, 'M'], ['Ingolstadt', 48.7665, 11.4258, 'M'], ['Ulm', 48.4011, 9.9876, 'M'],
  ['Wolfsburg', 52.4227, 10.7865, 'M'], ['Heilbronn', 49.1427, 9.2109, 'M'], ['Pforzheim', 48.8922, 8.6946, 'M'],
  ['Göttingen', 51.5413, 9.9158, 'S'], ['Bremerhaven', 53.5396, 8.5809, 'S'], ['Jena', 50.9271, 11.5892, 'S'],
  ['Trier', 49.7490, 6.6371, 'S'], ['Koblenz', 50.3569, 7.5890, 'S'], ['Bamberg', 49.8988, 10.9028, 'S'],
  ['Schwerin', 53.6355, 11.4012, 'S'], ['Cottbus', 51.7563, 14.3329, 'S'], ['Flensburg', 54.7937, 9.4470, 'S'],
  ['Passau', 48.5665, 13.4312, 'S'], ['Konstanz', 47.6603, 9.1758, 'S'], ['Fulda', 50.5558, 9.6808, 'S'],
  ['Siegen', 50.8748, 8.0243, 'S'], ['Paderborn', 51.7189, 8.7575, 'S'], ['Gießen', 50.5841, 8.6784, 'S'],
  ['Zwickau', 50.7189, 12.4964, 'S'], ['Lüneburg', 53.2464, 10.4115, 'S'],
].map(([name, lat, lng, size]) => ({ name, center: [lat, lng], size, radiusKm: CITY_SIZES[size] }));

// =====================================================================
//  Sparten (Abteilungen). Qualifikationen sind je Sparte hierarchisch:
//  Stufe 3 deckt 2 und 1 ab. Schlüssel in Anforderungen: Sparte + Stufe, z. B. 'E2'.
// =====================================================================
const WAGES = { 1: 26, 2: 34, 3: 45 };
// Dämpfung der Vergütung je Stufe (Balancing)
const STAGE_PAY = { 1: 1, 2: 0.8, 3: 0.65 };
const payRange = T => T.pay.map(x => Math.round(x * STAGE_PAY[T.stage] / 10) * 10);

const SPARTEN = {
  E: {
    name: 'Elektro', icon: '⚡', color: '#f0a500', cost: 10000, startVehicle: 'TRANS',
    desc: 'Straßenbeleuchtung, Hausanschlüsse, Ortsnetz bis zur Trafostation.',
    quals: { 1: ['Elektromonteur', 'Elektromonteur'], 2: ['Elektrofachkraft', 'EFK'], 3: ['Schaltberechtigte Fachkraft', 'Schaltberecht.'] },
    trainings: {
      2: { name: 'Ausbildung Elektrofachkraft', needStage: 1, needCount: 8, hours: 8, cost: 1500 },
      3: { name: 'Lehrgang Schaltberechtigung', needStage: 2, needCount: 6, hours: 12, cost: 3500 },
    },
  },
  G: {
    name: 'Gas & Wasser', icon: '💧', color: '#3b9ae1', cost: 12000, startVehicle: 'TRANS',
    desc: 'Zähler, Hydranten, Rohrbrüche, Leckprüfung, Hauptleitungen.',
    quals: { 1: ['Anlagenmechaniker', 'Anlagenmech.'], 2: ['Rohrnetzmonteur', 'Rohrnetzmont.'], 3: ['Gasnetz-Fachkraft', 'Gas-Fachkraft'] },
    trainings: {
      2: { name: 'Weiterbildung Rohrnetzmonteur', needStage: 1, needCount: 8, hours: 8, cost: 1600 },
      3: { name: 'Sachkunde Gasnetz', needStage: 2, needCount: 6, hours: 12, cost: 3800 },
    },
  },
  A: {
    name: 'Abwasser', icon: '🌀', color: '#8d6e63', cost: 11000, startVehicle: 'SPUEL',
    desc: 'Verstopfungen, Kanalinspektion, Pumpwerke, Kanalsanierung.',
    quals: { 1: ['Kanalarbeiter', 'Kanalarbeiter'], 2: ['Kanaltechniker', 'Kanaltechn.'], 3: ['Fachkraft Kanalsanierung', 'Kanalsanierer'] },
    trainings: {
      2: { name: 'Weiterbildung Kanaltechniker', needStage: 1, needCount: 8, hours: 8, cost: 1500 },
      3: { name: 'Lehrgang Kanalsanierung', needStage: 2, needCount: 6, hours: 12, cost: 3500 },
    },
  },
  V: {
    name: 'Verkehrstechnik', icon: '🚦', color: '#e8590c', cost: 10000, startVehicle: 'VSA',
    desc: 'Absicherung, Verkehrszeichen, Ampeln und Steuergeräte.',
    quals: { 1: ['Verkehrssicherer', 'Verkehrssich.'], 2: ['Signaltechniker', 'Signaltechn.'], 3: ['Verkehrsrechner-Techniker', 'Verkehrsrechner'] },
    trainings: {
      2: { name: 'Weiterbildung Signaltechnik', needStage: 1, needCount: 8, hours: 8, cost: 1600 },
      3: { name: 'Lehrgang Verkehrsrechner', needStage: 2, needCount: 6, hours: 12, cost: 3600 },
    },
  },
  T: {
    name: 'Telekommunikation', icon: '📶', color: '#be4bdb', cost: 12000, startVehicle: 'TRANS',
    desc: 'Anschlüsse, Kabelverzweiger, Glasfaser, Funkmasten.',
    quals: { 1: ['Kabelmonteur', 'Kabelmonteur'], 2: ['Spleißtechniker', 'Spleißtechn.'], 3: ['Netztechniker (Höhenarbeit)', 'Netztechniker'] },
    trainings: {
      2: { name: 'Lehrgang Glasfaser-Spleißen', needStage: 1, needCount: 8, hours: 8, cost: 1800 },
      3: { name: 'Höhenarbeit & Netztechnik', needStage: 2, needCount: 6, hours: 12, cost: 4000 },
    },
  },
  K: {
    name: 'Kommunaldienst', icon: '🌳', color: '#2f9e44', cost: 9000, startVehicle: 'TRANS',
    desc: 'Grünpflege, Sturmschäden, Schlaglöcher, Winterdienst.',
    quals: { 1: ['Straßenwärter', 'Straßenwärter'], 2: ['Baumpfleger (Motorsägenschein)', 'Baumpfleger'], 3: ['Großgeräteführer', 'Großgeräteführ.'] },
    trainings: {
      2: { name: 'Motorsägenschein & Baumpflege', needStage: 1, needCount: 8, hours: 8, cost: 1200 },
      3: { name: 'Lehrgang Großgeräte & Kran', needStage: 2, needCount: 6, hours: 12, cost: 3200 },
    },
  },
};
const SPARTE_KEYS = Object.keys(SPARTEN);
const qualName = (sp, lvl) => SPARTEN[sp].quals[lvl][0];
const qualShort = (sp, lvl) => SPARTEN[sp].quals[lvl][1];
const parseKey = k => ({ sp: k[0], lvl: Number(k.slice(1)) });
const keyLabel = k => { const { sp, lvl } = parseKey(k); return qualName(sp, lvl); };
const keyShort = k => { const { sp, lvl } = parseKey(k); return SPARTEN[sp].icon + ' ' + qualShort(sp, lvl); };

// sparte: null = allgemein, immer kaufbar
const VEHICLE_TYPES = {
  TRANS:   { sparte: null, name: 'Monteurtransporter', short: 'Transporter', icon: '🚐', seats: 3, speed: 38, price: 18000, upkeep: 35 },
  HUB:     { sparte: null, name: 'Hubarbeitsbühne', short: 'Hubbühne', icon: '🪜', seats: 2, speed: 30, price: 32000, upkeep: 80 },
  BAGGER:  { sparte: null, name: 'Minibagger auf Tieflader', short: 'Minibagger', icon: '⛏️', seats: 2, speed: 28, price: 28000, upkeep: 60 },
  KRAN:    { sparte: null, name: 'Ladekran-Lkw', short: 'Ladekran', icon: '🏗️', seats: 2, speed: 30, price: 40000, upkeep: 85 },
  MESS:    { sparte: 'E', name: 'Kabelmesswagen', short: 'Messwagen', icon: '📡', seats: 2, speed: 38, price: 40000, upkeep: 95 },
  NEA:     { sparte: 'E', name: 'Netzersatzanlage (Notstrom-Lkw)', short: 'NEA', icon: '🔋', seats: 2, speed: 28, price: 30000, upkeep: 70 },
  ROHR:    { sparte: 'G', name: 'Rohrnetz-Servicewagen', short: 'Rohrnetzwagen', icon: '🛻', seats: 3, speed: 36, price: 24000, upkeep: 50 },
  SAUG:    { sparte: 'G', name: 'Saugbagger', short: 'Saugbagger', icon: '🚜', seats: 2, speed: 28, price: 45000, upkeep: 110 },
  TWA:     { sparte: 'G', name: 'Trinkwasserwagen', short: 'Trinkwasserw.', icon: '🚰', seats: 2, speed: 30, price: 22000, upkeep: 45 },
  SPUEL:   { sparte: 'A', name: 'Spül- und Saugwagen', short: 'Spülwagen', icon: '🚛', seats: 2, speed: 30, price: 38000, upkeep: 90 },
  KTV:     { sparte: 'A', name: 'Kanal-TV-Fahrzeug', short: 'Kanal-TV', icon: '📹', seats: 2, speed: 36, price: 42000, upkeep: 85 },
  PUMPE:   { sparte: 'A', name: 'Pumpen-Lkw', short: 'Pumpen-Lkw', icon: '💦', seats: 2, speed: 32, price: 30000, upkeep: 70 },
  VSA:     { sparte: 'V', name: 'Absicherungs-Lkw', short: 'Absicherung', icon: '🚧', seats: 2, speed: 34, price: 26000, upkeep: 55 },
  SIG:     { sparte: 'V', name: 'Signalbauwagen', short: 'Signalbau', icon: '🚦', seats: 2, speed: 38, price: 30000, upkeep: 60 },
  SPLEISS: { sparte: 'T', name: 'Spleißfahrzeug', short: 'Spleißwagen', icon: '🔬', seats: 2, speed: 38, price: 34000, upkeep: 70 },
  STREU:   { sparte: 'K', name: 'Streu- und Räumfahrzeug', short: 'Streuwagen', icon: '❄️', seats: 2, speed: 30, price: 32000, upkeep: 75 },
  HACK:    { sparte: 'K', name: 'Baumpflege-Lkw mit Häcksler', short: 'Baumpflege-Lkw', icon: '🪓', seats: 3, speed: 32, price: 36000, upkeep: 80 },
};

function P(name, min, max, search) { return { name, min, max, search: !!search }; }
const DOC = (m = 6) => P('Dokumentation', m, m);

// staff: { 'E2': Anzahl }  ·  vehicles: Liste von Fahrzeugtypen
const JOB_TYPES = {
  // ---------------- Elektro ----------------
  laterne: {
    name: 'Defekte Straßenlaterne', short: 'Laterne', stage: 1, weight: 6, pay: [280, 520], reaction: 120, completion: 360,
    ways: [{ name: 'Standard', staff: { E1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Fehlersuche', 12, 35, true), P('Instandsetzung', 20, 35), DOC(5)],
    twist: { p: 0.18, title: 'Vorschaltgerät verschmort', text: 'Nicht nur das Leuchtmittel ist hin – auch das Vorschaltgerät ist verschmort.', options: [
      { label: 'Vorschaltgerät mittauschen', extraMin: 35, payAdd: 0.25, info: '+35 min, Nachtrag +25 %' },
      { label: 'Nur Leuchtmittel tauschen, Mangel melden', extraMin: 0, payAdd: 0, rep: -2, info: 'kein Zeitverlust, Ruf −2' }] },
  },
  leuchte: {
    name: 'Leuchtenkopf nach Unfall beschädigt', short: 'Unfallleuchte', stage: 1, weight: 4, pay: [450, 750], reaction: 90, completion: 300,
    ways: [{ name: 'Standard', staff: { E1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung & Absicherung', 10, 15), P('Schadensaufnahme', 10, 25, true), P('Leuchtentausch', 30, 45), DOC(5)],
    twist: { p: 0.25, title: 'Mast verbogen', text: 'Der Mast hat beim Unfall einen Schlag abbekommen. Er steht schief, aber stabil.', options: [
      { label: 'Mast richten und sichern', extraMin: 40, payAdd: 0.3, info: '+40 min, Nachtrag +30 %' },
      { label: 'Nur Leuchte tauschen, Mast als Mangel melden', extraMin: 0, payAdd: 0, rep: -1, info: 'kein Zeitverlust, Ruf −1' }] },
  },
  strassenzug: {
    name: 'Straßenzug ohne Beleuchtung', short: 'Straßenzug', stage: 2, weight: 4, pay: [1300, 2100], reaction: 90, completion: 480,
    ways: [{ name: 'Standard', staff: { E2: 1, E1: 1 }, vehicles: ['HUB'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Fehlersuche', 25, 50, true), P('Instandsetzung', 40, 60), DOC(8)],
    twist: { p: 0.4, title: 'Erdschluss im Zuleitungskabel', text: 'Die Leuchten sind in Ordnung – der Fehler liegt im Kabel unter dem Gehweg. Wo genau, ist unbekannt.', options: [
      { label: 'Kabelmesswagen nachfordern', needVehicle: 'MESS', needStaff: { E1: 1 }, searchMin: [15, 25], payAdd: 0.4, info: 'Nachtrag +40 %, schnelle Ortung' },
      { label: 'Abschnittsweise prüfen', extraMin: 150, payAdd: 0.1, info: '+150 min, Nachtrag +10 %' }] },
  },
  hausanschluss: {
    name: 'Hausanschluss ohne Strom', short: 'Hausanschluss', stage: 2, weight: 4, pay: [900, 1500], reaction: 60, completion: 300,
    ways: [{ name: 'Standard', staff: { E2: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Fehlersuche', 15, 35, true), P('Instandsetzung', 25, 45), DOC(6)],
    twist: { p: 0.2, title: 'Hausanschlusskasten beschädigt', text: 'Neben der Sicherung ist auch der Hausanschlusskasten verschmort.', options: [
      { label: 'Kasten komplett tauschen', extraMin: 45, payAdd: 0.25, info: '+45 min, Nachtrag +25 %' },
      { label: 'Provisorisch instandsetzen', extraMin: 10, payAdd: 0, rep: -2, info: '+10 min, Ruf −2' }] },
  },
  kvs: {
    name: 'Kabelverteilerschrank angefahren', short: 'Verteilerschrank', stage: 2, weight: 3, pay: [1600, 2500], reaction: 60, completion: 420,
    ways: [{ name: 'Standard', staff: { E2: 1, E1: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Absicherung', 10, 15), P('Schadensaufnahme', 15, 30, true), P('Schrank tauschen & anklemmen', 60, 90), DOC(8)],
    twist: { p: 0.35, title: 'Schrank ragt in die Fahrbahn', text: 'Der umgefahrene Schrank liegt halb auf der Fahrbahn. Ohne Verkehrssicherung ist das Arbeiten gefährlich.', options: [
      { label: 'Verkehrssicherung nachfordern', needVehicle: 'VSA', needStaff: { V1: 1 }, searchMin: [10, 20], payAdd: 0.3, info: 'Nachtrag +30 % – braucht Abteilung Verkehrstechnik' },
      { label: 'Notdürftig selbst absichern', extraMin: 25, payAdd: 0, rep: -2, info: '+25 min, Ruf −2' }] },
  },
  trafo: {
    name: 'Störung Ortsnetz-Trafostation', short: 'Trafostation', stage: 3, weight: 3, pay: [3800, 5800], reaction: 60, completion: 360,
    ways: [
      { name: 'Reparatur', staff: { E3: 1, E2: 1 }, vehicles: ['TRANS'], factor: 1 },
      { name: 'Überbrückung mit Notstrom', staff: { E2: 1 }, vehicles: ['NEA'], factor: 0.6, followUp: 'trafo_instand', twist: null,
        phases: [P('Erkundung', 10, 15), P('NEA aufbauen & anschließen', 30, 45), P('Versorgung herstellen', 15, 20), DOC(6)] },
    ],
    phases: [P('Erkundung', 10, 15), P('Freischalten & Fehlersuche', 25, 45, true), P('Instandsetzung', 50, 80), P('Zuschalten & Doku', 10, 10)],
    twist: { p: 0.25, title: 'Brandschaden an der Niederspannungsverteilung', text: 'In der Station ist die Niederspannungsverteilung angeschmort.', options: [
      { label: 'Verteilung komplett instandsetzen', extraMin: 60, payAdd: 0.25, info: '+60 min, Nachtrag +25 %' },
      { label: 'Abgänge provisorisch versorgen', extraMin: 15, payAdd: 0, rep: -2, info: '+15 min, Ruf −2' }] },
  },
  trafo_instand: {
    name: 'Instandsetzung Trafostation (Folgeauftrag)', short: 'Trafo-Instandsetzung', stage: 3, weight: 0, pay: [2600, 3600], reaction: 240, completion: 720,
    ways: [{ name: 'Standard', staff: { E3: 1, E2: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Freischalten & Fehlersuche', 20, 35, true), P('Instandsetzung', 50, 80), P('Zuschalten & Doku', 10, 10)], twist: null,
  },
  kabel_ns: {
    name: 'Kabelfehler Niederspannung', short: 'Kabelfehler', stage: 3, weight: 3, pay: [3000, 4600], reaction: 90, completion: 600,
    ways: [
      { name: 'Ortung mit Messwagen', staff: { E2: 1 }, vehicles: ['MESS'], factor: 1 },
      { name: 'Suche durch Aufgraben', staff: { E2: 1, E1: 1 }, vehicles: ['BAGGER'], factor: 1, searchMul: 3.5 },
    ],
    phases: [P('Erkundung', 10, 15), P('Fehlerortung', 30, 50, true), P('Aufgraben & Muffe setzen', 60, 90), DOC(8)], twist: null,
  },

  // ---------------- Gas & Wasser ----------------
  g_zaehler: {
    name: 'Wasserzähler tauschen', short: 'Zählerwechsel', stage: 1, weight: 5, pay: [220, 420], reaction: 240, completion: 600,
    ways: [{ name: 'Standard', staff: { G1: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Termin & Zugang', 10, 20), P('Zähler tauschen', 20, 35), DOC(5)], twist: null,
  },
  g_hydrant: {
    name: 'Hydrant undicht', short: 'Hydrant', stage: 1, weight: 5, pay: [350, 600], reaction: 120, completion: 360,
    ways: [{ name: 'Standard', staff: { G1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Schieber schließen & prüfen', 15, 30, true), P('Dichtung tauschen', 25, 40), DOC(5)],
    twist: { p: 0.22, title: 'Absperrschieber festgerostet', text: 'Der Schieber vor dem Hydranten lässt sich kaum bewegen.', options: [
      { label: 'Schieber gangbar machen', extraMin: 40, payAdd: 0.25, info: '+40 min, Nachtrag +25 %' },
      { label: 'Nächsten Schieber nutzen (mehr Haushalte ohne Wasser)', extraMin: 10, payAdd: 0, rep: -2, info: '+10 min, Ruf −2' }] },
  },
  g_rohrbruch_haus: {
    name: 'Rohrbruch am Hausanschluss', short: 'Rohrbruch Haus', stage: 2, weight: 4, pay: [1200, 2000], reaction: 60, completion: 360,
    ways: [{ name: 'Standard', staff: { G2: 1, G1: 1 }, vehicles: ['ROHR'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Leck orten', 15, 35, true), P('Aufgraben & Reparaturschelle', 50, 75), DOC(6)], twist: null,
  },
  g_gasgeruch: {
    name: 'Gasgeruch gemeldet – Leckprüfung', short: 'Leckprüfung', stage: 2, weight: 3, pay: [900, 1600], reaction: 30, completion: 180,
    ways: [{ name: 'Standard', staff: { G2: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Messung vor Ort', 10, 20, true), P('Leitungsprüfung', 15, 30), DOC(5)],
    twist: { p: 0.3, title: 'Leck an der Hausanschlussleitung', text: 'Die Messung bestätigt ein kleines Leck an der Anschlussleitung vor dem Haus.', options: [
      { label: 'Leck sofort abdichten', extraMin: 60, payAdd: 0.5, info: '+60 min, Nachtrag +50 %' },
      { label: 'Leitung absperren, Reparatur später', extraMin: 10, payAdd: 0.1, rep: -2, info: '+10 min, Nachtrag +10 %, Ruf −2' }] },
  },
  g_hauptleitung: {
    name: 'Rohrbruch Hauptleitung', short: 'Hauptleitung', stage: 3, weight: 3, pay: [4000, 6500], reaction: 60, completion: 600,
    ways: [
      { name: 'Reparatur', staff: { G3: 1, G2: 1, G1: 1 }, vehicles: ['SAUG', 'ROHR'], factor: 1 },
      { name: 'Notversorgung mit Trinkwasserwagen', staff: { G1: 1 }, vehicles: ['TWA'], factor: 0.5, followUp: 'g_hauptleitung_rep', twist: null,
        phases: [P('Erkundung', 10, 15), P('Wasserwagen aufstellen', 20, 30), P('Ausgabe organisieren', 20, 30), DOC(6)] },
    ],
    phases: [P('Erkundung & Absperren', 15, 25), P('Leck orten', 20, 40, true), P('Freilegen & Rohr tauschen', 90, 140), P('Spülen & Doku', 15, 15)], twist: null,
  },
  g_hauptleitung_rep: {
    name: 'Instandsetzung Hauptleitung (Folgeauftrag)', short: 'Hauptleitung Rep.', stage: 3, weight: 0, pay: [2800, 4000], reaction: 240, completion: 900,
    ways: [{ name: 'Standard', staff: { G3: 1, G2: 1 }, vehicles: ['SAUG'], factor: 1 }],
    phases: [P('Absperren', 15, 20), P('Freilegen & Rohr tauschen', 90, 130), P('Spülen & Doku', 15, 15)], twist: null,
  },
  g_anbohrung: {
    name: 'Gasleitung unter Druck anbohren (geplant)', short: 'Anbohrung', stage: 3, weight: 2, pay: [3500, 5000], reaction: 480, completion: 960,
    ways: [{ name: 'Standard', staff: { G3: 2 }, vehicles: ['ROHR'], factor: 1 }],
    phases: [P('Baustelle einrichten', 20, 30), P('Anbohren & Setzen', 60, 90), P('Dichtheitsprüfung', 20, 30, true), DOC(8)], twist: null,
  },

  // ---------------- Abwasser ----------------
  a_ablauf: {
    name: 'Straßenablauf verstopft', short: 'Straßenablauf', stage: 1, weight: 6, pay: [250, 480], reaction: 180, completion: 480,
    ways: [{ name: 'Standard', staff: { A1: 2 }, vehicles: ['SPUEL'], factor: 1 }],
    phases: [P('Erkundung', 5, 10), P('Absaugen & Spülen', 20, 40, true), DOC(5)], twist: null,
  },
  a_rueckstau: {
    name: 'Rückstau im Hausanschluss', short: 'Rückstau', stage: 1, weight: 4, pay: [400, 700], reaction: 120, completion: 360,
    ways: [{ name: 'Standard', staff: { A1: 2 }, vehicles: ['SPUEL'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Spülen', 20, 40, true), P('Kontrolle', 10, 15), DOC(5)],
    twist: { p: 0.3, title: 'Wurzeleinwuchs im Rohr', text: 'Der Spülkopf bleibt hängen – vermutlich sind Wurzeln ins Rohr gewachsen.', options: [
      { label: 'Kanal-TV nachfordern und gezielt fräsen', needVehicle: 'KTV', needStaff: { A1: 1 }, searchMin: [20, 30], payAdd: 0.4, info: 'Nachtrag +40 %' },
      { label: 'Ohne Kamera fräsen', extraMin: 60, payAdd: 0.1, info: '+60 min, Nachtrag +10 %' }] },
  },
  a_hauptkanal: {
    name: 'Hauptkanal verstopft', short: 'Hauptkanal', stage: 2, weight: 4, pay: [1300, 2200], reaction: 90, completion: 480,
    ways: [{ name: 'Standard', staff: { A2: 1, A1: 1 }, vehicles: ['SPUEL'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Hochdruckspülen', 40, 70, true), P('Kontrolle', 15, 20), DOC(6)], twist: null,
  },
  a_inspektion: {
    name: 'Kanalinspektion nach Absackung', short: 'Inspektion', stage: 2, weight: 3, pay: [1500, 2400], reaction: 240, completion: 600,
    ways: [{ name: 'Standard', staff: { A2: 1 }, vehicles: ['KTV'], factor: 1 }],
    phases: [P('Schacht öffnen', 10, 15), P('Befahrung mit Kamera', 40, 70, true), P('Auswertung & Bericht', 20, 30)], twist: null,
  },
  a_pumpwerk: {
    name: 'Pumpwerk gestört', short: 'Pumpwerk', stage: 3, weight: 3, pay: [3500, 5500], reaction: 60, completion: 360,
    ways: [
      { name: 'Ersatzpumpe einsetzen & reparieren', staff: { A3: 1, A1: 1 }, vehicles: ['PUMPE'], factor: 1 },
      { name: 'Absaugen im Pendelbetrieb', staff: { A2: 1, A1: 1 }, vehicles: ['SPUEL'], factor: 0.6, searchMul: 2 },
    ],
    phases: [P('Erkundung', 10, 15), P('Fehlersuche Pumpe', 25, 45, true), P('Instandsetzung', 50, 80), DOC(8)], twist: null,
  },
  a_sanierung: {
    name: 'Kanalschaden sanieren (Inliner)', short: 'Inliner', stage: 3, weight: 2, pay: [4500, 7000], reaction: 600, completion: 1200,
    ways: [{ name: 'Standard', staff: { A3: 1, A2: 1, A1: 1 }, vehicles: ['KTV', 'SPUEL'], factor: 1 }],
    phases: [P('Reinigen', 30, 45), P('Befahrung & Vermessung', 30, 45, true), P('Inliner einziehen & aushärten', 120, 180), DOC(10)], twist: null,
  },

  // ---------------- Verkehrstechnik ----------------
  v_unfall: {
    name: 'Unfallstelle absichern', short: 'Absicherung', stage: 1, weight: 5, pay: [300, 550], reaction: 45, completion: 240,
    ways: [{ name: 'Standard', staff: { V1: 2 }, vehicles: ['VSA'], factor: 1 }],
    phases: [P('Absicherung aufbauen', 10, 15), P('Absichern bis Räumung', 30, 70, true), P('Abbau', 10, 15), DOC(4)], twist: null,
  },
  v_schild: {
    name: 'Verkehrszeichen umgefahren', short: 'Verkehrszeichen', stage: 1, weight: 5, pay: [220, 420], reaction: 240, completion: 600,
    ways: [{ name: 'Standard', staff: { V1: 1 }, vehicles: ['VSA'], factor: 1 }],
    phases: [P('Erkundung', 5, 10), P('Zeichen aufstellen', 15, 30, true), DOC(4)], twist: null,
  },
  v_baustelle: {
    name: 'Tagesbaustelle absichern', short: 'Tagesbaustelle', stage: 1, weight: 3, pay: [500, 800], reaction: 300, completion: 720,
    ways: [{ name: 'Standard', staff: { V1: 2 }, vehicles: ['VSA'], factor: 1 }],
    phases: [P('Absicherung aufbauen', 15, 25), P('Baustelle betreuen', 120, 200), P('Abbau', 15, 20), DOC(4)], twist: null,
  },
  v_signalgeber: {
    name: 'Ampel-Signalgeber dunkel', short: 'Signalgeber', stage: 2, weight: 4, pay: [900, 1500], reaction: 90, completion: 360,
    ways: [{ name: 'Standard', staff: { V2: 1 }, vehicles: ['SIG'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Fehlersuche', 15, 30, true), P('LED-Einsatz tauschen', 20, 30), DOC(5)], twist: null,
  },
  v_steuergeraet: {
    name: 'Ampelsteuergerät gestört', short: 'Steuergerät', stage: 3, weight: 3, pay: [3000, 4800], reaction: 60, completion: 360,
    ways: [
      { name: 'Reparatur', staff: { V3: 1, V1: 1 }, vehicles: ['SIG', 'VSA'], factor: 1 },
      { name: 'Kreuzung provisorisch absichern', staff: { V1: 2 }, vehicles: ['VSA'], factor: 0.5, followUp: 'v_steuergeraet_rep', twist: null,
        phases: [P('Absicherung aufbauen', 10, 15), P('Behelfsbeschilderung', 20, 30), DOC(5)] },
    ],
    phases: [P('Erkundung', 10, 15), P('Diagnose am Steuergerät', 25, 45, true), P('Baugruppe tauschen & parametrieren', 40, 70), DOC(8)],
    twist: { p: 0.25, title: 'Verkehrsrechner meldet Störung', text: 'Die Verbindung zum Verkehrsrechner ist gestört, die Grüne Welle läuft nicht.', options: [
      { label: 'Verbindung neu einrichten', extraMin: 45, payAdd: 0.25, info: '+45 min, Nachtrag +25 %' },
      { label: 'Im Inselbetrieb laufen lassen', extraMin: 0, payAdd: 0, rep: -2, info: 'kein Zeitverlust, Ruf −2' }] },
  },
  v_steuergeraet_rep: {
    name: 'Reparatur Ampelsteuergerät (Folgeauftrag)', short: 'Steuergerät Rep.', stage: 3, weight: 0, pay: [2200, 3200], reaction: 240, completion: 720,
    ways: [{ name: 'Standard', staff: { V3: 1 }, vehicles: ['SIG'], factor: 1 }],
    phases: [P('Diagnose', 20, 35, true), P('Baugruppe tauschen', 40, 60), DOC(6)], twist: null,
  },

  // ---------------- Telekommunikation ----------------
  t_anschluss: {
    name: 'Internetanschluss gestört', short: 'Anschluss', stage: 1, weight: 6, pay: [200, 400], reaction: 240, completion: 600,
    ways: [{ name: 'Standard', staff: { T1: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Messung', 10, 20, true), P('Dose/Leitung tauschen', 15, 30), DOC(4)], twist: null,
  },
  t_verzweiger: {
    name: 'Kabelverzweiger beschädigt', short: 'Verzweiger', stage: 1, weight: 4, pay: [450, 750], reaction: 120, completion: 480,
    ways: [{ name: 'Standard', staff: { T1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Schadensaufnahme', 15, 30, true), P('Gehäuse & Kupfer instandsetzen', 40, 60), DOC(5)],
    twist: { p: 0.3, title: 'Glasfaser im Verzweiger gebrochen', text: 'Im Gehäuse sind auch Glasfasern gebrochen. Die lassen sich nur spleißen.', options: [
      { label: 'Spleißtechnik nachfordern', needVehicle: 'SPLEISS', needStaff: { T2: 1 }, searchMin: [25, 40], payAdd: 0.5, info: 'Nachtrag +50 % – braucht Spleißtechniker' },
      { label: 'Nur Kupfer instandsetzen, Glasfaser melden', extraMin: 0, payAdd: 0, rep: -2, info: 'Ruf −2' }] },
  },
  t_glasfaser: {
    name: 'Glasfaserkabel durchtrennt', short: 'Glasfaser', stage: 2, weight: 4, pay: [1600, 2600], reaction: 90, completion: 480,
    ways: [{ name: 'Standard', staff: { T2: 1, T1: 1 }, vehicles: ['SPLEISS'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Bruchstelle messen', 15, 30, true), P('Spleißen', 60, 90), DOC(6)], twist: null,
  },
  t_hauptstrecke: {
    name: 'Störung Glasfaser-Hauptstrecke', short: 'Hauptstrecke', stage: 3, weight: 3, pay: [4500, 7000], reaction: 60, completion: 480,
    ways: [{ name: 'Standard', staff: { T3: 1, T2: 1 }, vehicles: ['SPLEISS', 'TRANS'], factor: 1 }],
    phases: [P('OTDR-Messung', 20, 35, true), P('Muffe öffnen', 20, 30), P('Spleißen (144 Fasern)', 120, 160), DOC(10)], twist: null,
  },
  t_funkmast: {
    name: 'Funkmast ausgefallen', short: 'Funkmast', stage: 3, weight: 3, pay: [3500, 5500], reaction: 120, completion: 480,
    ways: [{ name: 'Standard', staff: { T3: 2 }, vehicles: ['HUB'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Aufstieg & Diagnose', 30, 50, true), P('Antenne/Funkmodul tauschen', 50, 80), DOC(8)], twist: null,
  },

  // ---------------- Kommunaldienst ----------------
  k_ast: {
    name: 'Abgebrochener Ast auf Gehweg', short: 'Ast', stage: 1, weight: 5, pay: [200, 380], reaction: 180, completion: 480,
    ways: [{ name: 'Standard', staff: { K1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 5, 10), P('Zerkleinern & Abtransport', 20, 40, true), DOC(4)], twist: null,
  },
  k_schlagloch: {
    name: 'Schlagloch provisorisch schließen', short: 'Schlagloch', stage: 1, weight: 5, pay: [260, 480], reaction: 240, completion: 720,
    ways: [{ name: 'Standard', staff: { K1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Absichern', 5, 10), P('Kaltasphalt einbauen', 20, 35, true), DOC(4)], twist: null,
  },
  k_glaette: {
    name: 'Glättestelle streuen', short: 'Glätte', stage: 1, weight: 3, pay: [300, 500], reaction: 60, completion: 240,
    ways: [{ name: 'Standard', staff: { K1: 1 }, vehicles: ['STREU'], factor: 1 }],
    phases: [P('Streuen', 15, 30, true), DOC(3)], twist: null,
  },
  k_sturmbaum: {
    name: 'Sturmbaum auf Fahrbahn', short: 'Sturmbaum', stage: 2, weight: 4, pay: [1200, 2000], reaction: 60, completion: 300,
    ways: [{ name: 'Standard', staff: { K2: 1, K1: 1 }, vehicles: ['HACK'], factor: 1 }],
    phases: [P('Erkundung & Absicherung', 10, 15), P('Baum zerlegen', 30, 60, true), P('Häckseln & räumen', 30, 45), DOC(5)],
    twist: { p: 0.3, title: 'Baum hängt in einer Stromleitung', text: 'Die Krone hat sich in einer Freileitung verfangen. Arbeiten erst, wenn die Leitung freigeschaltet ist.', options: [
      { label: 'Elektrofachkraft zum Freischalten nachfordern', needVehicle: 'TRANS', needStaff: { E2: 1 }, searchMin: [20, 30], payAdd: 0.4, info: 'Nachtrag +40 % – braucht Abteilung Elektro' },
      { label: 'Auf den Netzbetreiber warten', extraMin: 120, payAdd: 0, info: '+120 min' }] },
  },
  k_winter: {
    name: 'Winterdienst auf Hauptroute', short: 'Winterdienst', stage: 2, weight: 3, pay: [900, 1400], reaction: 60, completion: 360,
    ways: [{ name: 'Standard', staff: { K1: 2 }, vehicles: ['STREU'], factor: 1 }],
    phases: [P('Räumen & Streuen', 90, 140, true), DOC(5)], twist: null,
  },
  k_gefahrbaum: {
    name: 'Gefahrbaum fällen', short: 'Gefahrbaum', stage: 3, weight: 3, pay: [3200, 5000], reaction: 240, completion: 720,
    ways: [{ name: 'Standard', staff: { K3: 1, K2: 1 }, vehicles: ['KRAN', 'HACK'], factor: 1 }],
    phases: [P('Absperren', 15, 20), P('Seilklettern & Abtragen', 60, 90, true), P('Stamm mit Kran heben', 40, 60), DOC(6)], twist: null,
  },

  // ---------------- Spartenübergreifend ----------------
  x_ampel: {
    name: 'Ampelanlage ausgefallen – keine Spannung', short: 'Ampelanlage', stage: 2, weight: 3, pay: [2200, 3400], reaction: 60, completion: 360,
    desc: 'Die Ampel ist komplett dunkel. Signaltechnik und Stromversorgung müssen gemeinsam geprüft werden.',
    ways: [{ name: 'Standard', staff: { V2: 1, E2: 1 }, vehicles: ['SIG'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Einspeisung & Steuerung prüfen', 20, 40, true), P('Instandsetzung', 40, 60), DOC(6)],
    twist: { p: 0.3, title: 'Kreuzung ohne Regelung', text: 'Der Verkehr staut sich, es kommt zu gefährlichen Situationen. Eine Absicherung wäre sinnvoll.', options: [
      { label: 'Absicherungs-Lkw nachfordern', needVehicle: 'VSA', needStaff: { V1: 1 }, searchMin: [20, 35], payAdd: 0.3, info: 'Nachtrag +30 %' },
      { label: 'Ohne Absicherung weiterarbeiten', extraMin: 20, payAdd: 0, rep: -3, info: '+20 min, Ruf −3' }] },
  },
  x_rohrbruch_kreuzung: {
    name: 'Wasserrohrbruch unter Kreuzung', short: 'Rohrbruch Kreuzung', stage: 2, weight: 3, pay: [2600, 3800], reaction: 60, completion: 480,
    ways: [{ name: 'Standard', staff: { G2: 1, G1: 1, V1: 1 }, vehicles: ['ROHR', 'VSA'], factor: 1 }],
    phases: [P('Absichern & Absperren', 15, 20), P('Leck orten', 20, 35, true), P('Aufgraben & reparieren', 70, 110), DOC(6)], twist: null,
  },
  x_unterfuehrung: {
    name: 'Überflutete Unterführung', short: 'Unterführung', stage: 2, weight: 3, pay: [2000, 3200], reaction: 45, completion: 300,
    ways: [{ name: 'Standard', staff: { A1: 2, V1: 1 }, vehicles: ['PUMPE', 'VSA'], factor: 1 }],
    phases: [P('Sperren', 10, 15), P('Abpumpen', 40, 80, true), P('Abläufe freispülen', 20, 30), DOC(5)], twist: null,
  },
  x_pumpwerk_strom: {
    name: 'Pumpwerk ohne Strom', short: 'Pumpwerk Strom', stage: 3, weight: 2, pay: [4500, 6500], reaction: 60, completion: 360,
    ways: [{ name: 'Standard', staff: { A2: 1, E2: 1 }, vehicles: ['PUMPE', 'NEA'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Notstrom & Ersatzpumpe', 30, 45, true), P('Einspeisung instandsetzen', 50, 80), DOC(8)], twist: null,
  },
  x_baum_leitung: {
    name: 'Sturmbaum in Freileitung', short: 'Baum in Leitung', stage: 3, weight: 2, pay: [4000, 6000], reaction: 60, completion: 360,
    ways: [{ name: 'Standard', staff: { K2: 1, E3: 1 }, vehicles: ['HACK'], factor: 1 }],
    phases: [P('Leitung freischalten', 15, 25), P('Baum abtragen', 40, 70, true), P('Leitung instandsetzen & zuschalten', 40, 60), DOC(6)], twist: null,
  },
  x_baggerschaden: {
    name: 'Baggerschaden an Strom- und Glasfaserkabel', short: 'Baggerschaden', stage: 3, weight: 2, pay: [5000, 8000], reaction: 60, completion: 600,
    ways: [{ name: 'Standard', staff: { E2: 1, T2: 1, V1: 1 }, vehicles: ['TRANS', 'SPLEISS', 'VSA'], factor: 1 }],
    phases: [P('Absichern & freischalten', 15, 25), P('Schaden aufnehmen', 20, 35, true), P('Muffen setzen & spleißen', 90, 140), DOC(10)], twist: null,
  },
};
// Beteiligte Sparten je Auftragsart ableiten
for (const id in JOB_TYPES) {
  const T = JOB_TYPES[id];
  T.sparten = [...new Set(T.ways.flatMap(w => Object.keys(w.staff).map(k => k[0])))].sort((a, b) => SPARTE_KEYS.indexOf(a) - SPARTE_KEYS.indexOf(b));
}

const CONTRACTS = {
  rv_licht: { name: 'Rahmenvertrag Straßenbeleuchtung', client: 'Stadtwerke', sparte: 'E',
    desc: 'Entstörung der Straßenbeleuchtung im ganzen Stadtgebiet.', daily: 400, payFactor: 1.1, interval: [70, 140], sla: 0.8,
    jobTypes: ['laterne', 'leuchte', 'strassenzug'], reqs: { refs: { E1: 8 }, rep: 52, staff: { E1: 2 }, vehicles: [] } },
  rv_netz: { name: 'Rahmenvertrag Ortsnetz-Entstörung', client: 'Ortsnetz GmbH', sparte: 'E',
    desc: 'Störungen im Ortsnetz – bis hin zu Trafostationen.', daily: 1200, payFactor: 1.15, interval: [90, 180], sla: 0.85,
    jobTypes: ['hausanschluss', 'kvs', 'trafo', 'kabel_ns'], reqs: { refs: { E2: 10 }, rep: 60, staff: { E3: 2 }, vehicles: [] } },
  rv_wasser: { name: 'Rahmenvertrag Wassernetz', client: 'Wasserverband', sparte: 'G',
    desc: 'Zähler, Hydranten und Rohrbrüche im Trinkwassernetz.', daily: 450, payFactor: 1.1, interval: [80, 150], sla: 0.8,
    jobTypes: ['g_zaehler', 'g_hydrant', 'g_rohrbruch_haus', 'g_hauptleitung'], reqs: { refs: { G1: 8 }, rep: 52, staff: { G1: 2 }, vehicles: [] } },
  rv_kanal: { name: 'Rahmenvertrag Kanalbetrieb', client: 'Stadtentwässerung', sparte: 'A',
    desc: 'Reinigung und Störungsbeseitigung im Kanalnetz.', daily: 450, payFactor: 1.1, interval: [80, 150], sla: 0.8,
    jobTypes: ['a_ablauf', 'a_rueckstau', 'a_hauptkanal', 'a_pumpwerk'], reqs: { refs: { A1: 8 }, rep: 52, staff: { A1: 2 }, vehicles: [] } },
  rv_verkehr: { name: 'Rahmenvertrag Verkehrssicherung', client: 'Straßenverkehrsamt', sparte: 'V',
    desc: 'Absicherung, Beschilderung und Ampelstörungen.', daily: 450, payFactor: 1.1, interval: [70, 140], sla: 0.85,
    jobTypes: ['v_unfall', 'v_schild', 'v_signalgeber', 'v_steuergeraet'], reqs: { refs: { V1: 8 }, rep: 52, staff: { V1: 2 }, vehicles: [] } },
  rv_glasfaser: { name: 'Rahmenvertrag Glasfaser-Service', client: 'Glasfaser-Netzbetreiber', sparte: 'T',
    desc: 'Entstörung von Anschlüssen und Glasfaserstrecken.', daily: 500, payFactor: 1.1, interval: [80, 160], sla: 0.8,
    jobTypes: ['t_anschluss', 't_verzweiger', 't_glasfaser', 't_hauptstrecke'], reqs: { refs: { T1: 8 }, rep: 52, staff: { T1: 2 }, vehicles: [] } },
  rv_bauhof: { name: 'Rahmenvertrag Straßenunterhalt', client: 'Bauhof der Stadt', sparte: 'K',
    desc: 'Grünschnitt, Schlaglöcher, Sturmschäden und Winterdienst.', daily: 350, payFactor: 1.1, interval: [80, 150], sla: 0.8,
    jobTypes: ['k_ast', 'k_schlagloch', 'k_glaette', 'k_sturmbaum', 'k_winter'], reqs: { refs: { K1: 8 }, rep: 52, staff: { K1: 2 }, vehicles: [] } },
  rv_infra: { name: 'Rahmenvertrag Infrastruktur-Störungen', client: 'Stadtverwaltung', sparte: null,
    desc: 'Komplexe Störungen, bei denen mehrere Sparten zusammenarbeiten müssen.', daily: 1500, payFactor: 1.2, interval: [100, 200], sla: 0.85,
    jobTypes: ['x_ampel', 'x_rohrbruch_kreuzung', 'x_unterfuehrung', 'x_pumpwerk_strom', 'x_baum_leitung', 'x_baggerschaden'],
    reqs: { refs: { E2: 5, V2: 3 }, rep: 60, staff: { E2: 1, V2: 1, G2: 1 }, vehicles: [] } },
};

const STREETS = ['Lindenallee', 'Bahnhofstraße', 'Am Mühlengraben', 'Birkenweg', 'Schillerstraße', 'Goethestraße',
  'Gartenweg', 'Kastanienallee', 'Am Sportplatz', 'Feldstraße', 'Ahornweg', 'Bergstraße', 'Kirchplatz',
  'Rosenstraße', 'Mozartweg', 'Industriestraße', 'Hauptstraße', 'Wiesenweg', 'Am Stadtpark', 'Buchenring',
  'Lessingstraße', 'Eichendorffweg', 'Brunnenstraße', 'Am Wall', 'Talstraße', 'Ulmenweg', 'Schulstraße',
  'Hirtenweg', 'Marktstraße', 'Am Steinbruch', 'Weidenweg', 'Gewerbering', 'Dorfstraße', 'Tannenweg'];

const FIRST_NAMES = ['Anna', 'Ben', 'Carla', 'David', 'Emre', 'Fiona', 'Georg', 'Hanna', 'Ilias', 'Jana', 'Kai', 'Lea',
  'Marek', 'Nina', 'Ole', 'Paula', 'Rafael', 'Sara', 'Tom', 'Ute', 'Vincent', 'Wiebke', 'Yusuf', 'Zoe', 'Jonas', 'Mira'];
const LAST_NAMES = ['Becker', 'Schulte', 'Yılmaz', 'Wagner', 'Nowak', 'Krüger', 'Hoffmann', 'Brandt', 'Kowalski',
  'Neumann', 'Lange', 'Peters', 'Arslan', 'Franke', 'Vogel', 'Hartmann', 'Engel', 'Lorenz', 'Simon', 'Böhm'];
