# Feedback Expander (local_feedbackexpander)

Local plugin that adds a full text editor to the **feedback fields of the gradebook single view**
(*Grades → Single view*, `/grade/report/singleview/`).

Moodle only shows single-line text fields there. The plugin adds an **"Edit in editor"** button next to each
field that opens the feedback in a modal with TinyMCE – including formatting, links and lists. *"Insert and
close"* writes the text back into the form field, and it is saved together with the rest of the page.

## Requirements

- **Moodle 4.5 or later** (`$plugin->requires = 2024100700`). Developed against Moodle 5.1.
- TinyMCE must be installed (it is part of Moodle core). Without it, the modal falls back to a plain text area.

## How it works

A hook on `before_footer_html_generation` (`classes/hook_callbacks.php`) loads the AMD module
`local_feedbackexpander/expander` on the single view. The module

1. adds a button to every editable feedback field (`feedback_<itemid>_<userid>`),
2. loads TinyMCE on demand through `editor_tiny/loader` – the single view itself contains no editor,
3. ticks the "Override" checkbox (`override_<itemid>_<userid>`) for activity grade items when the text is
   inserted. Only then does the single view unlock the field and submit the text when the page is saved.

Locked fields without an override checkbox that can be ticked (e.g. locked grades) get no button.

The single view always stores feedback as `FORMAT_MOODLE`, which renders the HTML from the editor correctly.

## Installation

From Moodle 5.1, plugins live in the `public` directory:

```bash
cp -r local_feedbackexpander /path/to/moodle/public/local/feedbackexpander
php admin/cli/upgrade.php
```

On Moodle 4.5 and 5.0 the target is `/path/to/moodle/local/feedbackexpander`. Alternatively, install as an
administrator via *Site administration → Notifications*.

## Status

`MATURITY_ALPHA`, release 0.1.0 – working, but not yet widely tested.

## Privacy

Privacy provider included: the plugin stores no personal data. The feedback texts themselves are still managed
by Moodle's gradebook.

## License

GNU GPL v3 or later – see [LICENSE](LICENSE).
