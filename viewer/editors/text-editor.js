import { crEl, loadCSS, log } from '../app-utils.js';

// example of a very simple text editor

// for a binary editor, use .url instead of .raw
// on uploads BEFORE SAVE, getContent returns a tmpUrl; on save, when .setCOntent called, new url is there (maybe changed)

/*
    for binaries (e.g. images)

    - drop a new file to edit it
        - this uploads it right away as /tmp-save
            - and gets back a temprary url
            - now mark as changes pending
    - changes-pending triggers request for prettyContent
        - send back new tag with tmp url: 
            - e.g. <img src=tmp-url>
    - on cancel, send back previous tags
    - on save, will want .getContent()
        - MUST send back an OBJECT, not a string/text
            - object must include doc, original url, last tmp saved url



*/

// raw or fancy; if raw, wrap lines or not

// headers: collapse & stuff

// search: based on headers, lines


loadCSS.fromUrl('/editors/text-editor.css');

export default function createTextEditor(events, editingAreaEl) {

    // the editor
    const ta = crEl('textarea'); 
    editingAreaEl.appendChild(ta);

    // keeping it simple
    ta.addEventListener('keydown', () => events.emit('changes-pending')); 

    function createHeaders(html) {
        // for text doc: anything that starts or ends with --- or === OR is underlined with --- or ===
        return html;
    }

    //const htmlEl = crEl('div', 'plain-text', { attr1:123,attr2:'abc'}).add(crEl('h2').add('text document'));
    function pretty(text) {
        const x = text.replace(/[\n]/g, '<br>'); // also --- titles ---
        return `<h2>text document:</h2><div plain-text>${x}</div>`
    }

    return {
        setContent(doc) { ta.value = doc.raw; },
        getContent() { return ta.value; },
        getPretty() { return pretty(ta.value); }
    }
}