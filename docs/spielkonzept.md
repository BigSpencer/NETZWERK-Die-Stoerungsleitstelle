# NETZWERK – Die Störungsleitstelle

**Arbeitstitel:** *NETZWERK* (Alternativen: *Störfall*, *Entstörzentrale*, *Leitwarte*)
**Genre:** Browserbasierte Echtzeit-Leitstellen- und Aufbausimulation auf echter Karte
**Plattform:** Web (Desktop + Mobile), später optional App-Wrapper
**Stand:** Konzeptentwurf v0.1

---

## 1. Vision in einem Satz

Der Spieler leitet die **Entstörungs- und Servicezentrale eines Infrastruktur-Dienstleisters**: Er gewinnt Aufträge von Stadtwerken, Kommunen, Netzbetreibern und Firmen, disponiert Monteur-Trupps und Spezialfahrzeuge auf einer echten Karte und muss vertraglich zugesicherte Reaktions- und Erledigungszeiten einhalten – sonst drohen Vertragsstrafen und Kündigung.

## 2. Abgrenzung zu bestehenden Spielen

| Aspekt | Leitstellenspiel.de | ÖPNV-Leitstelle | **NETZWERK** |
|---|---|---|---|
| Thema | Feuerwehr, Rettungsdienst, Polizei | Busse/Bahnen, Linienbetrieb | Technische Infrastruktur: Strom, Gas, Wasser, Telekom, Verkehrstechnik, Winterdienst |
| Einsatzauslöser | Notruf, zufällig | Fahrplan, Störungen im Betrieb | **Aufträge von Auftraggebern** mit Vertrag, Frist und Vergütung |
| Ziel eines Einsatzes | Gefahr beseitigen, fertig | Betrieb aufrechterhalten | **Auftrag vertragsgemäß erfüllen** (Zeit, Qualität, Dokumentation) |
| Einsatzdauer | Minuten | kontinuierlich | Minuten bis mehrere Spieltage, oft **mehrphasig** |
| Wirtschaft | Credits pro Einsatz | Fahrgeldeinnahmen | Verträge, Rahmenverträge, Ausschreibungen, Material, Personalkosten, Vertragsstrafen |
| Kernentscheidung | „Welche Fahrzeuge alarmiere ich?“ | „Wie halte ich den Takt?“ | **„Welchen Auftrag nehme ich an, wen schicke ich, was priorisiere ich – und kann ich mir das leisten?“** |

Bewusst **nicht** übernommen: Blaulicht-Thematik, Wachen-/Fahrzeugnamen aus dem BOS-Bereich, Fahrplan- und Liniensystem, bekannte UI-Layouts (Einsatzliste links + Karte rechts in identischer Form), Begriffe wie „Wache“, „Alarmieren“, „Sprechwunsch“.

## 3. Setting

Der Spieler gründet ein kleines Unternehmen – *„Service- und Entstörungsdienst“* – in einer frei wählbaren Stadt (echte Kartendaten, z. B. OpenStreetMap). Anfangs gibt es nur einen Betriebshof, zwei Monteure und einen Transporter. Mit der Zeit wächst daraus ein regionaler Infrastrukturdienstleister mit mehreren **Stützpunkten**, Spezialtechnik und eigenen Rahmenverträgen.

**Sparten (schrittweise freischaltbar):**

1. **Elektro** – Hausanschlüsse, Ortsnetz, Straßenbeleuchtung, Trafostationen
2. **Gas & Wasser** – Rohrbrüche, Gasgeruch-Prüfung (technisch, kein Rettungsdienst), Zählerwechsel
3. **Abwasser** – Kanalverstopfung, Kanal-TV-Inspektion, Pumpwerksausfall
4. **Verkehrstechnik** – Ampelstörungen, Verkehrssicherung, Baustellenabsicherung
5. **Telekommunikation** – Kabelschäden, Glasfaser-Spleißen, Funkmast-Wartung
6. **Kommunaldienst** – Winterdienst, Sturmschäden (Baumbeseitigung), Straßenreinigung

