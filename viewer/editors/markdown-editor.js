import { crEl, loadCSS, loadSCRIPT, log, sleep, qs, qsa, toggleAttr, attr, byTag, copyToClipboard, on, tooltip, asyncFeature } from '../app-utils.js';

// example of an externally loaded editor

// todo: search: based on headers, lines
// todo: open TOC on hover

// TODO: look at https://stackoverflow.com/questions/30651251/window-vs-document-documentelement-best-practices
//       look at Your Answer at bottom of page
//       for simple edit bar at top of page when editing rich
//       - leftmost: [preview] [toolbar goes here] [simple/more/help]

// BONUS: stackoverflow MARKDOWN editor: https://github.com/openlibrary/wmd
// - AND, uses SHOWDOWN also!!!
// also read: https://stackoverflow.com/questions/2874646/which-stack-overflow-style-markdown-wmd-javascript-editor-should-i-use
// COULD: edit markdown as raw text or easy-editor


loadCSS.fromUrl('/editors/markdown-editor.css');

const toHtml = asyncFeature((asHtml, mdText) => {
    asHtml.innerHTML = `<div tmp><pre>${mdText}</pre></div>`;
    return asHtml;
})

// https://github.com/showdownjs/showdown [markdown-to-html converter]
loadSCRIPT.fromUrl('https://cdn.jsdelivr.net/npm/showdown/dist/showdown.min.js') 
    .then(x => sleep(1500).then(() => { // fake a delay in loading
        const conv = new showdown.Converter(); // from now on
        toHtml.ready((asHtml, mdText) => {
            asHtml.innerHTML = conv.makeHtml(mdText); // create basic html from markdown
            return createTOC(makeCodeBlocksClipboardCopiable(asHtml)); // add toc and clickable code blocks        
        })
    }))
    .catch(err => log('whoops getting showdown', err)); 

// based on: https://benweet.github.io/stackedit.js/    
// <script src="https://unpkg.com/stackedit-js@1.0.7/docs/lib/stackedit.min.js"></script>    
const stackEditor = new Promise((resolve,reject) => {
    loadSCRIPT.fromUrl(`/editors/stackeditor.js`)//https://unpkg.com/stackedit-js@1.0.7/docs/lib/stackedit.min.js`)
        .then(x => {
            resolve();
        })
        .catch(err => log('WYSIWYG loading error', err)); 
});

// https://cdn.jsdelivr.net/gh/benweet/stackedit.js/
// https://cdn.jsdelivr.net/gh/benweet/stackedit.js@1.0.7/docs/lib/stackedit.min.js

// https://github.com/openlibrary/wmd


if (false) {
// https://github.com/StackExchange/pagedown
// https://www.jsdelivr.com/package/npm/pagedown
// https://cdn.jsdelivr.net/npm/pagedown/
// read: https://gomakethings.com/how-to-turn-any-github-repo-into-a-cdn/
// based on: https://cdn.jsdelivr.net/gh/{username}/{repo}/ to turn github projects into CDNs
// - https://cdn.jsdelivr.net/gh/StackExchange/pagedown/ (note trailing slash)
// NOTE: may also want to get wmd-buttons.png
// HOW TO USE: https://code.google.com/archive/p/pagedown/wikis/PageDown.wiki (old but only instructions I found)

// https://github.com/StackExchange/pagedown/blob/master/demo/browser/demo.html
const pagedownCDN = `https://cdn.jsdelivr.net/gh/StackExchange/pagedown`;
var editor;
var ready = false;
loadCSS.fromUrl('/editors/pagedown-styles.css');
loadSCRIPT.fromUrl(`${pagedownCDN}/Markdown.Converter.js`, // based on showdown apparently
                    `${pagedownCDN}/Markdown.Sanitizer.js`,
                    `${pagedownCDN}/Markdown.Editor.js`) // NOT available at unpkg.com or regular jsdelivr.com/npm/...
    .then(x => {
        log('WYSIWYG loaded', Markdown.Converter);
        var converter = Markdown.getSanitizingConverter();
        log('conv', converter);

        editor = new Markdown.Editor(converter)
        log('editor', editor);
        ready && editor.run();

        // #wmd-button-bar, #wmd-input, and #wmd-preview
    })
    .catch(err => log('WYSIWYG loading error', err)); 
}


