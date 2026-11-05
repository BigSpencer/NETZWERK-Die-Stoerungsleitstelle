# NETZWERK – spielbarer Prototyp (v0.1)

Erste spielbare Version des [Spielkonzepts](../docs/spielkonzept.md), umgesetzt als MVP aus Kapitel 15.

## Starten

Kein Build nötig. Entweder:

- `game/index.html` direkt im Browser öffnen, **oder**
- einen lokalen Webserver starten (empfohlen):
  ```bash
  cd game && python3 -m http.server 8000
  # dann http://localhost:8000 öffnen
  ```

Für die Kartenkacheln (OpenStreetMap) wird eine Internetverbindung gebraucht. Ohne Verbindung läuft das Spiel trotzdem, nur ohne Kartenhintergrund. Der Spielstand wird automatisch im Browser gespeichert (`localStorage`).

## Was ist drin

| Bereich | Umfang |
|---|---|
| Sparte | Elektro, Stadtgebiet Göttingen |
| Auftragsstufen | Stufe 1–3: Straßenlaterne, Unfallleuchte, Straßenzug, Hausanschluss, Kabelverteilerschrank, Trafostation, Kabelfehler, Folgeauftrag Trafo-Instandsetzung |
| Zwei Wege | Trafostation: **Schaltberechtigung** (volle Vergütung) **oder** **Notstrom-Lkw** (60 %, Folgeauftrag geht evtl. an die Konkurrenz). Kabelfehler: **Messwagen** oder langsames **Aufgraben** |
| Personal | Monteur → Elektrofachkraft → Schaltberechtigte Fachkraft. Weiterbildung setzt Praxis voraus, Person fällt während der Schulung aus. Bewerbermarkt, Löhne pro Stunde |
| Fuhrpark | Transporter, Hubarbeitsbühne, Kabelmesswagen, Netzersatzanlage (Kauf/Verkauf, Unterhalt) |
| Aufträge | Phasen, zufällige Wendungen mit Entscheidungen (Nachtrag, Nachforderung, Abkürzung), Reaktions- und Erledigungsfrist, Bonus, Vertragsstrafe, Zahlungsziel |
| Befähigung | Gesperrte Aufträge sind sichtbar und zeigen, was fehlt. Eigener Reiter „Befähigung“ mit allen Auftragsarten |
| Rahmenverträge | Straßenbeleuchtung (ab 8 Referenzen Stufe 1) und Ortsnetz-Entstörung (ab 10 Referenzen Stufe 2 + 2 Schaltberechtigte). SLA-Überwachung, Abmahnung, Kündigung |
| Disposition | Dialog mit automatischem Vorschlag, ETA, Prüfung der Anforderungen. Fahrzeuge auf der Rückfahrt können direkt neu eingesetzt werden. Zeitleiste (Gantt) pro Fahrzeug mit Fristmarkern |
| Zeit | Pause, 1× / 3× / 10× / 30× (1× = 1 Sekunde pro Spielminute), Berufsverkehr verlängert Fahrzeiten |

## Bedienung

- **Leertaste**: Pause
- Auftragsname anklicken → Karte springt hin. Marker auf der Karte anklicken → Auftrag in der Liste
- Kartenmarker: gestrichelt = Angebot, grau = noch nicht befähigt, orange = angenommen, farbig = im Einsatz, rot = Entscheidung nötig

## Code-Struktur

| Datei | Inhalt |
|---|---|
| `js/data.js` | Alle Spieldaten und Balancing-Werte (Aufträge, Fahrzeuge, Qualifikationen, Verträge) |
| `js/game.js` | Simulation und Spiellogik (1 Schritt = 1 Spielminute) |
| `js/map.js` | Kartenansicht (Leaflet) |
| `js/ui.js` | Oberfläche, Dialoge, Zeitleiste |
| `js/main.js` | Start und Hauptschleife |
| `vendor/leaflet` | Leaflet 1.9.4 (BSD-2-Clause), lokal eingebunden |

Neue Auftragsarten lassen sich allein über `JOB_TYPES` in `data.js` ergänzen.

## Bekannte Grenzen des Prototyps

- Fahrzeuge fahren Luftlinie (mit Umwegfaktor), kein echtes Straßenrouting
- Noch keine Schichten, Erschöpfung, Material/Lager, Wetter, Ausschreibungen oder Mehrspieler
- Balancing ist ein erster Wurf
