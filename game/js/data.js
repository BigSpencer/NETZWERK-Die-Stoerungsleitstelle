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

// Qualifikationen sind hierarchisch: höhere Stufe deckt niedrigere ab.
const QUALS = {
  1: { key: 'MON', name: 'Monteur', short: 'Monteur', wage: 22 },
  2: { key: 'EFK', name: 'Elektrofachkraft', short: 'EFK', wage: 30 },
  3: { key: 'SCH', name: 'Schaltberechtigte Fachkraft', short: 'Schaltberecht.', wage: 40 },
};

// Weiterbildung auf Stufe X (Schlüssel = Zielstufe)
const TRAININGS = {
  2: { name: 'Ausbildung Elektrofachkraft', needStage: 1, needCount: 8, hours: 8, cost: 1500 },
  3: { name: 'Lehrgang Schaltberechtigung', needStage: 2, needCount: 6, hours: 12, cost: 3500 },
};

const VEHICLE_TYPES = {
  TRANS: { name: 'Monteurtransporter', short: 'Transporter', icon: '🚐', seats: 3, speed: 38, price: 18000, upkeep: 35 },
  HUB:   { name: 'Hubarbeitsbühne', short: 'Hubbühne', icon: '🏗️', seats: 2, speed: 30, price: 32000, upkeep: 80 },
  MESS:  { name: 'Kabelmesswagen', short: 'Messwagen', icon: '📡', seats: 2, speed: 38, price: 40000, upkeep: 95 },
  NEA:   { name: 'Netzersatzanlage (Notstrom-Lkw)', short: 'NEA', icon: '🔋', seats: 2, speed: 28, price: 30000, upkeep: 70 },
};

function P(name, min, max, search) { return { name, min, max, search: !!search }; }

