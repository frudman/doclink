"use strict"; // implied with imports below...

// 1st goal: support all main platforms (mac, windows, linux)
// - chrome & firefox: free and wide-usage
// 2nd goal: try for native browsers
// - safari for mac & edge for windows
// - only if fits es20xx
// - IE is too limited from javascript and can use edge on win7-8 now anyway (right? tbv)

// To ask me a question please drop $5 at patreon
// - e.g. (end of page) http://xahlee.info/comp/unicode_user_interface_icons.html
// - also: https://www.patreon.com/xahlee

// todo: build this app into /dist folder as /dist/viewer.js then download statically

// TODO: add build step (& VUE) to simplify adding packages below (and use babel?) AND create admin UI also


// TO CREATE DESKTOP LINK:
// - cd simplytel-dev/doclink/
// - 


// once s3 turned on, can update individual images by drag/drop onto them (but still want save/cancel FIRST, right?)
// - also, there are browser-based image editors

import {log, onReady, dontLeavePageIf, onCtrlSave, EventEmitter, post, crEl, qs, qsa, on, attr, scrollBackToTop, tooltip, toggleAttr} from './utils.js';

import textEditor from '../editors/text-editor/index.js'; // a plain text editor (also used as default for unknown)
import markdownEditor from '../editors/markdown-editor/index.js'; // [re-]formatting done on server
import richEditor from '../editors/rich-editor/index.js'; // uses tinymce
// import binaryEditor from './editors/binary-editor.js'; // used only to update pure binary files with no view component (drag-drop-select)
// import imageEditor from './editors/image-editor.js'; // to display (i.e. view) or update (drag-drop-select)
// import audioEditor from './editors/audio-editor.js'; // to display (i.e. view) or update (drag-drop-select)
// import videoEditor from './editors/video-editor.js'; // to display (i.e. view) or update (drag-drop-select)

const buttonClick = 'mousedown'; // HACK: actual click seems to NOT work until user moves mouse

function testBinary() {

    const binaryBody = window.crypto.getRandomValues(new Uint8Array(12345));

    //log('binary test', binaryBody);

    fetch('/save-document/Users/frederic/simplytel-dev/doclink/sample-docs/readme1.md', {
        method: 'POST',
        headers: {
            'Content-Type': 'binary.locked', // or: 'binary; locked' 'binary locked' 'binary; .locked'
        },
        body: binaryBody,
    })
    .then(resp => resp.ok ? log('binary test OK!!!', resp.json()) : log('binary test NOPE NADA ZILCH', resp.text()))
    .catch(err => log('binary test serious whops', err));
}

const contentEditors = {
    default: {
        text: textEditor, // if all else fails (BUT, default for text-based only)
        //binary: binaryEditor, // default for NON-text-based files
    },
    'markdown-editor' : markdownEditor,
    'rich-editor' : richEditor,
    // 'image-editor': imageEditor,
    // 'audio-editor': audioEditor,
    // 'video-editor': videoEditor,
}

function whichEditor(preferedEditor, isText) {
    log('we', preferedEditor, isText);
    var create;
    if (Array.isArray(preferedEditor))
        for (const edt of preferedEditor) {
            if (create = contentEditors[edt]) // assign & test (so single '=' NOT '===') :-)
                return {create};
        }
    else
        create = contentEditors[preferedEditor]

    log('we2', create, ';');

    return {create: create || contentEditors.default[isText ? 'text' : 'binary'] };
}

// for separate-window sync view, use websocket to notify of changes
// e.g. on 'refresh preview' button click

function displayMode(mode) {
    // editing, viewing, both (split screen)
    attr('editing@body', /editing/i.test(mode));
    attr('viewing@body', /viewing/i.test(mode));
}


// util
function elFromHtml(html, firstOrRoot = true) {
    const parent = crEl('div'), placeholder = crEl('div');

    parent.append(placeholder);
    placeholder.outerHTML = html;

    return firstOrRoot ? parent.children[0] : parent.children;
}

