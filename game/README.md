# NETZWERK – spielbarer Prototyp (v0.1)

Erste spielbare Version des [Spielkonzepts](../docs/spielkonzept.md), umgesetzt als MVP aus Kapitel 15.

## Starten

Kein Build nötig. Entweder:

- **Am einfachsten:** Auf GitHub oben auf den grünen Knopf **Code → Download ZIP** klicken, die ZIP-Datei entpacken und im Ordner `game` die Datei `index.html` doppelklicken. Das Spiel öffnet sich im Browser. **Oder:**
- einen lokalen Webserver starten (empfohlen):
  ```bash
  cd game && python3 -m http.server 8000
  # dann http://localhost:8000 öffnen
  ```

Beim ersten Start wählst du auf der Karte oder aus einer Liste mit rund 70 deutschen Städten, wo dein Betrieb sitzt, und setzt per Klick deinen Betriebshof. Die Kartenbilder kommen direkt von OpenStreetMap und brauchen eine Internetverbindung. OpenStreetMap liefert sie nur an Seiten aus, die über eine Webadresse laufen (lokaler Webserver oder GitHub Pages); beim Öffnen per Doppelklick bleibt die Karte womöglich leer. Ohne Verbindung, und in der Vorschau auf claude.ai, läuft das Spiel trotzdem, nur ohne Straßenkarte im Hintergrund. Der Spielstand wird automatisch im Browser gespeichert (`localStorage`).

## Was ist drin

| Bereich | Umfang |
|---|---|
| Standort | Freie Wahl: ca. 70 Städte (Einsatzradius nach Stadtgröße) oder ein eigenes Gebiet per Klick, Betriebshof frei platzierbar |
| Straßennetz | Das Spiel startet sofort: Routen und Auftragsorte kommen anfangs vom öffentlichen OSRM-Routing-Server. Parallel wird das Straßennetz im Hintergrund von OpenStreetMap (Overpass-API) geladen, danach rechnet das Spiel lokal und speichert das Netz im Browser. Die Anzeige oben rechts zeigt, welche Quelle gerade aktiv ist. Fahrzeuge fahren echte Routen (A*, Einbahnstraßen, Tempo je Straßenklasse), Aufträge liegen an echten Straßen mit echten Straßennamen |
| Sparte | Elektro |
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
| `js/roads.js` | Straßennetz laden (Overpass), zwischenspeichern (IndexedDB), Routing (A*), Routing-Server (OSRM) als Überbrückung |
| `js/map.js` | Kartenansicht (Leaflet) |
| `js/ui.js` | Oberfläche, Dialoge, Zeitleiste |
| `js/main.js` | Start und Hauptschleife |
| `vendor/leaflet` | Leaflet 1.9.4 (BSD-2-Clause), lokal eingebunden |

Neue Auftragsarten lassen sich allein über `JOB_TYPES` in `data.js` ergänzen.

## Bekannte Grenzen des Prototyps

- Der OSRM-Demo-Server ist laut Betreiber nicht für Dauerbetrieb gedacht (max. 1 Anfrage/Sekunde); er wird nur genutzt, bis das Straßennetz geladen ist
- Sind beide Dienste nicht erreichbar (z. B. in der claude.ai-Vorschau), fahren Fahrzeuge Luftlinie und Aufträge können abseits von Straßen liegen
- Kein Verkehrsmodell außer pauschalem Berufsverkehr-Aufschlag
- Noch keine Schichten, Erschöpfung, Material/Lager, Wetter, Ausschreibungen oder Mehrspieler
- Balancing ist ein erster Wurf