## 4. Core Loop

```
 ┌────────────────────────────────────────────────────────────┐
 │ 1. Auftragseingang (Auftragsbörse / Rahmenvertrag / Notfall)│
 │ 2. Bewerten: Vergütung, Frist, Anforderungen, Risiko        │
 │ 3. Annehmen oder ablehnen                                   │
 │ 4. Disponieren: Trupp + Fahrzeug + Material zuweisen        │
 │ 5. Durchführung (Phasen, ggf. Nachforderung)                │
 │ 6. Abnahme & Abrechnung (Bonus / Strafe / Bewertung)        │
 │ 7. Investieren: Personal, Fahrzeuge, Stützpunkte, Lizenzen  │
 └───────────────────────────────┬────────────────────────────┘
                                 └──► zurück zu 1 (größere Aufträge)
```

Der Reiz liegt in der **Spannung zwischen Gier und Kapazität**: Jeder angenommene Auftrag bindet Ressourcen. Wer zu viel annimmt, reißt Fristen; wer zu wenig annimmt, wächst nicht.

## 5. Das Auftragssystem (Herzstück)

### 5.1 Auftragsquellen

| Quelle | Beschreibung | Planbarkeit |
|---|---|---|
| **Auftragsbörse** | Offene Einzelaufträge in der Region, frei annehmbar, zeitlich begrenzt sichtbar | mittel |
| **Rahmenverträge** | Langfristige Verträge (z. B. „Straßenbeleuchtung Stadtteil Nord, 30 Spieltage“). Aufträge daraus *müssen* angenommen werden | hoch, aber verpflichtend |
| **Ausschreibungen** | Spieler bieten gegeneinander (Preis + Reaktionszeit + Reputation). Gewinner erhält Rahmenvertrag | strategisch |
| **Störungsmeldungen** | Dringende Aufträge mit kurzer Reaktionsfrist und Zuschlag (z. B. Stromausfall Straßenzug) | niedrig |
| **Großschadenslagen** | Sturm, Hochwasser, Hitzewelle: viele Aufträge gleichzeitig, Kooperation mit anderen Spielern | Event |

### 5.2 Aufbau eines Auftrags

```yaml
auftrag:
  titel: "Ausfall Straßenbeleuchtung – Lindenallee 12–40"
  auftraggeber: "Stadtwerke Musterstadt (Rahmenvertrag RV-0042)"
  sparte: Elektro
  prioritaet: P2            # P1 Störung kritisch … P4 planbar
  reaktionsfrist: 60 min    # Trupp vor Ort
  erledigungsfrist: 8 h     # Auftrag abgeschlossen
  verguetung: 1.450 €
  bonus_bei_frist_unterschreitung: +15 %
  vertragsstrafe: 300 € je angefangene Stunde Verzug
  anforderungen:
    personal: [Elektrofachkraft x2]
    fahrzeug: [Hubarbeitsbühne]
    material: [Leuchtmittel-Set, Sicherungen]
  phasen:
    - Erkundung       (15 min)
    - Fehlersuche     (30–90 min, Zufall + Qualifikation)
    - Instandsetzung  (45 min)
    - Dokumentation   (automatisch, Qualität abhängig vom Teamführer)
  moegliche_wendungen:
    - "Kabelschaden im Erdreich" → Nachforderung Bagger + Tiefbautrupp
```

### 5.3 Mehrphasige Aufträge und Wendungen

Anders als „Fahrzeuge hin, Einsatz fertig“ hat jeder Auftrag **Phasen**. Nach der Erkundung kann sich die Lage ändern:

- **Nachforderung:** Weitere Spezialisten oder Geräte nötig.
- **Nachtrag:** Auftraggeber zahlt mehr, wenn der Mehraufwand gemeldet wird – sofern der Spieler die Entscheidung *rechtzeitig* trifft.
- **Fremdgewerk:** Ein Teil darf an andere Spieler (Subunternehmer) vergeben werden.
- **Abbruch:** Auftrag zurückgeben → Reputationsverlust, aber keine Vertragsstrafe.

