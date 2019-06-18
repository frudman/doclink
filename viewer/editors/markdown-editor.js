import { crEl, loadCSS, loadSCRIPT, log, sleep, qs, qsa, toggleAttr, attr, byTag, copyToClipboard, onEvt } from '../app-utils.js';

// example of an externally loaded editor

// headers: collapse & stuff; collapse all; expand all
// - how to collapse! all elements until next header of that or higher

// search: based on headers, lines


// todo: add back-to-top href=# (maybe also #top) [or just document.body.scrollTop = document.documentElement.scrollTop = 0;]
// - https://www.w3schools.com/howto/howto_js_scroll_to_top.asp
// - https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#Attributes (under href: see note)

loadCSS.fromUrl('/editors/markdown-editor.css');

var converterReady = false;
const onConverterReady = [];
const toHtml = txt => converterReady ? converterReady.makeHtml(txt) : `<div tmp><pre>${txt}</pre></div>`; 

// https://github.com/showdownjs/showdown [markdown-to-html converter]
loadSCRIPT.fromUrl('https://cdn.jsdelivr.net/npm/showdown/dist/showdown.min.js') 
    .then(x => {
        log('got x', x, x.target, x.path, x.target.innerText);
        sleep(1500).then(() => { // fake a delay in loading
            converterReady = new showdown.Converter(); // from now on
            while (onConverterReady.length) 
                onConverterReady.pop()(); // update early birds
        });
    }); 

const assignRandomId = (prefix = 'rnd-') => prefix + Math.random().toString().substring(2) + Date.now();

function createTOC(htmlEl, startCollapsed = true, min = 2, max = 3) {

    // skip headers not between min & max (e.g. only from h2 to h3)

    // todo: setting to ignore headers without IDs (or other criteria) - need?

    var tocHtml = '';


    qsa('h1,h2,h3,h4,h5,h6', htmlEl).forEach(el => {
        const num = parseInt(el.tagName.substring(1));
        if (num >= min && num <= max) {
            el.id || (el.id = assignRandomId('header-toc-'));
            tocHtml += `<a toc-${num - min} href="#${el.id}">${el.innerText}</a>`;
        }

        var isCollapsed = false;
        const isHigherHeader = el => /h\d/i.test(el.tagName) && parseInt(el.tagName.substring(1)) <= num;

        attr(el, 'title', 'click to collapse');
        el.addEventListener('click', () => {
            log('i b clicked', el);
            isCollapsed = !isCollapsed;

            // NOT .nextSibling; want to SKIP #text/#comment nodes; 
            // - read: https://www.w3schools.com/jsref/prop_node_nextsibling.asp
            // - also: https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
            var sib = el.nextElementSibling; 
            while (sib) {
                if (isHigherHeader(sib)) {
                    break; // we're done
                }
                else {
                    attr(sib, 'collapsed', isCollapsed);
                    sib = sib.nextSibling;
                }
            }
        })
    });

    if (tocHtml) {
        const tocEl = crEl('div', 'toc', true ? 'is-collapsed' : '');
        tocEl.innerHTML = `<h2>table of content</h2>${tocHtml}`;
    
        // make hideable
        qs('div[toc] h2', tocEl).addEventListener('click', () => toggleAttr('is-collapsed', tocEl))//@div[toc]'))
        //log('qxz', qs('div[toc] h2', tocEl), tocEl);
    
        htmlEl.prepend(tocEl);
    
        log('created TOC', tocEl);    
    }

    return htmlEl;
}

function makeCodeBlocksClipboardCopiable(htmlEl) {

    for (const el of byTag('code', htmlEl)) {
        attr(el, 'title', 'click to copy to clipboard (ctrl-c)');
        onEvt('click', el, e => copyToClipboard(e.target.innerText))
    }

    return htmlEl;
}

export default function createMarkdownEditor(events, editingAreaEl) {

    // the editor
    const ta = crEl('textarea', 'markdown-editor'); 
    editingAreaEl.append(ta);

    // keeping it simple
    onEvt(ta, 'keydown', () => events.emit('changes-pending')); 

    // content formatted for display <div md-doc>...</div>
    const asHtml = crEl('div', 'md-doc'); // single/root node returned for display

    const getPretty = () => {
        
        const fancyMe = () => {
            asHtml.innerHTML = toHtml(ta.value); // create basic html from markdown
            return createTOC(makeCodeBlocksClipboardCopiable(asHtml)); // add toc and clickable code blocks
        }

        converterReady || onConverterReady.push(fancyMe);
        return fancyMe(); // returns an html node (not a string)
    }

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
        getPretty, 

        // optional: to know that changes have been canceled
        // - if missing, setContent will be called instead (with same content)
        resetContent() { ta.value = originalContent; },

        // optional: to let us know that current is now new baseline
        // - if missing, ???
        // must BOTH be present if either is??? to be enforced by app
        savedContent() { originalContent = ta.value; },
    }
}
