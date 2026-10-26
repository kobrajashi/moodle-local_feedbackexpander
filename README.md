# Feedback Expander (local_feedbackexpander)

Lokales Plugin, das die **Feedback-Felder in der Einzelansicht der Bewertungen**
(*Bewertungen → Einzelansicht*, `/grade/report/singleview/`) um einen vollwertigen
Editor erweitert.

Moodle zeigt dort nur einzeilige Textfelder. Das Plugin ergänzt je Feld eine
Schaltfläche **„Im Editor bearbeiten"**, die den Feedback-Text in einem Modal mit
TinyMCE öffnet – inklusive Formatierung, Links und Listen. Mit *„Einfügen und
schließen"* wandert der Text zurück ins Formularfeld und wird beim normalen
Speichern der Seite übernommen.

## Wie es technisch funktioniert

Die Einzelansicht enthält keine Editor-Felder, deshalb lädt Moodle die
`editor_tiny/*`-AMD-Module dort nicht. Das Plugin umgeht das so:

1. `local_feedbackexpander_setup_editor()` registriert über
   `editors_get_preferred_editor()` den bevorzugten Editor auf einem verborgenen
   Vorlade-Textfeld im Seitenfuß. Damit zieht Moodle alle TinyMCE-Module mit.
2. Das AMD-Modul `local_feedbackexpander/expander` hängt die Schaltflächen an die
   Feedback-Felder und baut das Modal auf.

Der Aufruf erfolgt sowohl über den Moodle-5.x-Hook als auch über den Legacy-Callback
`before_footer` – ein statisches Flag stellt sicher, dass er pro Request nur einmal
greift, auch wenn beide Mechanismen vorhanden sind.

Das verborgene Textfeld darf nicht mit `display:none` ausgeblendet werden, weil
TinyMCE sich auf unsichtbaren Elementen nicht initialisiert; stattdessen wird der
Wrapper per CSS aus dem sichtbaren Bereich geschoben.

## Installation

```bash
cp -r local_feedbackexpander /pfad/zu/moodle/public/local/feedbackexpander
php admin/cli/upgrade.php
```

Ab Moodle 5.1 liegen Plugins im Verzeichnis `public`. Alternativ als Administrator/in
über *Website-Administration → Mitteilungen*.

## Status

`MATURITY_ALPHA`, Release 0.1.0 – funktionsfähig, aber noch nicht breit getestet.

## Datenschutz

Privacy-Provider vorhanden: das Plugin speichert keine personenbezogenen Daten.
Die Feedback-Texte selbst verwaltet weiterhin das Bewertungssystem von Moodle.

## Lizenz

GNU GPL v3 oder später – siehe [LICENSE](LICENSE).