### 5.4 Fristen & SLA

- **Reaktionsfrist** (Zeit bis Ankunft) und **Erledigungsfrist** (Zeit bis Abschluss) laufen getrennt.
- Ein **SLA-Monitor** zeigt pro Rahmenvertrag die Erfüllungsquote der letzten Spieltage.
- Fällt die Quote unter die vertragliche Schwelle (z. B. 90 %), droht **Abmahnung**, danach **Kündigung** des Rahmenvertrags.

### 5.5 Bewertung nach Abschluss

| Kriterium | Wirkung |
|---|---|
| Fristtreue | Bonus/Strafe in € |
| Qualität (Nacharbeit nötig?) | Reputation beim Auftraggeber |
| Dokumentation | Zahlungsdauer (schlechte Doku = Zahlung verzögert) |
| Kosten (Anfahrt, Überstunden) | Gewinnmarge |

### 5.6 Auftragsstufen und Befähigungen – wer darf was?

Grundsatz: **Welche Aufträge ein Spieler bekommt, hängt davon ab, was seine Firma kann.** Was sie kann, ergibt sich aus der Qualifikation der Mitarbeiter und aus dem Fuhrpark. Wertvollere Aufträge gibt es nicht durch Levelaufstieg, sondern weil man das passende Personal ausbildet und die nötige Technik anschafft.

#### Auftragsstufen

Jeder Auftragstyp gehört zu einer **Stufe von 1 bis 5**. Je höher die Stufe, desto höher die Vergütung, desto strenger die Fristen und desto größer das Risiko.

| Stufe | Charakter | Vergütung (Richtwert) | Typische Fristen | Risiko bei Fehlern |
|---|---|---|---|---|
| 1 – Basis | Einfache Instandsetzung, ein Ort | 200–800 € | großzügig | gering |
| 2 – Fachaufgabe | Fachkraft nötig, kleine Wendungen | 800–2.500 € | mittel | Nacharbeit |
| 3 – Spezialaufgabe | Spezialausbildung **oder** Spezialfahrzeug | 2.500–8.000 € | eng | Vertragsstrafe, Folgeaufträge |
| 4 – Netzaufgabe | Mehrere Trupps, mehrere Phasen, Spezialtechnik | 8.000–25.000 € | sehr eng | hohe Strafe, Reputationsverlust |
| 5 – Großprojekt | Nur mit Zertifizierung oder als Arbeitsgemeinschaft (ARGE) | 25.000 € + | vertraglich verhandelt | Vertragskündigung |

#### Beispiel-Leiter: Sparte Elektro

| Stufe | Auftrag | Mindestanforderung | Alternative |
|---|---|---|---|
| 1 | Defekte Straßenlaterne (Leuchtmittel, Vorschaltgerät) | Monteurtransporter + 2 Monteure | – |
| 1 | Mastklappe/Leuchte beschädigt (Unfall) | Transporter + 2 Monteure + Absicherungsanhänger | – |
| 2 | Straßenbeleuchtung, ganzer Straßenzug ausgefallen | 1 Elektrofachkraft + Hubarbeitsbühne | – |
| 2 | Hausanschluss ohne Strom | 1 Elektrofachkraft + Transporter | – |
| 2 | Kabelverteilerschrank angefahren | 1 Elektrofachkraft + 1 Monteur + Transporter | – |
| 3 | **Defekte Trafostation (Ortsnetz)** | **Weg A:** 1 Monteur mit **Schaltberechtigung** + 1 Elektrofachkraft + Transporter | **Weg B:** **Netzersatzanlage** (Notstrom-Lkw) + 1 Elektrofachkraft |
| 3 | Kabelfehler Niederspannung (Ort unbekannt) | **Kabelmesswagen** + Elektrofachkraft | Ohne Messwagen: Suche per Aufgraben (Minibagger, sehr langsam, Frist kaum zu halten) |
| 4 | Kabelfehler Mittelspannung | Kabelmesswagen + **Kabelmuffenmonteur** + Tiefbautrupp mit Bagger + Schaltberechtigter | – |
| 4 | Umbau Trafostation (geplant) | Schaltberechtigter + Ladekran + 2 Elektrofachkräfte | – |
| 5 | Netzerneuerung Wohngebiet (Rahmenprojekt) | Zertifizierung „Netzbau-Fachbetrieb“ + mind. 3 Muffenmonteure + Tiefbaukolonne | Als ARGE mit einem Tiefbau-Spieler |

