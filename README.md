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

Ein Hook auf `before_footer_html_generation` (`classes/hook_callbacks.php`) lädt
auf der Einzelansicht das AMD-Modul `local_feedbackexpander/expander`. Das Modul

1. hängt an jedes bearbeitbare Feedbackfeld (`feedback_<itemid>_<userid>`) eine
   Schaltfläche,
2. holt TinyMCE bei Bedarf über `editor_tiny/loader` – die Einzelansicht selbst
   enthält keinen Editor,
3. setzt beim Übernehmen bei Aktivitäts-Bewertungsaspekten den Haken
   „Überschreiben“ (`override_<itemid>_<userid>`). Erst dadurch gibt die
   Einzelansicht das gesperrte Feld frei und überträgt den Text beim Speichern.

Gesperrte Felder ohne aktivierbare Überschreiben-Checkbox (z. B. bei gesperrten
Bewertungen) bekommen keine Schaltfläche.

Die Einzelansicht speichert Feedback immer als `FORMAT_MOODLE`; das gibt das
HTML aus dem Editor korrekt aus.

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