// util
function fullPageDialog(html) {
    const dialog = elFromHtml(`<div full-page-dialog hidden>${html}</div>`);
    document.body.append(dialog);

    return Object.defineProperties(dialog, {
        show: { value: focusFld => { attr('hidden', dialog, false); focusFld && setTimeout(() => focusFld.focus(), 0) } },
        hide: { value: () => attr('hidden', dialog, true) }
    });
}

// util
function onEnterKey(...args) {

    // on enterKey: go to next field (if any)
    // if last arg is function, execute it

    // todo: check keyCode/which with Edge & IE, firefox;
    // todo: allow for string selectors (with parent el/not)
    // todo: allow for checks/validations (e.g. don't move if field empty)
    //        - maybe based on attributes (e.g. minlen = 2;)

    while (args.length) {
        const el = args.shift(), // always an element
              // next arg may be an action...
              action = typeof args.first() === 'function' ? args.shift() : false, // so MUST consume it
              // ...or another element to move to
              elNext = !action && args.first();  // so DO NOT consume it (needed on next iteration)
        (action || elNext) && on('keyup', el, e => (e.code === 'Enter') && (elNext ? elNext.focus() : action()));
    }
}

// set alert(...) to TOAST in UTILS

// create a createDialog util
function createDialog(dialogHtml, init) {
    // todo: add dialog options (e.g. dropshadow, opacity, attribute, class)
    // or let all this be done via attributes, class --> css
    const dlg = fullPageDialog(dialogHtml);
    return init(dlg, ...qsa('input,button', dlg));
}

function hint(text, inputField) {
    tooltip(inputField, { // only done once but ok to call multiple times
        placement:'right', 
        trigger: 'manual', 
        hideOnClick: false, // else would close as soon as button is clicked
    }).showTooltip(text).focus();
    setTimeout(inputField.hideTooltip, 2500); // auto close
}

const unlockDocDialog = createDialog(`
        <div document-security-dialog>
            <h1>unlock to view</h1>
            <input type=password placeholder='password to unlock'>
            <div><button>unlock</button><button>forgot</button></div>
        </div>
    `, (dlg, inp, ok, forgot) => {

    var tryPwd = () => {};

    on(buttonClick, ok, () => tryPwd(inp.value));
    on(buttonClick, forgot, () => tryPwd())
    onEnterKey(inp, () => tryPwd(inp.value));

    // actual dialog method
    return checkPwd => new Promise(resolve => {
        tryPwd = pwd => checkPwd(pwd, (valid,hintTxt) => {
            if (valid) { // ok, all is well
                dlg.hide();
                resolve();//pwd); // we're done
            }
            else { // nope, pwd not good
                inp.value = '';
                hint(pwd ? 'invalid password' : hintTxt ? `hint: ${hintTxt}` : ``, inp);
            }
        });

        dlg.show(inp);
    });
});

const addDocLockDialog = createDialog(`
        <div document-security-dialog>
            <h1>lock document with a password</h1>
            <h2>password is <u>not saved anywhere</u><br>
            once locked, document <u>can only be unlocked</u> with that password<br>
            pick your password and hint <u>carefully</u></h2>
            <input placeholder='new password'>
            <input placeholder='new password again'>
            <input placeholder='hint in case you forget password'>
            <div><button ok>create lock</button><button cancel>cancel</button></div>
        </div>
    `, (dlg, inp1, inp2, hintInp, ok, cancel) => {

    var setPassword = () => {}, forgetIt = () => {};

    // can't be blank, make sure it's the same twice (safety, typos), then try it
    const goodToGo = () => inp1.value.length === 0 ? hint('need password', inp1)
                       : inp1.value === inp2.value ? setPassword(inp1.value, hintInp.value)
                       : hint('password check failed', inp2);

    on(buttonClick, ok, goodToGo);
    on(buttonClick, cancel, () => forgetIt());
    onEnterKey(inp1, inp2, hintInp, goodToGo);

    // actual dialog method
    return cb => new Promise(resolve => {
        setPassword = (password,hint) => (dlg.hide(), resolve({password,hint}));
        forgetIt = () => [dlg.hide(), resolve()];
        dlg.show(inp1);
    });
});

