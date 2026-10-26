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

namespace local_feedbackexpander;

use core\hook\output\before_footer_html_generation;

/**
 * Hook callbacks for local_feedbackexpander.
 *
 * Lives in classes/ so the hook manager can autoload it: a class in lib.php
 * only exists if something else happened to include that file first.
 *
 * @package    local_feedbackexpander
 * @copyright  2026 Tobias Sanders
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /**
     * Queue the expander module on the gradebook single view.
     *
     * Page type rather than URL: it is derived from the running script and
     * does not trigger the "page did not call set_url()" debugging on pages
     * that never set one.
     *
     * @param before_footer_html_generation $hook
     * @return void
     */
    public static function before_footer(before_footer_html_generation $hook): void {
        global $PAGE;

        if ($PAGE->pagetype !== 'grade-report-singleview-index') {
            return;
        }
        $PAGE->requires->js_call_amd('local_feedbackexpander/expander', 'init');
    }
}