const assignRandomId = (prefix = 'rnd-') => prefix + Math.random().toString().substring(2) + Date.now();

function createTOC(htmlEl, startCollapsed = true, min = 2, max = 3) {

    // skip headers not between min & max (e.g. only from h2 to h3)

    // todo: setting to ignore headers without IDs (or other criteria) - need???

    var tocHtml = '';
    const hSelector = [...Array(max-min+1).keys()].map(i=>'h'+(min+i)).join(',');
    const sections = [];

    qsa(hSelector, htmlEl).forEach(el => {

        sections.push(el);

        const num = parseInt(el.tagName.substring(1));
        if (num >= min && num <= max) {
            el.id || (el.id = assignRandomId('header-toc-'));
            tocHtml += `<a toc-${num - min} href="#${el.id}">${el.innerText}</a>`;
        }

        // need to add to el
        el.collapse = flag => {
            isCollapsed = flag;

            // note using . nextElementSibling NOT .nextSibling because we want to SKIP #text/#comment nodes; 
            // - as per: https://www.w3schools.com/jsref/prop_node_nextsibling.asp
            // - also: https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
            // also: https://developer.mozilla.org/en-US/docs/Web/API/Node/nextSibling
            // also: https://developer.mozilla.org/en-US/docs/Web/API/NonDocumentTypeChildNode/nextElementSibling
            // - BUT doesn't seem to work! we [seem to] get #text nodes anyway!!!
            // - it's ok because attr() will account for this (and ignore those calls)

            var sib = el.nextElementSibling; 
            while (sib && !isHigherHeader(sib)) {
                attr('collapsed', sib, isCollapsed);
                sib = sib.nextSibling;
            }
        }

        var isCollapsed = false;
        const isHigherHeader = el => /h\d/i.test(el.tagName) && (parseInt(el.tagName.substring(1)) <= num);

        //tooltip(el, {text:'click to collapse or expand this section', placement: 'top'})
        attr('title', el, 'click to collapse or expand section');
        on('click', el, () => el.collapse(!isCollapsed));
        // {
        //     isCollapsed = !isCollapsed;

        //     // note using . nextElementSibling NOT .nextSibling because we want to SKIP #text/#comment nodes; 
        //     // - as per: https://www.w3schools.com/jsref/prop_node_nextsibling.asp
        //     // - also: https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
        //     // also: https://developer.mozilla.org/en-US/docs/Web/API/Node/nextSibling
        //     // also: https://developer.mozilla.org/en-US/docs/Web/API/NonDocumentTypeChildNode/nextElementSibling
        //     // - BUT doesn't seem to work! we [seem to] get #text nodes anyway!!!
        //     // - it's ok because attr() will account for this (and ignore those calls)

        //     var sib = el.nextElementSibling; 
        //     while (sib && !isHigherHeader(sib)) {
        //         attr('collapsed', sib, isCollapsed);
        //         sib = sib.nextSibling;
        //     }
        // })
    });

    if (tocHtml) {
        // create it
        const tocEl = crEl('div', 'toc', 'is-collapsed').html(`<h2>table of content</h2>${tocHtml}<a collapse-expand-all>collapse all</a>`);

        // give it help tip
        tooltip('h2', tocEl, {html: 'click to show/hide<br>table of content', placement: 'left'});
    
        // make toc collapsable/expandable
        on('click@h2', tocEl, () => toggleAttr('is-collapsed', tocEl));

        // make doc sections collapsable/expandable
        var allCollapsed = false;
        on('click@a[collapse-expand-all', tocEl, e => {
            e.target.text = (allCollapsed = !allCollapsed) ? 'expand all' : 'collapse all';
            sections.forEach(h => h.collapse && h.collapse(allCollapsed));
        })
    
        // add it
        htmlEl.prepend(tocEl);
    }

    return htmlEl;
}

function makeCodeBlocksClipboardCopiable(htmlEl) {

    for (const el of byTag('code', htmlEl)) {
        tooltip(el, 'click to copy to clipboard (ctrl-c)');
        on('click', el, e => copyToClipboard(e.target.innerText, e.target))
    }

    return htmlEl;
}