const removePasswordDialog = createDialog(`
        <div document-security-dialog>
            <h1>remove document lock</h1>
            <input type=password placeholder='password or passphrase to remove'>
            <div><button ok>remove</button><button cancel>cancel</button></div>
        </div>
    `, (dlg,inp,ok,cancel) => {

    var tryPwd = () => {}, forgetIt = () => {};

    on(buttonClick, ok, () => tryPwd(inp.value));
    on(buttonClick, cancel, () => forgetIt());
    onEnterKey(inp, () => tryPwd(inp.value));

    // actual dialog method
    return checkPwd => new Promise(resolve => {
        tryPwd = pwd => checkPwd(pwd, (valid,hintTxt) => {
            if (valid) { // ok, all is well
                dlg.hide();
                resolve(true); // we're done; send back updated (i.e. empty) password
            }
            else { // nope, pwd not good
                inp.value = '';
                hint(`invalid password` + (hintTxt ? ` (hint: ${hintTxt})`:``), inp);
            }
        });
        forgetIt = () => {
            dlg.hide();
            resolve(false);
        }

        dlg.show(inp);
    });
});

const changePasswordDialog = createDialog(`
        <div document-security-dialog>
            <h1>change locking password</h1>
            <input type=password placeholder='current password to be changed'>
            <input placeholder='new password'>
            <input placeholder='new password again'>
            <input placeholder='hint in case your forget'>
            <div><button ok>change</button><button cancel>cancel</button></div>
        </div>
    `, (dlg, pwd, inp1, inp2, hintInp, ok, cancel) => {

    var changePwd = () => {}, forgetIt = () => {};

    const goodToGo = () => pwd.value.length === 0 ? hint('need current password', pwd) 
        : inp1.value.length === 0 ? hint('need a new password', inp1)
        : inp1.value === inp2.value ? changePwd(pwd.value) 
        : hint('new passwords not same', inp2);

    on(buttonClick, ok, goodToGo);
    on(buttonClick, cancel, () => forgetIt());
    onEnterKey(pwd, inp1, inp2, hintInp, goodToGo);

    // actual dialog method
    return checkPwd => new Promise(resolve => {
        changePwd = oldp => checkPwd(oldp, (ok,hintTxt) => {
            if (ok) {
                dlg.hide();
                resolve({password: inp1.value, hint: hintInp.value});
            }
            else {
                pwd.value = inp1.value = inp2.value = hintInp.value = '';
                hint(`invalid current password` + (hintTxt ? ` (hint: ${hintTxt})`:``), pwd);
            }
        });
        forgetIt = () => (dlg.hide(), resolve());
        dlg.show(pwd);
    });
});

function showPage(title) {
    title && (document.title = title);
    attr('loading@body', false); // now ready
}