#### UND-/ODER-Anforderungen: zwei Wege zum Ziel

Viele Aufträge ab Stufe 3 lassen sich **auf mehreren Wegen** erfüllen. Das ist eine bewusste strategische Entscheidung: Investiert man in **Menschen** (Ausbildung) oder in **Maschinen** (Fahrzeugkauf)?

Beispiel Trafostation:

- **Weg A – Reparatur durch Qualifikation:** Der schaltberechtigte Monteur schaltet die Station frei, der Fehler wird vor Ort behoben. → **volle Vergütung**, schnell erledigt. Die Ausbildung kostet allerdings Zeit, und die Fachkraft verlangt höheren Lohn.
- **Weg B – Überbrückung durch Technik:** Die Netzersatzanlage speist die betroffenen Straßen vorübergehend. → Die Reaktionsfrist ist erfüllt, aber es gibt **nur eine Teilvergütung (≈ 60 %)**. Die endgültige Reparatur wird als **Folgeauftrag** ausgeschrieben, und den bekommt eventuell ein anderer Spieler. Dafür taugt die Netzersatzanlage auch für Großlagen und Veranstaltungen und kann vermietet werden.

```yaml
auftragstyp: trafostation_stoerung
sparte: Elektro
stufe: 3
anforderungen:
  wege:
    - name: "Reparatur"
      personal: [Schaltberechtigung x1, Elektrofachkraft x1]
      fahrzeug: [Monteurtransporter]
      verguetung_faktor: 1.0
    - name: "Überbrückung"
      personal: [Elektrofachkraft x1]
      fahrzeug: [Netzersatzanlage]
      verguetung_faktor: 0.6
      erzeugt_folgeauftrag: trafostation_instandsetzung
```

#### Annehmen vs. Erhalten

Wie gut eine Firma aufgestellt ist, wirkt sich auf zwei Ebenen aus:

1. **Annehmen (Auftragsbörse):** Einen Auftrag annehmen kann nur, wer die Anforderungen mindestens eines Weges **grundsätzlich** erfüllt. Das Personal muss also angestellt und das Fahrzeug im Besitz sein, beides muss aber nicht gerade frei sein. Wer annimmt und dann keine freien Kapazitäten hat, riskiert eine Vertragsstrafe.
2. **Erhalten (Direktvergabe, Rahmenverträge, Ausschreibungen):** Auftraggeber kommen von sich aus nur auf Firmen zu, die ihre **Befähigung nachgewiesen** haben:
   - **Personaldecke:** mindestens zwei Personen mit der Qualifikation, damit Ausfälle und Schichten abgedeckt sind.
   - **Referenzen:** eine bestimmte Zahl erfolgreich erledigter Aufträge der Stufe darunter, z. B. 10× Stufe 2, bevor Rahmenverträge der Stufe 3 angeboten werden.
   - **Reputation** beim jeweiligen Auftraggeber.
   - ab Stufe 4: **Zertifizierung** (siehe Kap. 9).

#### Sichtbarkeit: Ziele zeigen, nicht verstecken

Die Auftragsbörse zeigt zusätzlich die Aufträge **eine Stufe über dem eigenen Niveau**, ausgegraut und mit einem konkreten Hinweis:

> 🔒 *Defekte Trafostation Gartenweg – 4.200 €*
> Dir fehlt: **Schaltberechtigung** (Ausbildung: 2 Spieltage, 3.500 €) **oder** **Netzersatzanlage** (Kauf: 48.000 € / Leasing: 900 € je Spieltag)

