"use strict"; // implied with imports below...

// todo: build this app into /dist folder as /dist/viewer.js then download statically

// TODO: add build step (& VUE) to simplify adding packages below (and use babel?) AND create admin UI also

// TODO: look at https://stackoverflow.com/questions/30651251/window-vs-document-documentelement-best-practices
//       look at Your Answer at bottom of page
//       for simple edit bar at top of page when editing rich
//       - leftmost: [preview] [toolbar goes here] [simple/more/help]

// BONUS: stackoverflow MARKDOWN editor: https://github.com/openlibrary/wmd
// - AND, uses SHOWDOWN also!!!
// also read: https://stackoverflow.com/questions/2874646/which-stack-overflow-style-markdown-wmd-javascript-editor-should-i-use
// COULD: edit markdown as raw text or easy-editor

// once s3 turned on, can update individual images by drag/drop onto them (but still want save/cancel FIRST, right?)
// - also, there are browser-based image editors

import {log, onReady, dontLeavePageIf, onCtrlSave, EventEmitter, post, crEl, qs, on, attr, scrollBackToTop} from '/app-utils.js';

import textEditor from './editors/text-editor.js'; // a plain text editor (also used as default for unknown)
import markdownEditor from './editors/markdown-editor.js'; // [re-]formatting done on server
// import richEditor from './editors/rich-editor.js'; // uses tinymce
// import binaryEditor from './editors/binary-editor.js'; // used only to update pure binary files with no view component (drag-drop-select)
// import imageEditor from './editors/image-editor.js'; // to display (i.e. view) or update (drag-drop-select)
// import audioEditor from './editors/audio-editor.js'; // to display (i.e. view) or update (drag-drop-select)
// import videoEditor from './editors/video-editor.js'; // to display (i.e. view) or update (drag-drop-select)

const contentEditors = {
    default: {
        text: textEditor, // if all else fails (BUT, default for text-based only)
        //binary: binaryEditor, // default for NON-text-based files
    },
    'markdown-editor' : markdownEditor,
    // 'rich-editor' : richEditor,
    // 'image-editor': imageEditor,
    // 'audio-editor': audioEditor,
    // 'video-editor': videoEditor,
}

function whichEditor(preferedEditor, isText) {
    var create;
    if (Array.isArray(preferedEditor))
        for (const edt of preferedEditor) {
            if (create = contentEditors[edt]) // assign & test (so single '=' NOT '===') :-)
                return {create};
        }
    else
        create = contentEditors[preferedEditor]

    return {create: create || contentEditors.default[isText ? 'text' : 'binary'] };
}

// for separate-window sync view, use websocket to notify of changes
// e.g. on 'refresh preview' button click

function displayMode(mode) {
    // editing, viewing, both (split screen)
    attr('editing@body', /editing/i.test(mode));
    attr('viewing@body', /viewing/i.test(mode));
}