async function showDocument(docInfo) {

    // for a binary item (e.g. image), the plain is a url? else, how to send it down as json???
    // then what? let editor get it separately (e.g. <audio src...> or <img ...> or <video ...> or nothing at all for all others)
    // also, how to then get it: url should probably reflect '/binary-asset/...'

    // todo: after timeout, lock doc locally & forget password

    const {doc, bytes, text, editor: preferedEditor, error, isText, isLocked} = docInfo;

    var pageTitle;

    log('showing doc', docInfo);//, docInfo.bytes.byteLength);

    if (error) {
        showPage('error 🛡️');
        return;
    }

    if (isLocked) {
        let lock = {
            hint: 'type of coffee' // island; Island; 55qt; 55; 552;
        };

        showPage(doc + ' 🔒');
        await unlockDocDialog((pwd, passwordIsGood) => {

            log('single password to unlock', pwd);

            // try decoding bytes
            // if good, pwd is good
            lock.password = pwd;

            // test pwd here, then
            passwordIsGood((pwd || '')[0] === 'a', lock.hint); // true === pwd is good
        });

        pageTitle = doc + '🔓'; // doc now unlocked

        log('unlocked with ', lock);

        var newPasswordToSet = await addDocLockDialog();
        log('NEW', newPasswordToSet, ';');
        lock = (await changePasswordDialog((current, okToChange) => {
            log('testing change', current, lock, okToChange);
            okToChange(current === lock.password, lock.hint);
        })) || lock;
        log('CHANGED PWD', lock);

        if (await removePasswordDialog((current, okToRemove) => okToRemove(current === lock.password, lock.hint)));
            lock = {};
    }
    else {
        pageTitle = doc + '😊';//); // 'hi fweddy!!! 😊😊 🔒 🔐 🔓  🛡️'; // use lock char if locked
    }

    //const {doc, isText, editor: preferedEditor, error} = docInfo;
    // https://emojipedia.org/lock/
    // https://emojipedia.org/closed-lock-with-key/
    // https://emojipedia.org/open-lock/
    // https://emojipedia.org/shield/
    // https://www.utf8icons.com/character/128274/lock (start, then go right)
    //document.title = 'hi fweddy!!! 😊😊 🔒 🔐 🔓  🛡️'; // use lock char if locked


    const viewer = qs('main div[viewer]'),
          editingArea = qs('main div[editor]');

    on('click@a[open-doclink-folder]', () => fetch(`/open-folder/doclink-folder`)); // on page footer

    // if (error) {
    //     log.error('whoops', docInfo);
    //     viewer.innerHTML = `<h2>${error.title || error}</h2><p>${error.message || ''}</p>`;
    // }
    // else
    {

        // toggle edit/view areas;
        // document toolbox: left side;
        // editing toolbox: top/header area

        const toolbox = qs('nav[toolbox]');
        
        const tools = [
            { attr: 'viewing edit-here', label: 'edit', tt: 'edit in place', icon: '', click() { displayMode('editing'); } },
            { attr: 'editing view-formatted', label: 'view', icon: '', click() {  // from editor            
                refreshViewer();
                displayMode('viewing');
            }},
            { attr: 'viewing editing doc-folder', tt: `open this document's<br>containing folder`, label: 'open', icon: '', click() { fetch('/open-folder' + doc.replace(/[/][^/]+$/, '')); } },
            { attr: 'viewing code-editor', tt: 'edit with<br>visual studio code', label: 'vscode', icon: '', click() { fetch('/edit-document' + doc); } },
            { attr: 'viewing ', tt: 'preview', label: 'preview', icon: '', click() { 
                const features = 'location=no,height=570,width=520,scrollbars=no,status=no'
                const replaceIfExisting = true;
                if (typ) {
                    typ.postMessage({dft: new Date()}, '*');
                }
                else {
                    on('message', window, e => {
                        log('received something', e, e.data);
                    })
                    typ = window.open('/app.html', 'boobaleh', features, replaceIfExisting)
                    typ.onload = () => {
                        log('winx loaded?');
                        //typ.postMessage({fuckMe:'77777- asdfasdfasdfasdfasdf'}, '*')
                    }

                    log('opened or got window', typ);
                }
            } },
            { attr: 'viewing', label: 'binary', icon: '', click() {  // from editor            
                testBinary();
            }},

        ];

        document.body.append(crEl('div', 'sniffx').text('edit'));
        document.body.append(crEl('div', 'sniffx two').text('settings'));

        const m = qs('main div[viewer]');
        function sizeup() {
            // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth (nice illustration)
            // - does NOT include margin, border thickness, scrollbars (just inner content including padding)
            // - 0 for inline elements
            // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth
            // scrollWidth === clientWidth IF content first wothout HORIZ scrollbar

            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth
            // - includes borders, padding, vert scrollbar (if rendered) [0 if el is hidden: e.g. display none]

            // below DOES NOT take into account border thickness (if any)

            const outside = m.offsetWidth,
                  inside = m.clientWidth, // also m.scrollWidth
                  scrollerWidth = outside - inside;
            attr('visible-scrollbar@body', scrollerWidth > 0);
        }
        on('resize', window, sizeup);
        sizeup(); // first time

        var typ;

        addTools(toolbox, tools);

        function addTools(tb, tools) {
            for (const tool of tools) {
                tb.append(tooltip(crEl('button', ...tool.attr.split(' '), tool.click).add(tool.label), {
                    html: 'click to ' + (tool.tt || tool.label),
                    placement: 'right', // default is 'top'
                }));
            }
        }

        const events = new EventEmitter();
        const editor = whichEditor(preferedEditor, isText).create(events, editingArea);
        // .then(edt => {
        //     edt.create(events, editingArea); MAKE THIS A Promise...
        //     return edt;

        //     or must be await...
        // });

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
        events.on('changes-pending', () => {
            attr('pending-changes@body', changesPending = true);


            if (typ) {
                typ.postMessage({html: editor.getPrettyHtml()}, '*');
            }
        })

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
            //log('saving content', updatedContent, ';')
            post(`/save-document${doc}`, updatedContent)
                .then(resp => {
                    log('1st back', resp)//.data);
                    return resp.json();
                })
                .then(newDoc => {
                    log('2nd x', newDoc);

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
                            refreshViewer(docInfo = newDoc); // manually: WHY A NEW DOC??? 
                    }
                })
                .catch(err => log.error('NOT SAVED', err)); // do nothing to UI?
        }
    }

    displayMode('viewing'); // to start
    //attr('loading@body', false); // now ready
    showPage(pageTitle);//doc + '😊'); // 'hi fweddy!!! 😊😊 🔒 🔐 🔓  🛡️'; // use lock char if locked
}

