"use strict"; // implied with imports below...

// todo: build this app into /dist folder as /dist/viewer.js then download statically

// TODO: add build step (& VUE) to simplify adding packages below (and use babel?) AND create admin UI also

// once s3 turned on, can update individual images by drag/drop onto them (but still want save/cancel FIRST, right?)
// - also, there are browser-based image editors

import {log, onReady, dontLeavePageIf, onCtrlSave, EventEmitter, post, qs, on, attr, scrollBackToTop} from '/app-utils.js';

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

function showDocument(docInfo) {

    // current premise: after edit, must save to get new view-html (html-gen done on server)
    // better way: do view-html generation in browser & let user go back and forth (view,edit,view,edit,view...)
    // - save/cancel buttons appear (then) on view and edit panels
    // - don't have to save to view changes (so can view changes BEFORE saving)
    // - ISSUE: are ALL editors workable in browser? e.g. makrdown-it
    //          - even if not, maybe send to server for re-gen, then display that (without 1st saving on server)

    // for a binary item (e.g. image), the plain is a url? else, how to send it down as json???
    // then what? let editor get it separately (e.g. <audio src...> or <img ...> or <video ...> or nothing at all for all others)
    // also, how to then get it: url should probably reflect '/binary-asset/...'

    const {doc, isText, preferedEditor, error} = docInfo;

    const viewer = qs('div[viewer]'),
          editingArea = qs('main div[editor]');

    // error-editor: just displays an error (from server or browser) when nothing else can be done

    // href='/open-folder{{DOCLINK_FOLDER}}'
    // <a open-doclink-folder folder-location
    on('click@a[open-doclink-folder]', () => fetch(`/open-folder/doclink-folder`));

    if (error) {
        log('whoops', docInfo);
        viewer.innerHTML = `<h2>${error.title || error}</h2><p>${error.message || ''}</p>`;
        attr('disabled@header', true); // disable editing
    }
    else {

        //attr('href@a[code-editor]', '/edit-document' + doc); // with vscode
        on('click@a[code-editor]', () => fetch('/edit-document' + doc)); // don't care if it succeeds or fails

        // DON'T want to act as if leaving document (not)
        //attr('href@a[doc-folder]', '/open-folder' + doc.replace(/[/][^/]+$/, '')); // get its folder
        on('click@a[doc-folder]', () => fetch('/open-folder' + doc.replace(/[/][^/]+$/, ''))); // don't care if it succeeds or fails
    
        const events = new EventEmitter();
        const editor = whichEditor(preferedEditor, isText).create(events, editingArea);

        const refreshViewer = docUpdates => {
            docUpdates && editor.setDoc(docUpdates);
            const pretty = editor.getPretty();
            if (typeof pretty === 'string')
                viewer.innerHTML = pretty;
            else {
                // update but only if different from current
                // how to know?
                if (viewer.firstChild === pretty)
                    log('NO REFRESH NEEDED - handled by custom editor');
                else if (viewer.firstChild) {
                    log('CHANGING root child', viewer.firstChild, pretty);
                    viewer.replaceChild(pretty, viewer.firstChild);
                }
                else {
                    viewer.append(pretty);
                    log('ADDING FIRST TIME VIEWER', pretty);
                }
            }
        }

        var changesPending = false;
        events.on('changes-pending', () => attr('pending-changes@body', changesPending = true))

        on('click@[edit-here]', () => attr('editing@body', true))  // from viewer
        on('click@[view-formatted]', async () => { // from editor            
            refreshViewer();
            attr('editing@body', false);
        });

        on('click@button[save]', () => changesPending && saveChanges());
        onCtrlSave(() => changesPending && saveChanges());

        // reset content
        on('click@button[cancel]', () => { // back to original
            if (editor.resetContent) {
                editor.resetContent();
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

    // lastly (nothing displayed until this)...
    attr('nothing-to-show@body', false);
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
        .catch(err => showDocument({
            doc,
            error: { title: `can't get document`, message: err.message || 'unknown error' }, 
            err
        }));

    scrollBackToTop({ scrollingEl: qs('[viewer]'), xscrollerText: '' });

    window.addEventListener('scroll', e => {
        log('sc', e);
    })
});