So sieht der Spieler immer, wofür sich die nächste Investition lohnt. Ein Klick auf den Hinweis öffnet direkt die Ausbildungs- bzw. Fahrzeugplanung.

#### Ausbildungswege (Beispiel Elektro)

```
Monteur (Start)
  └─► Elektrofachkraft            [Voraussetzung: 15 Aufträge Stufe 1 · 1 Spieltag · 1.500 €]
        ├─► Schaltberechtigung    [10 Aufträge Stufe 2 · 2 Spieltage · 3.500 €]
        │     └─► Arbeiten unter Spannung (AuS)  [Zertifikat · 4 Spieltage · 9.000 €]
        └─► Kabelmuffenmonteur    [8 Aufträge Stufe 2 · 3 Spieltage · 5.000 €]
              └─► Muffenmonteur Mittelspannung   [Schaltberechtigung im Team · 3 Spieltage]
```

- Ausbildung setzt **Praxiserfahrung** voraus: Die Person muss vorher Aufträge der nötigen Stufe erledigt haben. So zahlt sich auch die Arbeit an einfachen Aufträgen aus.
- Während der Ausbildung **fällt die Person aus**.
- Höher qualifizierte Mitarbeiter verlangen **mehr Lohn** und können **abgeworben** werden. Ein Bonus oder eine Bindungsprämie hält sie im Betrieb.
- **Überqualifikation kostet:** Wer die Schaltberechtigte an eine Laterne schickt, zahlt ihren hohen Stundenlohn für einen Auftrag der Stufe 1, und für die Trafostation ist sie dann nicht frei.

#### Qualifikation wirkt nicht nur als Schalter

Neben den reinen Freischaltungen beeinflusst Qualifikation auch, **wie gut** ein Auftrag läuft:

| Einsatz | Wirkung |
|---|---|
| Mindestqualifikation | Normale Bearbeitungszeit, normales Wendungsrisiko |
| Höhere Qualifikation / viel Erfahrung | Fehlersuche bis zu 40 % schneller, bessere Doku, weniger Nacharbeit |
| Passendes Spezialfahrzeug, obwohl es auch ohne ginge | Phase verkürzt (z. B. Kabelmesswagen statt Aufgraben) |

#### Spartenübergreifende Synergien

Manche Befähigungen nützen in mehreren Sparten und machen Expansion attraktiver:

| Befähigung | Nutzen in |
|---|---|
| Tiefbautrupp + Minibagger | Elektro (Kabel), Gas/Wasser (Rohre), Telekom (Leerrohre) |
| Verkehrssicherer + Absicherungsanhänger | jede Baustelle im Straßenraum: Pflicht ab Stufe 2 an Hauptstraßen |
| Ladekran | Trafostationen, Schachtbauwerke, Sturmschäden |

#### Weitere Sparten im Kurzüberblick

| Sparte | Stufe 1 | Stufe 3 (Schlüsselbefähigung) | Stufe 4–5 |
|---|---|---|---|
| Gas & Wasser | Zählerwechsel, tropfender Hydrant | Rohrbruch Hauptleitung → **Rohrnetzmonteur** + Saugbagger | Gasleitung unter Druck anbohren → Zertifikat „Gas-Fachbetrieb“ |
| Abwasser | Verstopfter Straßenablauf → Spülwagen | Schadenssuche → **Kanal-TV-Fahrzeug** **oder** Kanaltechniker + Begehung | Pumpwerkausfall, Inliner-Sanierung |
| Verkehrstechnik | Ampel-Lampe tauschen | Steuergerät defekt → **Signaltechniker** | Knotenpunkt neu programmieren, Verkehrsrechner |
| Telekom | Hausanschluss-Dose | Glasfaserschaden → **Spleißtechniker** + Spleißfahrzeug | Backbone-Störung, Funkmast (Höhenarbeit) |
| Kommunaldienst | Ast auf Gehweg | Sturmbaum auf Fahrbahn → **Motorsägenschein** + Ladekran | Großlage Sturmtief (ARGE) |

## 6. Ressourcen

