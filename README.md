# Hubwagen-ERP – ERP & CRM für den Hubwagen-Service

Webbasierte ERP-/CRM-Lösung für **Einzelunternehmer im Bereich Hubwagen-/Flurförderzeug-Wartung**:
UVV-Prüfung, Wartung, Reparatur und Ersatzteilverkauf, von der Kundenakquise bis zur bezahlten Rechnung.

* **Keine Abhängigkeiten**: läuft mit reinem Node.js (≥ 22.13), Datenbank ist das eingebaute SQLite (eine Datei).
* **Läuft im Browser** auf PC, Tablet und Smartphone (responsive, als Web-App installierbar).
* **Ein Benutzer**, passwortgeschützt.

## Funktionen

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Kennzahlen: überfällige und anstehende Prüfungen, offene Aufträge, offene Posten, Umsatz Monat/Jahr, 12-Monats-Umsatzdiagramm, „Zu erledigen“ (abrechnen, überfällige Rechnungen, Wiedervorlagen, Mindestbestand) |
| **CRM – Kunden & Interessenten** | Stammdaten, Status (Kunde / Interessent / Inaktiv), Lead-Quelle, Zahlungsziel, Kundenakte mit Geräten, Aufträgen, Belegen, Umsatz und Kontaktverlauf |
| **CRM – Kontakte & Wiedervorlagen** | Anrufe, E-Mails, Besuche, Notizen mit Wiedervorlagedatum; offene Wiedervorlagen erscheinen in Übersicht und Kalender |
| **Geräte & Prüffristen** | Hand-/Elektro-/Scheren-/Wiegehubwagen, Deichselstapler usw. je Kunde mit Seriennummer, Baujahr, Tragfähigkeit, Standort. Prüfintervall (Standard 12 Monate nach DGUV Vorschrift 68), automatische Berechnung der nächsten Prüfung, Filter „fällig/überfällig/gesperrt“. **Sammelfunktionen:** Prüfaufträge oder Prüfangebot für ausgewählte Geräte erzeugen |
| **Serviceaufträge** | UVV-Prüfung, Wartung, Reparatur, Notdienst. **Digitale Prüf-Checkliste** (angelehnt an DGUV G 308-002, mit Zusatzpunkten für Elektrogeräte), Befund, Prüfergebnis, Arbeitszeit, Anfahrt-km, Material. Beim Abschluss wird das Prüfdatum am Gerät fortgeschrieben, ein nicht betriebssicheres Gerät wird **gesperrt**, Ersatzteile werden **vom Lager abgebucht** |
| **Prüfprotokoll / Servicebericht** | Druckfertig (A4 / PDF) mit Checkliste, Ergebnis, Prüfplaketten-Angabe (nächste Prüfung MM/JJJJ) und Unterschriftsfeldern |
| **Kalender** | Monatsansicht mit Terminen, Wiedervorlagen und fälligen Prüfungen; Klick auf einen Tag legt einen Auftrag an |
| **Angebote** | Positionen aus Artikelstamm oder frei, Gültigkeit, Status, Umwandlung in eine Rechnung mit einem Klick |
| **Rechnungen** | Aus Auftrag automatisch erzeugt (Material + Arbeitszeit × Stundensatz + km × km-Satz bzw. Pauschale). Fortlaufende Nummern (RE-JJJJ-0001), Leistungsdatum, Fälligkeit, **Festschreibung (GoBD)**: festgeschriebene Rechnungen lassen sich nicht mehr ändern oder löschen, Korrektur nur per **Stornorechnung**. Zahlungseingang, Zahlungserinnerung/Mahnstufen, Kleinunternehmerregelung § 19 UStG |
| **Artikel & Lager** | Ersatzteile (EK/VK, Marge, Bestand, Mindestbestand, Lieferant) und Dienstleistungen (z. B. Pauschale UVV-Prüfung) |
| **Einstellungen** | Firmendaten und Bankverbindung für Belege, Steuersatz, Stundensatz, km-Satz, Fristen, Standardtexte, Passwort ändern |
| **Datensicherung** | Komplette Sicherung als JSON herunterladen und wieder einspielen, CSV-Export (Excel) aller Listen |

## Starten

```bash
# Normalbetrieb (leere Datenbank, beim ersten Aufruf wird das Passwort festgelegt)
npm start

# Mit Beispieldaten zum Ausprobieren
npm run demo
```

Dann im Browser **http://127.0.0.1:3000** öffnen.

Umgebungsvariablen:

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` | `3000` | Port |
| `HOST` | `127.0.0.1` | `0.0.0.0` setzen, um im lokalen Netz (z. B. vom Tablet in der Werkstatt) zuzugreifen |
| `DB_FILE` | `data/hubwagen-erp.db` | Speicherort der Datenbank |

### Betrieb im Internet

Für den Zugriff von unterwegs die App hinter einem Reverse-Proxy mit HTTPS betreiben (z. B. Caddy oder nginx auf einem kleinen
VPS oder Raspberry Pi). Der Proxy muss `X-Forwarded-Proto: https` setzen, dann wird das Sitzungs-Cookie als `Secure` markiert.
Beispiel Caddy:

```
erp.meine-firma.de {
    reverse_proxy 127.0.0.1:3000
}
```

**Sicherung:** Die gesamte Datenbank liegt in `data/hubwagen-erp.db`. Diese Datei regelmäßig sichern oder über
*Einstellungen → Sicherung herunterladen* exportieren.

## Tests

```bash
npm test
```

Die Tests prüfen den kompletten Ablauf über die REST-API: Anmeldung, Kunde → Gerät → Prüfauftrag → Abschluss
(Prüffrist, Lager) → Rechnung (Beträge, Festschreibung) → Storno, Geräte-Sperre bei Mängeln, Angebot → Rechnung,
Export/Import und CSRF-Schutz.

## Projektstruktur

```
server.js        Startpunkt
app.js           REST-API, Geschäftslogik, Auth, Auslieferung der Oberfläche
db.js            Datenbankschema (SQLite) und Standard-Einstellungen
demo.js          Beispieldaten
public/          Web-Oberfläche (index.html, main.js, styles.css)
test/            API-Tests (node:test)
```

## Hinweise

* Die Prüf-Checkliste ist eine praxisnahe Vorlage, die sich an DGUV Vorschrift 68 und DGUV Grundsatz 308-002 orientiert. Sie ersetzt
  nicht die Herstellervorgaben und die Gefährdungsbeurteilung des Betreibers. Prüfungen dürfen nur befähigte Personen
  (TRBS 1203) durchführen.
* Die Rechnungsfunktionen sind auf die üblichen Pflichtangaben nach § 14 UStG ausgelegt. Ob sie für die eigene Buchhaltung
  ausreichen, sollte mit dem Steuerberater abgestimmt werden (z. B. Export an DATEV / E-Rechnung).
