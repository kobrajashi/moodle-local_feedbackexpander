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
 * Feedback Expander AMD module.
 *
 * Adds a magnifier icon beneath every feedback input on the Gradebook Single View
 * page. Clicking the icon opens a Moodle modal with a TinyMCE editor (or a
 * plain-textarea fallback). "Save and close" writes the content back to the
 * original input and activates the corresponding override checkbox.
 *
 * @module     local_feedbackexpander/expander
 * @copyright  2026 Tobias Sanders
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'core/modal_factory',
    'core/modal_events',
    'core/str',
    'core/templates',
    'core/notification'
], function(ModalFactory, ModalEvents, Str, Templates, Notification) {

    'use strict';

    /** Counter to generate unique textarea IDs inside each modal. */
    var instanceCounter = 0;

    /**
     * Return all feedback input fields present in the DOM right now.
     * The Single View renders inputs with name="feedback[<gradeitemid>][<userid>]"
     * or legacy name="feedback_<n>". We target both patterns.
     *
     * @returns {HTMLElement[]}
     */
    function getFeedbackInputs() {
        // :not([data-feedbackexpander-attached]) is the primary deduplication guard.
        // We mark every processed input with this attribute immediately (before the
        // async string fetch), so repeated observer calls can never add a second icon.
        var inputs = Array.prototype.slice.call(
            document.querySelectorAll(
                'input[name^="feedback"]:not([data-feedbackexpander-attached]),' +
                'textarea[name^="feedback"]:not([data-feedbackexpander-attached])'
            )
        );
        return inputs.filter(function(el) {
            // Exclude our own modal textarea (name "feedbackexpander-editor-N"
            // also starts with "feedback" – that is the root cause of the
            // icon-inside-modal bug).
            if (el.id && el.id.indexOf('feedbackexpander-') === 0) {
                return false;
            }
            // Exclude anything inside a Bootstrap modal (.modal element).
            if (el.closest('.modal')) {
                return false;
            }
            return true;
        });
    }

    // ---------------------------------------------------------------------------
    // TinyMCE helpers
    // ---------------------------------------------------------------------------

    /**
     * Initialise TinyMCE on the textarea identified by textareaId.
     *
     * Strategy:
     *   1. Use editor_tiny/loader to load the TinyMCE script (even when the
     *      singleview page has no editor on it, this module boots TinyMCE).
     *   2. Call window.tinyMCE.init() directly once the library is available.
     *   3. If editor_tiny/loader is not available (e.g. Atto is default editor),
     *      try window.tinyMCE directly as a last resort.
     *   4. If neither works the plain textarea remains functional.
     *
     * @param {string} textareaId
     * @param {string} initialContent
     */
    function initEditor(textareaId, initialContent) {
        // editor_tiny/tinymce is the AMD-wrapped TinyMCE bundle itself.
        // Requiring it boots TinyMCE even when no editor field exists on the page.
        require(['editor_tiny/tinymce'], function(tinyMCE) {
            // Small delay: let any modal CSS transition finish before TinyMCE
            // measures the target element's dimensions.
            setTimeout(function() {
                tinyMCE.init(buildTinyConfig(textareaId, initialContent));
            }, 50);
        }, function() {
            // editor_tiny/tinymce not available → try window.tinyMCE (already loaded)
            // or give up silently (plain textarea remains functional).
            initEditorDirect(textareaId, initialContent);
        });
    }

    /**
     * Build the tinyMCE.init() config object.
     *
     * @param {string} textareaId
     * @param {string} initialContent
     * @returns {object}
     */
    function buildTinyConfig(textareaId, initialContent) {
        return {
            target: document.getElementById(textareaId),
            plugins: 'lists link',
            toolbar: 'undo redo | bold italic underline | bullist numlist | link',
            menubar: false,
            statusbar: false,
            height: 400,
            promotion: false,
            branding: false,
            setup: function(editor) {
                editor.on('init', function() {
                    editor.setContent(initialContent);
                });
            }
        };
    }

    /**
     * Last-resort init: use window.tinyMCE if it happens to be loaded already.
     *
     * @param {string} textareaId
     * @param {string} initialContent
     */
    function initEditorDirect(textareaId, initialContent) {
        if (typeof window.tinyMCE !== 'undefined') {
            window.tinyMCE.init(buildTinyConfig(textareaId, initialContent));
        }
        // If tinyMCE is not available at all the plain textarea is still usable.
    }

    /**
     * Retrieve the active TinyMCE editor instance for a given textarea ID,
     * regardless of whether it was created via Moodle's AMD module or directly.
     *
     * @param {string} textareaId
     * @returns {object|null}
     */
    function getEditorInstance(textareaId) {
        if (typeof window.tinyMCE !== 'undefined') {
            return window.tinyMCE.get(textareaId) || null;
        }
        return null;
    }

    /**
     * Read the full HTML content from TinyMCE, or fall back to the textarea value.
     * We store HTML in the feedback input; Moodle renders it when feedbackformat=1.
     *
     * @param {string} textareaId
     * @returns {string}  HTML string
     */
    function getEditorContent(textareaId) {
        var editor = getEditorInstance(textareaId);
        if (editor) {
            return editor.getContent(); // returns HTML
        }
        var textarea = document.getElementById(textareaId);
        return textarea ? textarea.value : '';
    }

/**
     * Destroy the TinyMCE instance to prevent memory leaks.
     *
     * @param {string} textareaId
     */
    function destroyEditor(textareaId) {
        var editor = getEditorInstance(textareaId);
        if (editor) {
            editor.remove();
        }
    }

    // ---------------------------------------------------------------------------
    // Override-checkbox helper
    // ---------------------------------------------------------------------------

    /**
     * Activate the override checkbox that corresponds to a feedback input so
     * Moodle actually persists the value on form submit.
     *
     * The Single View uses several naming conventions depending on the Moodle
     * version; we try multiple patterns.
     *
     * @param {HTMLElement} feedbackInput
     */
    function activateOverrideCheckbox(feedbackInput) {
        var name = feedbackInput.getAttribute('name');
        if (!name) {
            return;
        }

        var candidates = [
            // Pattern A: override_feedback[…]  (most common in recent Moodle)
            'override_' + name,
            // Pattern B: override[feedback_…]  – less common legacy pattern
            name.replace(/^feedback/, 'override[feedback') + ']',
        ];

        // Only activate a checkbox that matches a known override name pattern.
        // We deliberately do NOT fall back to row.querySelector('input[type=checkbox]')
        // because that blindly grabs the first checkbox in the row, which may be
        // the "Ausschließen" (exclude) checkbox instead of the override checkbox.
        candidates.forEach(function(candidateName) {
            var cb = document.querySelector('input[type="checkbox"][name="' + CSS.escape(candidateName) + '"]');
            if (cb && !cb.checked) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change', {bubbles: true}));
            }
        });
    }

    // ---------------------------------------------------------------------------
    // Feedback format
    // ---------------------------------------------------------------------------

    /**
     * Set the feedbackformat hidden input to FORMAT_HTML (1) so Moodle renders
     * the stored HTML instead of displaying it as raw markup.
     *
     * Moodle's singleview form includes a hidden input whose name follows the
     * same array-key pattern as the feedback input itself, with "format" appended.
     * Example: feedback[1234][5][format]  when feedback name is feedback[1234][5]
     *
     * We also search by proximity (same <tr>) as a fallback.
     *
     * @param {HTMLElement} feedbackInput
     */
    function setFeedbackFormat(feedbackInput) {
        var name = feedbackInput.getAttribute('name');
        if (!name) {
            return;
        }

        // Derive the expected format-field name from the feedback field name.
        // feedback[a][b]  →  feedback[a][b][format]
        // feedback_123    →  feedback_123_format  (legacy pattern)
        var formatName;
        if (name.charAt(name.length - 1) === ']') {
            formatName = name.slice(0, -1) + '][format]';  // feedback[a][b][format]
        } else {
            formatName = name + '[format]'; // might not exist; fallback covers it
        }

        var formatInput = document.querySelector('input[name="' + CSS.escape(formatName) + '"]');

        // Fallback: any hidden input with "format" in the name inside the same row.
        if (!formatInput) {
            var row = feedbackInput.closest('tr');
            if (row) {
                formatInput = row.querySelector('input[type="hidden"][name*="format"]');
            }
        }

        if (formatInput) {
            formatInput.value = '1'; // FORMAT_HTML
        }
    }

    // ---------------------------------------------------------------------------
    // Post-save input update
    // ---------------------------------------------------------------------------

    /**
     * Write the HTML content directly into the input field and store it in a
     * data attribute so re-opening the modal loads the same content.
     *
     * @param {HTMLElement} feedbackInput
     * @param {string}      html   - HTML content from TinyMCE
     */
    function storeAndDisplayContent(feedbackInput, html) {
        feedbackInput.value = html;
    }

    // ---------------------------------------------------------------------------
    // Icon insertion
    // ---------------------------------------------------------------------------

    /**
     * Insert a magnifier trigger icon immediately after the given input field.
     *
     * @param {HTMLElement} inputField
     * @param {string}      tooltipText  - localised tooltip string
     */
    function insertTriggerIcon(inputField, tooltipText) {
        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'feedbackexpander-trigger btn btn-sm btn-secondary';
        trigger.setAttribute('aria-label', tooltipText);
        trigger.textContent = tooltipText;

        trigger.addEventListener('click', function() {
            openModal(inputField, trigger);
        });

        inputField.parentNode.insertBefore(trigger, inputField.nextSibling);
    }

    // ---------------------------------------------------------------------------
    // Modal
    // ---------------------------------------------------------------------------

    /**
     * Build and open the feedback editor modal for the given input field.
     *
     * @param {HTMLElement} targetInput   - the original feedback input
     * @param {HTMLElement} triggerEl     - the icon that was clicked (for focus restoration)
     */
    function openModal(targetInput, triggerEl) {
        instanceCounter++;
        var textareaId = 'feedbackexpander-editor-' + instanceCounter;
        var currentValue = targetInput.value || '';

        // Fetch localised strings in parallel with template rendering.
        var stringsPromise = Str.get_strings([
            {key: 'editfeedback',  component: 'local_feedbackexpander'},
            {key: 'saveandclose',  component: 'local_feedbackexpander'},
            {key: 'close',         component: 'local_feedbackexpander'}
        ]);

        var templateContext = {
            textareaid: textareaId,
            currentvalue: currentValue
        };

        var bodyPromise = Templates.render('local_feedbackexpander/modal_body', templateContext);

        Promise.all([stringsPromise, bodyPromise]).then(function(results) {
            var strings = results[0];
            var bodyHtml = results[1];

            return ModalFactory.create({
                type: ModalFactory.types.SAVE_CANCEL,
                title: strings[0],   // 'editfeedback'
                body: bodyHtml,
                large: true
            }).then(function(modal) {
                // Apply our custom CSS class so styles.css selectors work.
                modal.getRoot().addClass('feedbackexpander-modal');

                // Override the built-in button labels with our localised strings.
                modal.setSaveButtonText(strings[1]);  // 'saveandclose'
                // The cancel button label is set via Moodle's ModalFactory;
                // SAVE_CANCEL modals expose it through the footer template.
                // We set the custom text on the rendered button directly after show.

                // ---------------------------------------------------------------
                // Initialise TinyMCE after the modal is fully visible.
                // ---------------------------------------------------------------
                modal.getRoot().on(ModalEvents.shown, function() {
                    initEditor(textareaId, currentValue);

                    // Update the Cancel button label if the element is reachable.
                    var cancelBtn = modal.getRoot()[0].querySelector('[data-action="cancel"]');
                    if (cancelBtn) {
                        cancelBtn.textContent = strings[2]; // 'close'
                    }
                });

                // ---------------------------------------------------------------
                // Save: read content → write to original input → close.
                // ---------------------------------------------------------------
                modal.getRoot().on(ModalEvents.save, function(e) {
                    e.preventDefault();

                    var content = getEditorContent(textareaId); // HTML
                    destroyEditor(textareaId);

                    // Write HTML into the hidden input for form submission.
                    targetInput.value = content;
                    // Notify Moodle (and any React/Vue wrappers) that the value changed.
                    targetInput.dispatchEvent(new Event('change', {bubbles: true}));
                    targetInput.dispatchEvent(new Event('input',  {bubbles: true}));

                    // Mark the feedback field as HTML format so Moodle renders it.
                    setFeedbackFormat(targetInput);
                    // Activate the override checkbox so the value is actually saved.
                    activateOverrideCheckbox(targetInput);
                    // Show plain text in the input; swap to HTML on form submit.
                    storeAndDisplayContent(targetInput, content);

                    modal.hide();
                });

                // ---------------------------------------------------------------
                // Cancel / hidden: destroy editor, restore focus.
                // ---------------------------------------------------------------
                modal.getRoot().on(ModalEvents.cancel, function() {
                    destroyEditor(textareaId);
                });

                modal.getRoot().on(ModalEvents.hidden, function() {
                    destroyEditor(textareaId);
                    if (triggerEl) {
                        triggerEl.focus();
                    }
                });

                modal.show();
                return modal;
            });
        }).catch(Notification.exception);
    }

    // ---------------------------------------------------------------------------
    // Attaching icons
    // ---------------------------------------------------------------------------

    /**
     * Find all undecorated feedback inputs and attach trigger icons.
     */
    function attachExpanderIcons() {
        var inputs = getFeedbackInputs();
        if (inputs.length === 0) {
            return;
        }

        // Mark inputs immediately – before the async string fetch – so that
        // any observer callback firing in the meantime finds them already
        // stamped and skips them.
        inputs.forEach(function(input) {
            input.setAttribute('data-feedbackexpander-attached', '1');
        });

        Str.get_string('editfeedback', 'local_feedbackexpander').then(function(tooltip) {
            inputs.forEach(function(input) {
                insertTriggerIcon(input, tooltip);
            });
            return tooltip;
        }).catch(Notification.exception);
    }

    // ---------------------------------------------------------------------------
    // MutationObserver (handles AJAX-driven user/item switches in Single View)
    // ---------------------------------------------------------------------------

    var observerAttached = false;
    var debounceTimer = null;

    function setupObserver() {
        if (observerAttached) {
            return;
        }
        observerAttached = true;

        var root = document.querySelector('.grade-report-singleview') || document.body;
        var observer = new MutationObserver(function() {
            // Debounce: wait until the DOM settles before scanning for new inputs.
            // This prevents a flood of calls when TinyMCE or our own code makes
            // several rapid DOM changes in a row.
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(attachExpanderIcons, 200);
        });
        observer.observe(root, {childList: true, subtree: true});
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    return {
        /**
         * Entry point called by lib.php via $PAGE->requires->js_call_amd().
         */
        init: function() {
            // Run immediately in case the DOM is already ready.
            attachExpanderIcons();

            // Also observe for dynamically loaded content (AJAX navigation).
            setupObserver();
        }
    };
});