### 6.1 Personal (statt anonymer Besatzung)

Personal ist die **knappste Ressource**. Jede Person hat:

- **Qualifikationen:** Elektrofachkraft, Rohrleitungsbauer, Kanaltechniker, Baumaschinenführer, Kranführer, Verkehrssicherer, Spleißtechniker, Truppführer …
- **Schichtmodell:** Früh/Spät/Nacht, **Rufbereitschaft** (günstig, aber längere Ausrückzeit), Überstunden mit Zuschlag.
- **Erschöpfung:** Lange Einsätze senken die Arbeitsgeschwindigkeit; Ruhezeiten müssen eingehalten werden.
- **Erfahrung:** Personal levelt in seinen Sparten → kürzere Fehlersuche, bessere Doku.

Weiterbildungen kosten Zeit (Person fällt aus) und Geld – eine bewusste Investitionsentscheidung. Sie sind der wichtigste Hebel, um höhere Auftragsstufen freizuschalten (siehe 5.6).

### 6.2 Fahrzeuge & Geräte

| Kategorie | Beispiele |
|---|---|
| Servicefahrzeuge | Monteurtransporter, Pritsche mit Werkstattausbau |
| Hebetechnik | Hubarbeitsbühne, Ladekran |
| Tiefbau | Minibagger auf Tieflader, Saugbagger |
| Kanal | Spül- und Saugwagen, Kanal-TV-Fahrzeug |
| Verkehr | Absicherungsanhänger, Leitpfosten-Transporter |
| Winter | Streufahrzeug, Räumschild-Unimog |
| Mobile Versorgung | Notstromaggregat, Trinkwasser-Anhänger |

Spezialfahrzeuge (Hubarbeitsbühne, Kabelmesswagen, Netzersatzanlage, Kanal-TV-Fahrzeug …) sind neben der Ausbildung der zweite Weg zu höheren Auftragsstufen (siehe 5.6). Sie sind teuer, lassen sich dafür aber oft in mehreren Sparten nutzen oder an andere Spieler vermieten.

Fahrzeuge haben **Verschleiß** und **Wartungsintervalle**. Ein ausgefallener Saugbagger mitten in einer Großlage tut weh.

### 6.3 Material & Lager

Jeder Stützpunkt hat ein **Lager**. Aufträge verbrauchen Material (Kabel, Rohrkupplungen, Leuchtmittel, Streusalz). Nachschub muss bestellt werden (Lieferzeit!). Leeres Lager = Trupp muss Umweg über anderen Stützpunkt fahren.

### 6.4 Stützpunkte

- **Betriebshof** (Basis, Werkstatt, Lager)
- **Außenstelle** (kleiner, nur Fahrzeuge + Kleinlager → kürzere Wege)
- **Materialdepot** (großes Lager, keine Fahrzeuge)
- **Werkstatt** (Wartung in-house statt teurer Fremdwerkstatt)
- **Schulungszentrum** (eigene Weiterbildungen)

## 7. Karte & Simulation

- Echte Straßenkarte (OpenStreetMap), Routing mit Fahrzeugklassen (Bagger auf Tieflader fährt langsamer, Hubbühne darf nicht unter jede Brücke).
- **Tageszeit & Wochentag:** Berufsverkehr verlängert Fahrzeiten; nachts kostet Personal Zuschlag.
- **Wetter:** Regen → mehr Kanalaufträge, Frost → Rohrbrüche & Winterdienst, Sturm → Baumschäden & Freileitungen, Hitze → Trafoausfälle.
- **Infrastruktur-Layer (optional, Ausbaustufe):** Vereinfachtes Netzmodell. Ein unreparierter Kabelfehler kann Folgeaufträge in der Umgebung erzeugen.

## 8. Wirtschaft

**Einnahmen:** Auftragsvergütung, Boni, Rahmenvertragspauschalen (Bereitschaftsvergütung), Subunternehmer-Provision.

**Ausgaben:** Löhne (laufend, je Schicht), Zuschläge, Material, Kraftstoff, Wartung, Leasing/Kauf, Stützpunktmiete, Vertragsstrafen.