// staff: { Mindeststufe: Anzahl }  ·  vehicles: Liste von Fahrzeugtypen
const JOB_TYPES = {
  laterne: {
    name: 'Defekte Straßenlaterne', short: 'Laterne', stage: 1, weight: 6,
    pay: [280, 520], reaction: 120, completion: 360,
    ways: [{ name: 'Standard', staff: { 1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Fehlersuche', 12, 35, true), P('Instandsetzung', 20, 35), P('Dokumentation', 5, 5)],
    twist: {
      p: 0.18, title: 'Vorschaltgerät verschmort',
      text: 'Nicht nur das Leuchtmittel ist hin – auch das Vorschaltgerät ist verschmort.',
      options: [
        { label: 'Vorschaltgerät mittauschen', extraMin: 35, payAdd: 0.25, info: '+35 min, Nachtrag +25 %' },
        { label: 'Nur Leuchtmittel tauschen, Mangel melden', extraMin: 0, payAdd: 0, rep: -2, info: 'kein Zeitverlust, Ruf −2' },
      ],
    },
  },
  leuchte: {
    name: 'Leuchtenkopf nach Unfall beschädigt', short: 'Unfallleuchte', stage: 1, weight: 4,
    pay: [450, 750], reaction: 90, completion: 300,
    ways: [{ name: 'Standard', staff: { 1: 2 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung & Absicherung', 10, 15), P('Schadensaufnahme', 10, 25, true), P('Leuchtentausch', 30, 45), P('Dokumentation', 5, 5)],
    twist: {
      p: 0.25, title: 'Mast verbogen',
      text: 'Der Mast hat beim Unfall einen Schlag abbekommen. Er steht schief, aber stabil.',
      options: [
        { label: 'Mast richten und sichern', extraMin: 40, payAdd: 0.3, info: '+40 min, Nachtrag +30 %' },
        { label: 'Nur Leuchte tauschen, Mast als Mangel melden', extraMin: 0, payAdd: 0, rep: -1, info: 'kein Zeitverlust, Ruf −1' },
      ],
    },
  },
  strassenzug: {
    name: 'Straßenzug ohne Beleuchtung', short: 'Straßenzug', stage: 2, weight: 4,
    pay: [1300, 2100], reaction: 90, completion: 480,
    ways: [{ name: 'Standard', staff: { 2: 1, 1: 1 }, vehicles: ['HUB'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Fehlersuche', 25, 50, true), P('Instandsetzung', 40, 60), P('Dokumentation', 8, 8)],
    twist: {
      p: 0.4, title: 'Erdschluss im Zuleitungskabel',
      text: 'Die Leuchten sind in Ordnung – der Fehler liegt im Kabel unter dem Gehweg. Wo genau, ist unbekannt.',
      options: [
        { label: 'Kabelmesswagen nachfordern', needVehicle: 'MESS', needStaff: { 1: 1 }, searchMin: [15, 25], payAdd: 0.4, info: 'Nachtrag +40 %, schnelle Ortung' },
        { label: 'Abschnittsweise prüfen', extraMin: 150, payAdd: 0.1, info: '+150 min, Nachtrag +10 %' },
      ],
    },
  },
  hausanschluss: {
    name: 'Hausanschluss ohne Strom', short: 'Hausanschluss', stage: 2, weight: 4,
    pay: [900, 1500], reaction: 60, completion: 300,
    ways: [{ name: 'Standard', staff: { 2: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 8, 12), P('Fehlersuche', 15, 35, true), P('Instandsetzung', 25, 45), P('Dokumentation', 6, 6)],
    twist: {
      p: 0.2, title: 'Hausanschlusskasten beschädigt',
      text: 'Neben der Sicherung ist auch der Hausanschlusskasten verschmort.',
      options: [
        { label: 'Kasten komplett tauschen', extraMin: 45, payAdd: 0.25, info: '+45 min, Nachtrag +25 %' },
        { label: 'Provisorisch instandsetzen', extraMin: 10, payAdd: 0, rep: -2, info: '+10 min, Ruf −2' },
      ],
    },
  },
  kvs: {
    name: 'Kabelverteilerschrank angefahren', short: 'Verteilerschrank', stage: 2, weight: 3,
    pay: [1600, 2500], reaction: 60, completion: 420,
    ways: [{ name: 'Standard', staff: { 2: 1, 1: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Absicherung', 10, 15), P('Schadensaufnahme', 15, 30, true), P('Schrank tauschen & anklemmen', 60, 90), P('Dokumentation', 8, 8)],
    twist: null,
  },
  trafo: {
    name: 'Störung Ortsnetz-Trafostation', short: 'Trafostation', stage: 3, weight: 3,
    pay: [3800, 5800], reaction: 60, completion: 360,
    ways: [
      { name: 'Reparatur', staff: { 3: 1, 2: 1 }, vehicles: ['TRANS'], factor: 1 },
      {
        name: 'Überbrückung mit Notstrom', staff: { 2: 1 }, vehicles: ['NEA'], factor: 0.6, followUp: 'trafo_instand',
        phases: [P('Erkundung', 10, 15), P('NEA aufbauen & anschließen', 30, 45), P('Versorgung herstellen', 15, 20), P('Dokumentation', 6, 6)],
        twist: null,
      },
    ],
    phases: [P('Erkundung', 10, 15), P('Freischalten & Fehlersuche', 25, 45, true), P('Instandsetzung', 50, 80), P('Zuschalten & Doku', 10, 10)],
    twist: {
      p: 0.25, title: 'Brandschaden an der Niederspannungsverteilung',
      text: 'In der Station ist die Niederspannungsverteilung angeschmort.',
      options: [
        { label: 'Verteilung komplett instandsetzen', extraMin: 60, payAdd: 0.25, info: '+60 min, Nachtrag +25 %' },
        { label: 'Abgänge provisorisch versorgen', extraMin: 15, payAdd: 0, rep: -2, info: '+15 min, Ruf −2' },
      ],
    },
  },
  trafo_instand: {
    name: 'Instandsetzung Trafostation (Folgeauftrag)', short: 'Trafo-Instandsetzung', stage: 3, weight: 0,
    pay: [2600, 3600], reaction: 240, completion: 720,
    ways: [{ name: 'Standard', staff: { 3: 1, 2: 1 }, vehicles: ['TRANS'], factor: 1 }],
    phases: [P('Erkundung', 10, 15), P('Freischalten & Fehlersuche', 20, 35, true), P('Instandsetzung', 50, 80), P('Zuschalten & Doku', 10, 10)],
    twist: null,
  },
  kabel_ns: {
    name: 'Kabelfehler Niederspannung', short: 'Kabelfehler', stage: 3, weight: 3,
    pay: [3000, 4600], reaction: 90, completion: 600,
    ways: [
      { name: 'Ortung mit Messwagen', staff: { 2: 1 }, vehicles: ['MESS'], factor: 1 },
      { name: 'Suche durch Aufgraben', staff: { 2: 1, 1: 2 }, vehicles: ['TRANS'], factor: 1, searchMul: 3.5 },
    ],
    phases: [P('Erkundung', 10, 15), P('Fehlerortung', 30, 50, true), P('Aufgraben & Muffe setzen', 60, 90), P('Dokumentation', 8, 8)],
    twist: null,
  },
};

const CONTRACTS = {
  rv_licht: {
    name: 'Rahmenvertrag Straßenbeleuchtung', client: 'Stadtwerke',
    desc: 'Die Stadtwerke übertragen dir die Entstörung der Straßenbeleuchtung. Aufträge kommen direkt und müssen erledigt werden.',
    daily: 400, payFactor: 1.1, interval: [70, 140], sla: 0.8,
    jobTypes: ['laterne', 'leuchte', 'strassenzug'],
    reqs: { refs: { 1: 8 }, rep: 52, staff: { 1: 2 }, vehicles: [] },
  },
  rv_netz: {
    name: 'Rahmenvertrag Ortsnetz-Entstörung', client: 'Ortsnetz GmbH',
    desc: 'Der Netzbetreiber beauftragt dich mit Störungen im Ortsnetz – bis hin zu Trafostationen.',
    daily: 1200, payFactor: 1.15, interval: [90, 180], sla: 0.85,
    jobTypes: ['hausanschluss', 'kvs', 'trafo', 'kabel_ns'],
    reqs: { refs: { 2: 10 }, rep: 60, staff: { 3: 2 }, vehicles: [] },
  },
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