function showDocument(docInfo) {

    // for a binary item (e.g. image), the plain is a url? else, how to send it down as json???
    // then what? let editor get it separately (e.g. <audio src...> or <img ...> or <video ...> or nothing at all for all others)
    // also, how to then get it: url should probably reflect '/binary-asset/...'

    const {doc, isText, preferedEditor, error} = docInfo;

    const viewer = qs('main div[viewer]'),
          editingArea = qs('main div[editor]');

    on('click@a[open-doclink-folder]', () => fetch(`/open-folder/doclink-folder`)); // on page footer

    if (error) {
        log.error('whoops', docInfo);
        viewer.innerHTML = `<h2>${error.title || error}</h2><p>${error.message || ''}</p>`;
    }
    else {

        // toggle edit/view areas;
        // document toolbox: left side;
        // editing toolbox: top/header area

        const toolbox = qs('nav[toolbox]');
        
        const tools = [
            { attr: 'viewing edit-here', label: 'edit', icon: '', click() { displayMode('editing'); } },
            { attr: 'editing view-formatted', label: 'view', icon: '', click() {  // from editor            
                refreshViewer();
                displayMode('viewing');
            }},
            { attr: 'viewing editing doc-folder', label: 'open containing folder', icon: '', click() { fetch('/open-folder' + doc.replace(/[/][^/]+$/, '')); } },
            { attr: 'viewing code-editor', label: 'edit with vscode', icon: '', click() { fetch('/edit-document' + doc); } },
        ];

        addTools(toolbox, tools);

        function addTools(tb, tools) {
            for (const tool of tools)
                tb.append(crEl('button', ...tool.attr.split(' '), tool.click).add(tool.label));
        }

        const events = new EventEmitter();
        const editor = whichEditor(preferedEditor, isText).create(events, editingArea);

        const refreshViewer = docUpdates => {
            docUpdates && editor.setDoc(docUpdates);
            const pretty = editor.getPretty();
            if (typeof pretty === 'string')
                viewer.innerHTML = pretty;
            else {
                // update but only if different from current
                if (viewer.firstChild === pretty)
                    log('NO REFRESH NEEDED - handled by custom editor');
                else if (viewer.firstChild) {
                    viewer.replaceChild(pretty, viewer.firstChild);
                    log('CHANGED root child', viewer.firstChild, pretty);
                }
                else {
                    viewer.append(pretty);
                    log('ADDED FIRST TIME VIEWER', pretty);
                }
            }
        }

        var changesPending = false;
        events.on('changes-pending', () => attr('pending-changes@body', changesPending = true))

        on('click@button[save]', () => changesPending && saveChanges());
        onCtrlSave(() => changesPending && saveChanges());

        // reset content
        on('click@button[cancel]', () => { // back to original
            if (editor.resetContent) {
                editor.resetContent(); // automatic (let the editor do it)
                refreshViewer();
            }
            else
                refreshViewer(docInfo); // manually

            attr('pending-changes@body', changesPending = false)
        });

        // don't let user leave if unsaved changes
        dontLeavePageIf(() => changesPending);

        // show content to start
        refreshViewer(docInfo);

        function saveChanges() {
            const updatedContent = editor.getContent(); // can be a STRING or an OBJECT
            post(`/save-document${doc}`, updatedContent).then(resp => resp.json())
                .then(newDoc => {

                    // todo: test on delays; what to do with save/cancel buttons
                    //       since local, less likely for delay (s3 also)

                    // possible issues: content @ server was modified in between
                    // could FORCE save (i.e. override what's up there already)
                    // also, could open new window to see that new content

                    if (newDoc.error) 
                        log.error('NOT SAVED', newDoc); // do nothing to UI?
                    else {
                        attr('pending-changes@body', changesPending = false); // current is new baseline
                        if (editor.savedContent) {
                            editor.savedContent();
                            refreshViewer();
                        }
                        else
                            refreshViewer(docInfo = newDoc); // manually
                    }
                })
                .catch(err => log.error('NOT SAVED', err)); // do nothing to UI?
        }
    }

    displayMode('viewing'); // to start
    attr('loading@body', false); // now ready
}

// main initialization
onReady(() => {

    // which document?
    const doc = qs('meta[name=document]').content;

    // get it...
    // ACTUALLY, gets document META; 
    //  - if a text document, actual content in .raw
    //  - if not text (i.e. bimary), actual bits kept at .url
    //      - .url to be used as needed by contentEditor

    fetch(`/get-document${doc}`).then(resp => resp.json()) 
        .then(showDocument)
        .catch(err => showDocument({ doc, err, 
            error: { title: `can't get document`, message: err.message || 'unknown error' }, 
        }));

    scrollBackToTop({ scrollingEl: qs('[viewer]'), });

    // for a cleaner look, hide controls when user scrolling down the page (likely reading it)
    // then show controls if scrolling up
    var lastScrolled = 0;
    on('scroll@div[viewer]', e => {
        // true = hide since moving down; false = show since going up
        const scrollingDown = (e.target.scrollTop > lastScrolled); 
        attr('hidden@div[toc]', scrollingDown);
        attr('hidden@nav[toolbox]', scrollingDown);
        lastScrolled = e.target.scrollTop;
    });
});