**Liquidität:** Auftraggeber zahlen mit Zahlungsziel (z. B. 2 Spieltage). Man kann also *auf dem Papier* reich und trotzdem zahlungsunfähig sein → Kredit mit Zinsen als Notlösung.

> Leitgedanke: Geld ist kein reiner Highscore, sondern ein **Steuerungsinstrument**. Jede Expansion hat laufende Kosten.

## 9. Reputation & Progression

- **Reputation je Auftraggeber** (Stadtwerke, Telekom-Netzbetreiber, Straßenbauamt …) schaltet bessere Verträge frei.
- **Befähigungen statt Level:** Welche Auftragsstufen verfügbar sind, ergibt sich aus der Qualifikation des Personals und dem Fuhrpark (siehe 5.6), nicht aus einem abstrakten Erfahrungspunkte-Level.
- **Firmenstufe** (Handwerksbetrieb → Regionaler Dienstleister → Infrastrukturkonzern) ergibt sich aus Umsatz und Zahl der Stützpunkte. Sie schaltet neue Sparten und größere Ausschreibungen frei.
- **Zertifizierungen** (z. B. „Arbeiten unter Spannung“, „Netzbau-Fachbetrieb“, „Gas-Fachbetrieb“) sind Voraussetzung für Aufträge ab Stufe 4. Sie verlangen eine Mindestzahl qualifizierter Mitarbeiter, Referenzaufträge und regelmäßige Auffrischung: Verlässt eine Fachkraft die Firma, kann das Zertifikat ruhen.

## 10. Multiplayer

- **Gemeinsame Welt pro Region:** Spieler in derselben Stadt konkurrieren um die Auftragsbörse und Ausschreibungen.
- **Arbeitsgemeinschaften (ARGE)** statt klassischer Verbände: Spieler schließen sich zusammen, um Großausschreibungen zu gewinnen, die einer allein nicht stemmen kann. Gewinnverteilung per Vertrag im Spiel.
- **Subunternehmer-Markt:** Aufträge oder Teilphasen an andere Spieler weitergeben (gegen Marge). Wer seine Kapazität clever verkauft, verdient auch ohne eigene Aufträge.
- **Großschadenslagen** (Sturmtief, Hochwasser): Region-weite Events mit gemeinsamen Zielen („Versorgung in 48 h wiederherstellen“) und Ranglisten.

## 11. Bedienkonzept / UI

- **Disponentenansicht:** Karte zentral, darunter eine **Zeitleiste (Gantt)** je Trupp – man sieht sofort, wer wann gebunden ist und welche Fristen kollidieren. *Das ist das zentrale UI-Element und unterscheidet sich klar von einer reinen Einsatzliste.*
- **Auftragsmappe:** Karte mit Phasen, Anforderungen, Fristen-Countdown, Verlaufsprotokoll.
- **Vorschlags-Assistent:** Schlägt passende Trupps vor (Qualifikation, Entfernung, Restschicht). Spieler kann übernehmen oder anpassen. Später automatisierbar durch eingestellte **Disponenten-NPCs** (kosten Gehalt, machen gelegentlich suboptimale Entscheidungen).
- **SLA-Dashboard:** Erfüllungsquoten je Vertrag, Ampelfarben, Warnungen vor drohender Abmahnung.
- **Mobile:** Vereinfachte Ansicht „Auftragseingang + Schnellzuweisung“.

## 12. Spielzeit & Offline-Verhalten

- Echtzeit mit **Zeitfaktor** (z. B. 1 Spieltag = 4 Echtstunden, konfigurierbar pro Server).
- Offline laufen Rahmenverträge weiter. Damit Spieler nicht bestraft werden: **Bereitschaftsmodus** – der Spieler legt vor dem Abmelden Regeln fest (z. B. „P1/P2 automatisch annehmen, nächster freier qualifizierter Trupp“). Die Automatik ist bewusst etwas schlechter als aktives Spielen.

## 13. Monetarisierung (fair)