// main initialization
onReady(() => {

    if (window.opener) {
        return appFor2ndWindow();
    }

    log('in main window')

    // unicode: https://unicode-table.com/en/
    // unicode: https://www.rapidtables.com/code/text/unicode-characters.html

    // which document?
    const doc = qs('meta[name=document]').content;

    // get it...
    // ACTUALLY, gets document META; 
    //  - if a text document, actual content in .raw
    //  - if not text (i.e. bimary), actual bits kept at .url
    //      - .url to be used as needed by contentEditor

    // x-editor         rich-editor
    // x-format         binary/not
    // content-type     file-type/binary.locked/application.json


    fetch(`/get-document${doc}`)
        .then(async resp => {
            if (resp.ok) {
                // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Body
                const [status, textOrBinary, editor] = (resp.headers.get('x-document') || '').split(';'),
                      isLocked = status === 'locked',
                      isOpen = !isLocked,
                      isText = textOrBinary === 'text',
                      isBinary = !isText;
                return { 
                    doc,
                    editor,
                    isText,
                    isLocked,
                    bytes: isLocked || isBinary ? await resp.arrayBuffer() : null,
                    text: isOpen && isText ? await resp.text() : null,
                }
            }
            else { // likely 404 or 500
                return resp.json();
            }
        }) 
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

function appFor2ndWindow() {

    // todo: ask not for /app.html but for /preview/document-file-name

    // lots of cpu so if win closed, should stop
    // also, do convertion to html separately, then pass updates to window
    // - check if already in process, then wait until done (if user typing fast!)

    log('in 2nd window');
    log('helloe', window.opener);

    window.opener.postMessage({kql:123}, '*');
    
    window.addEventListener('message', onMsg);
    
    var ctn = 10;
    
    function onMsg(e) {
        console.log('got e', e.origin, e.data, ';', qs('div[viewer]'));
        
        if (e.data.html)
            qs('div[viewer]').innerHTML = e.data.html;
    
        setTimeout(() => {
            window.opener.postMessage({kql:123 + ctn++}, '*')
        }, 3000);
    }    
}