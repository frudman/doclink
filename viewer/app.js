"use strict";

// todo: convert to events emitter instead (to save,cancel, changed)


const copyToClipboard = (function() {
    const el = document.createElement('textarea');
    window.addEventListener('load', () => {
        document.body.appendChild(el);
        el.setAttribute('clipboard-utility', '');
    })
    return str => {
        el.value = str;
        el.select();
        document.execCommand('copy');
    }    
})();


// helpers        
const log = console.log.bind(console);
log.error = console.error.bind(console);

const qs = selector => document.querySelector(selector);
const spl = parts => parts.split('@');
const on = (what, listener) => { let [evt,sel] = spl(what); qs(sel).addEventListener(evt, listener); };
const toggleAttr = what => { let [attr,sel] = spl(what); qs(sel).toggleAttribute(attr); };

function attr(what, value) {
    let [attr,sel] = spl(what);
    if (value === true)
        qs(sel).setAttribute(attr, '');
    else if (typeof value === 'string')
        qs(sel).setAttribute(attr, value);
    else if (value === false || value === undefined || value === null)
        qs(sel).removeAttribute(attr);
    else 
        console.error('unexpected attribute value', value);
}

const changesPending = (function() {
    var hasChanges = false
    return function(flag) {
        if (arguments.length) // setting current state
            attr('pending-changes@body', hasChanges = flag);
        else
            return hasChanges; // querying current state
    }
})();

function setLoadedContent(content) {

    qs('div[viewer]').innerHTML = content.html;
    qs('textarea').value = content.plain;

    changesPending(false); // since we're setting/resetting it

    for (const code of document.querySelectorAll('code')) {
        code.addEventListener('click', e => {
            log('clicked', e, e.target.innerText);
            copyToClipboard(e.target.innerText);
        })
    }

    const toc = qs('h2[toc]');
    if (toc)
        toc.addEventListener('click', () => toggleAttr('hide@div.table-of-contents'))
    else
        log('not markdown content', content);
}

function showDocument(docFile, originalContent) {

    setLoadedContent(originalContent);

    attr('href@a[code-editor]', '/edit-document' + docFile);
    attr('href@a[doc-folder]', '/open-folder' + docFile.replace(/[/][^/]+$/, '')); // get its folder

    on('click@[edit-here]', () => toggleAttr('editing@body'));
    on('click@[view-formatted]', () => toggleAttr('editing@body'));

    on('click@button[save]', saveShit);

    const isMac = /mac/i.test(window.navigator.platform);

    document.addEventListener('keydown', e => {
        if (e.key === 's' && (isMac ? e.metaKey : e.ctrlKey)) {
            e.preventDefault(); // important (else browser wants to save the page)
            changesPending() && saveShit();
        }
    });

    function saveShit() {
        const updatedContent = qs('textarea').value;
        fetch(`/save-document${docFile}`, { 
            method: 'post',
            body: updatedContent, // plain text? any conversions?
        }).then(async resp => {
            const ccb = await resp.json();
            log('ok?', resp.status, ccb);
            if (ccb.saved) {
                setLoadedContent(originalContent = ccb);
            }
            else {
                log('NOT SAVED');
            }
        })
        .catch(err => {
            log('error', err); // leave as is but make save/cancel visible again
        })
    }


    // reset content
    on('click@button[cancel]', () => setLoadedContent(originalContent));

    

    // keeping it simple...
    on('keydown@textarea', () => changesPending(true)); 

    // lastly...
    attr('nothing-to-show@body', false);
}

// main initialization
window.addEventListener('beforeunload', e => {
    // as per: https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload        
    if (changesPending()) {
        e.preventDefault(); // Cancel the event
        e.returnValue = ''; // Chrome requires returnValue to be set
    }
});

window.addEventListener('load', () => {

    //document.body.appendChild(el);


    // the actual document
    const doc = qs('meta[name=document]').content;

    fetch(`/get-document${doc}`)
        .then(async resp => (resp.status === 200) ? showDocument(doc, await resp.json()) : log.error('whoopsie - no good', resp))
        .catch(err => log.error('no can do', err))
});