- Kostenlos spielbar ohne Pay-to-Win-Zwang.
- Premium-Abo: Komfort (mehr Disponenten-Regeln, Statistiken, Kartenstile, mehr gleichzeitige Ausschreibungsgebote).
- Kosmetik: Firmenlogo, Fahrzeuglackierungen, Arbeitskleidung.
- **Keine** käuflichen Credits, die Fristen überspringen.

## 14. Technische Eckpunkte (Vorschlag)

| Bereich | Vorschlag |
|---|---|
| Frontend | TypeScript, React o. Ä., MapLibre GL + OSM-Vektorkacheln |
| Routing | Eigener OSRM-/Valhalla-Server mit Fahrzeugprofilen |
| Backend | Node.js/TypeScript oder Go; ereignisgesteuerte Simulation (Tick-basiert, z. B. 1 Tick = 10 s Spielzeit) |
| Echtzeit | WebSockets für Auftrags- und Fahrzeugupdates |
| Datenhaltung | PostgreSQL + PostGIS (Standorte, Gebiete), Redis für Simulationszustand |
| Auftragsgenerator | Datengetrieben (YAML/JSON-Templates wie in 5.2), gewichtet nach Wetter, Tageszeit, Gebäudedichte aus OSM |

## 15. Roadmap

**MVP (Prototyp, Einzelspieler):**
- Eine Stadt, eine Sparte (Elektro), Auftragsstufen 1–3 inkl. Trafostation mit zwei Wegen
- Auftragsbörse mit gesperrten Vorschau-Aufträgen + 1 Rahmenvertrag
- 4 Fahrzeugtypen (Transporter, Hubarbeitsbühne, Kabelmesswagen, Netzersatzanlage), Ausbildungsweg Monteur → Elektrofachkraft → Schaltberechtigung, Schichten ohne Erschöpfung
- Phasen + eine Wendung pro Auftragstyp
- Gantt-Disposition, einfache Wirtschaft (Löhne, Vergütung, Strafen)

**Beta:**
- Sparten Gas/Wasser + Verkehrstechnik
- Material & Lager, Wetter, Reputation
- Ausschreibungen, Multiplayer-Regionen

**Release:**
- Alle Sparten, ARGE, Subunternehmer-Markt, Großschadenslagen
- Disponenten-NPCs & Bereitschaftsmodus, Mobile-Ansicht

## 16. Beispielhafter Spielmoment

> 17:42 Uhr, Freitag, erster Frost. Drei Rohrbrüche aus dem Rahmenvertrag der Stadtwerke laufen gleichzeitig ein, Reaktionsfrist je 45 Minuten. Der einzige Saugbagger steht noch an einer Baustelle im Gewerbegebiet. Trupp 2 ist seit zehn Stunden im Dienst – noch eine Stunde, dann muss er in die Ruhezeit.
> Auf der Börse leuchtet gleichzeitig ein lukrativer Telekom-Auftrag auf: 4.800 €, Glasfaserschaden, Annahme nur 10 Minuten möglich.
> Nehme ich ihn an und gebe einen Rohrbruch an den Konkurrenten aus der ARGE ab? Hole ich Rufbereitschaft mit Nachtzuschlag? Oder riskiere ich die Vertragsstrafe, weil ich weiß, dass das SLA-Konto diesen Monat noch Puffer hat?

Genau diese Entscheidungen sind das Spiel.

## 17. Offene Fragen

1. Wie realistisch soll das Netzmodell (Kap. 7) sein – reine Kulisse oder echte Ursache-Wirkungs-Kette?
2. Zeitfaktor: fester Serverwert oder pro Spieler wählbar (dann nur Einzelspieler-Welten)?
3. Sollen Fahrzeuge sichtbar über die Karte fahren (Atmosphäre) oder reicht ein Fortschrittsbalken (Performance)?
4. Wie stark wird Konkurrenz zwischen Spielern betont – kooperativ-freundlich oder echter Wettbewerb um Verträge?
5. Finaler Name und Markenrecherche.