//export default 
function createMarkdownEditorx(events, editingAreaEl) {

    // based on: https://github.com/StackExchange/pagedown/blob/master/demo/browser/demo.html

    // the editor
    const ta = crEl('textarea',{id:'wmd-input', 'class': 'wmd-input'});
          
    editingAreaEl.append(ta);

    stackEditor.then(() => {
        log('WYSIWYG loaded', Stackedit);
        const stackedit = new Stackedit({
            //url: '#',///editors/stackeditor.js',//'#',
        });

        // Open the iframe
        stackedit.openFile({
            //name: 'Filename', // with an optional filename
            content: {
                text: ta.value // and the Markdown content.
            }
        });//, true);

        // Listen to StackEdit events and apply the changes to the textarea.
        stackedit.on('fileChange', (file) => {
            el.value = file.content.text;
        });

        // Listen to StackEdit events and apply the changes to the textarea.
        stackedit.on('fileChange', (file) => {
            ta.value = file.content.text;
        });

    })

    var originalContent;

    return {
        // REQUIRED: doc is always OBJECT returned from server
        setDoc(doc) { ta.value = originalContent = doc.raw; }, // 

        // REQUIRED: returned content is EITHER a 'string' OR an object (e.g. { tmpSavedUrl: '3245234523452345234', svrToken: '23452345234' }
        // - to be processed accordingly at server (must detect if string or object)
        getContent() { return ta.value; }, // maybe always an object? so can include a server-token (1-to validate + 2-original source to see if changed)

        // REQUIRED: can return:
        // - 'string' (updated at caller everytime), or 
        // - dom element/node (updated at caller only if root node different from previous)
        // - allows editor to perform its own updates, async from rest of app
        // - IF RETURN a NODE/element, must be a SINGLE CHILD (i.e. a root kid)
        getPretty() { return '???'; },//toHtml(asHtml, ta.value); }, 

        // // optional: to know that changes have been canceled
        // // - if missing, setContent will be called instead (with same content)
        // resetContent() { ta.value = originalContent; },

        // // optional: to let us know that current is now new baseline
        // // - if missing, ???
        // // must BOTH be present if either is??? to be enforced by app
        // savedContent() { originalContent = ta.value; },
    }
}

export default 
function createMarkdownEditor(events, editingAreaEl) {

    // the editor
    const ta = crEl('textarea', 'markdown-editor'); 
    editingAreaEl.append(ta);

    // keeping it simple
    on('keydown', ta, () => events.emit('changes-pending')); 

    // content formatted for display <div md-doc>...</div>
    const asHtml = crEl('div', 'md-doc'); // single/root node returned for display

    // optionals are to allow for dom performance optimizations: 
    // - e.g. if editor is heavy on dom code, can create once and self update thereafter
    // - else (i.e. if passing strings back), new dome nodes created/destroyed each time

    var originalContent;

    return {
        // REQUIRED: doc is always OBJECT returned from server
        setDoc(doc) { ta.value = originalContent = doc.raw; }, // 

        // REQUIRED: returned content is EITHER a 'string' OR an object (e.g. { tmpSavedUrl: '3245234523452345234', svrToken: '23452345234' }
        // - to be processed accordingly at server (must detect if string or object)
        getContent() { return ta.value; }, // maybe always an object? so can include a server-token (1-to validate + 2-original source to see if changed)

        // REQUIRED: can return:
        // - 'string' (updated at caller everytime), or 
        // - dom element/node (updated at caller only if root node different from previous)
        // - allows editor to perform its own updates, async from rest of app
        // - IF RETURN a NODE/element, must be a SINGLE CHILD (i.e. a root kid)
        getPretty() { return toHtml(asHtml, ta.value); }, 
        getPrettyHtml() { 
            toHtml(asHtml, ta.value);
            return asHtml.innerHTML;
        }, 

        // optional: to know that changes have been canceled
        // - if missing, setContent will be called instead (with same content)
        resetContent() { ta.value = originalContent; },

        // optional: to let us know that current is now new baseline
        // - if missing, ???
        // must BOTH be present if either is??? to be enforced by app
        savedContent() { originalContent = ta.value; },
    }
}
