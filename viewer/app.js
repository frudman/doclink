"use strict"; // implied with imports below...

import {log, onReady, dontLeavePageIf, onCtrlSave} from './app-utils.js';
import {copyToClipboard, post} from './app-utils.js';
import {qs, qsa, on, toggleAttr, attr} from './app-utils.js';


// todo: convert to events emitter instead (to save,cancel, changed)

const changesPending = (function() {
    var hasChanges = false
    return function(flag) {
        if (arguments.length) // setting current state
            attr('pending-changes@body', hasChanges = flag);
        else
            return hasChanges; // querying current state
    }
})();

function setLoadedContent(docInfo) {

    const {error, html, plain} = docInfo;

    if (error) {
        qs('div[viewer]').innerHTML = html || plain || error; // display it
        attr('disabled@header', true); // disable editing
    }
    else { 
        // this document becomes the baseline
        changesPending(false); 
    
        qs('div[viewer]').innerHTML = html;
        qs('textarea').value = plain;
    
        for (const el of qsa('code')) {
            el.setAttribute('title', 'click to copy to clipboard (ctrl-c)');
            el.addEventListener('click', e => copyToClipboard(e.target.innerText))
        }
    
        const toc = qs('h2[toc]');
        if (toc)
            toc.addEventListener('click', () => toggleAttr('hide@div.table-of-contents'))
        else
            log('not markdown content', content);    
    }
}

function showDocument(docInfo) {

    const {doc, error, html, plain} = docInfo;

    setLoadedContent(docInfo);

    attr('href@a[code-editor]', '/edit-document' + doc);
    attr('href@a[doc-folder]', '/open-folder' + doc.replace(/[/][^/]+$/, '')); // get its folder

    on('click@[edit-here]', () => toggleAttr('editing@body'));
    on('click@[view-formatted]', () => toggleAttr('editing@body'));

    on('click@button[save]', saveChanges);

    onCtrlSave(() => changesPending() && saveChanges());

    // reset content
    on('click@button[cancel]', () => setLoadedContent(docInfo));

    // keeping it simple...
    on('keydown@textarea', () => changesPending(true)); 

    // lastly (nothing displayed until this)...
    attr('nothing-to-show@body', false);

    function saveChanges() {
        const updatedContent = qs('textarea').value;// plain text? any conversions?
        post(`/save-document${doc}`, updatedContent).then(resp => resp.json())
            .then(newDoc => 
                newDoc.error ? log.error('NOT SAVED', newDoc) : setLoadedContent(docInfo = newDoc))
            .catch(err => 
                log.error('NOT SAVED', err));
    }
}

// main initialization
onReady(() => {

    // don't let user leave if unsaved changes
    dontLeavePageIf(changesPending);

    // which document?
    const doc = qs('meta[name=document]').content;

    // get it...
    fetch(`/get-document${doc}`).then(resp => resp.json())
        .then(showDocument)
        .catch(err => showDocument({
            doc,
            error: err.message || 'unknown error', 
            html: `<h2>can't get document</h2><p>${err.message || 'unknown error'}</p>`
        }));
});
