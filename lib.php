<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Library functions for local_feedbackexpander.
 *
 * @package    local_feedbackexpander
 * @copyright  2026 Tobias Sanders
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Register TinyMCE on a hidden preload element and queue the AMD init call.
 *
 * Using a static flag ensures this runs at most once per request, regardless
 * of whether it is triggered by the legacy callback, the Moodle 5.x hook, or
 * both (which can happen on Moodle 4.4+ where both mechanisms coexist).
 *
 * @return string  HTML to append to the page footer, or empty string.
 */
function local_feedbackexpander_setup_editor(): string {
    global $PAGE;

    // Guard: execute only once per request.
    static $done = false;
    if ($done) {
        return '';
    }
    $done = true;

    // Use the current page context (typically course context on singleview).
    $context = $PAGE->context ?? context_system::instance();

    // Registering the preferred editor forces Moodle to include all
    // editor_tiny/* AMD modules, even though singleview has no editor fields.
    $editor = editors_get_preferred_editor(FORMAT_HTML);
    $editor->use_editor('feedbackexpander_preload', [
        'context'  => $context,
        'autosave' => false,
    ]);

    $PAGE->requires->js_call_amd('local_feedbackexpander/expander', 'init');

    // Wrap the textarea so TinyMCE's .tox-tinymce sibling is hidden with it.
    // Must not use display:none — TinyMCE refuses to init on invisible elements.
    $textarea = html_writer::tag('textarea', '', [
        'id'          => 'feedbackexpander_preload',
        'aria-hidden' => 'true',
        'tabindex'    => '-1',
    ]);
    return html_writer::div($textarea, 'feedbackexpander-preload-wrapper');
}

/**
 * Legacy before_footer callback — Moodle 4.x.
 *
 * The return value is appended verbatim to the page footer HTML.
 *
 * @return string
 */
function local_feedbackexpander_before_footer(): string {
    global $PAGE;

    if (strpos($PAGE->url->get_path(), '/grade/report/singleview/index.php') !== false) {
        return local_feedbackexpander_setup_editor();
    }
    return '';
}

/**
 * Hook callback class — Moodle 5.x hook API.
 *
 * Registered via db/hooks.php. On Moodle versions that support both the legacy
 * callback and the hook system, the static flag in local_feedbackexpander_setup_editor()
 * prevents the setup code from running twice.
 *
 * @package    local_feedbackexpander
 * @copyright  2026 Tobias Sanders
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class local_feedbackexpander_hook_before_footer {

    /**
     * Called by the Moodle hook dispatcher.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     */
    public static function callback(\core\hook\output\before_footer_html_generation $hook): void {
        global $PAGE;

        if (strpos($PAGE->url->get_path(), '/grade/report/singleview/index.php') !== false) {
            $html = local_feedbackexpander_setup_editor();
            if ($html !== '') {
                $hook->add_html($html);
            }
        }
    }
}
