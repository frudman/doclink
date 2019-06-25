import { crEl, loadCSS, loadSCRIPT, log, sleep, qs, qsa, toggleAttr, attr, byTag, copyToClipboard, on, tooltip, asyncFeature } from '../app-utils.js';

// example of an externally loaded editor

loadCSS.fromUrl('/editors/rich-editor.css');

const richEditor = asyncFeature(api => api); // placeholder just returns base api

const tinymceDevKey = `ywsghysw0uf8a1huyfwi6pl38xy8165zroth5g5tpout3ead`; // `no-api-key`; developer key
const EDITOR_CDN = `https://cdn.tiny.cloud/1/${tinymceDevKey}/tinymce/5/tinymce.min.js`;
// tinymce account: g5/frudman; https://apps.tiny.cloud/my-account/api-key-manager/
// right now: for localhost only; MUST add actual domains (for some reason)
// ALSO, is there a limit for number of downloads?
// ALSO, can we just download from out own server?
// There is a SEPARATE(?) COMMUNITY for tinymce: https://community.tiny.cloud/
// get info and downloads(?) from there (tinymce keeps pushing us to their corporate/cloud parts)
// - yes, at: https://www.tiny.cloud/get-tiny/self-hosted/ (5.0.8 as of jun 25, 2019)
// - maybe not: https://www.tiny.cloud/pricing (check both cloud AND self-hosted: per SERVER!!!)
//const EDITOR_CDN = `https://cdnjs.cloudflare.com/ajax/libs/tinymce/5.0.6/jquery.tinymce.min.js`; // good url but error loading tinymce (tbi)
loadSCRIPT.fromUrl(EDITOR_CDN) 
    .then(x => {//sleep(0).then(() => { // fake a delay in loading
        richEditor.ready(makeItTiny); //dox();
    })//)
    .catch(err => log('whoops getting editor [' + EDITOR_CDN + ']', err)); 

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

export default function createRichHtmlEditor(events, editingAreaEl) {

    // need to return an editor always

    const ta = crEl('textarea', 'richly-editor'); 
    editingAreaEl.append(ta); 

    // content formatted for display <div rich-document>...</div>    
    const asHtml = crEl('div', 'rich-document'); // single/root node returned for display
    
    on('keydown', ta, () => events.emit('changes-pending')); // keeping it simple

    const api = {
        events,ta,asHtml,

        // REQUIRED: doc is always OBJECT returned from server
        setDoc(doc) {log('BASEedt', doc); ta.value = api.originalContent = doc.raw; }, // 

        // REQUIRED: returned content is EITHER a 'string' OR an object (e.g. { tmpSavedUrl: '3245234523452345234', svrToken: '23452345234' }
        // - to be processed accordingly at server (must detect if string or object)
        getContent() { return ta.value; }, // maybe always an object? so can include a server-token (1-to validate + 2-original source to see if changed)

        // REQUIRED: can return:
        // - 'string' (updated at caller everytime), or 
        // - dom element/node (updated at caller only if root node different from previous)
        // - allows editor to perform its own updates, async from rest of app
        // - IF RETURN a NODE/element, must be a SINGLE CHILD (i.e. a root kid)
        getPretty() { 
            //toHtml(asHtml, ta.value); }, 
            return ta.value; 
        },
        getPrettyHtml() { // ALWAYS a string to be displayed in a SEPARATE window (so no htmlelement or events/listeners)
            //toHtml(asHtml, ta.value);
            return ta.value;//asHtml.innerHTML;
        }, 

        // optional: to know that changes have been canceled
        // - if missing, setContent will be called instead (with same content)
        resetContent() { ta.value = api.originalContent; },

        // optional: to let us know that current is now new baseline
        // - if missing, ???
        // must BOTH be present if either is??? to be enforced by app
        savedContent() { api.originalContent = ta.value; },
    };

    log('created xedt', api, api.setDoc);
    return richEditor(api);
}

function makeItTiny(api) {
    log('making it tiny', api);
    const {events, ta, asHtml} = api;
    tinymce.init({
        // configuration settings: https://www.tiny.cloud/docs/configure/integration-and-setup/
        target: ta, //selector:'[richly-editor]',

        // toolbar controls: https://www.tiny.cloud/docs/advanced/editor-control-identifiers/

        // settings for editor UI: https://www.tiny.cloud/docs/configure/editor-appearance/
        block_formats: 'Paragraphx=p; Header 1=h1; Header 2=h2; Header 3=h3',
        //contextmenu: "link image imagetools table spellchecker",
        //custom_ui_selector: 'button[save]',// button[cancel]',  ?????
        //fixed_toolbar_container, //https://www.tiny.cloud/docs/configure/editor-appearance/#fixed_toolbar_container
        // https://www.tiny.cloud/docs/configure/editor-appearance/#font_formats
        // - also fontsize_formats

        // inline editing (also distraction free)
        // - https://www.tiny.cloud/docs/configure/editor-appearance/#inline

        // MENU: https://www.tiny.cloud/docs/configure/editor-appearance/#menu
        // - also menubar: https://www.tiny.cloud/docs/configure/editor-appearance/#menubar
        menubar: false, // no file, edit, view format, ...

        //https://www.tiny.cloud/docs/configure/editor-appearance/#quickbars_insert_toolbar
        // - also quickbars_selection_toolbar

        statusbar: false, // same as css: div[editor] div.tox-statusbar { display: none; }

        // https://www.tiny.cloud/docs/configure/editor-appearance/#style_formats
        // - can customize styles (e.g. for a site)

        // https://www.tiny.cloud/docs/configure/editor-appearance/#style_formats_autohide
        style_formats_autohide: true,

        plugins: [
            'advlist autolink lists link image charmap print preview anchor textcolor',
            'searchreplace visualblocks code fullscreen',
            'insertdatetime media table paste code help wordcount'
          ],

        // https://www.tiny.cloud/docs/configure/editor-appearance/#toolbar
        toolbar: 'searchreplace | undo redo | formatselect | styleselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',

        // FOR SEARCH: copy svg element from tinymce: 
        // <svg width="24" height="24"><path d="M16 17.3a8 8 0 1 1 1.4-1.4l4.3 4.4a1 1 0 0 1-1.4 1.4l-4.4-4.3zm-5-.3a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" fill-rule="nonzero"></path></svg>

        // https://www.tiny.cloud/docs/configure/editor-appearance/#toolbar_drawer
        toolbar_drawer: 'sliding',//'floating',

        // https://www.tiny.cloud/docs/configure/spelling/#browser_spellcheck
        browser_spellcheck: true,

          content_css: [
            '//fonts.googleapis.com/css?family=Lato:300,300i,400,400i',
            '//www.tiny.cloud/css/codepen.min.css'
          ],

        setup(editor) {
            // similar to init_instance_callback(editor)
            editor.on('Change', () => events.emit('changes-pending'));         
            editor.on('KeyDown', () => events.emit('changes-pending'));         
            editor.on('Dirty', () => events.emit('changes-pending'));         

            editor.on('init', () => {
                log('now edited???')
                // lastly, update the api to now use tinymce
                Object.assign(api, { // update the api
                    setDoc(doc) { log('steTiny', doc); editor.setContent(api.originalContent = doc.raw); },
                    getContent() { return editor.getContent(); },
                    getPretty() { 
                        asHtml.innerHTML = editor.getContent();
                        return asHtml; // as a node
                    },
                    getPrettyHtml() { return editor.getContent(); }, // as plain text
                    resetContent() { editor.setContent(api.originalContent); },
                    savedContent() { api.originalContent = editor.getContent(); },            
                })
            })

        },
    });       
    return api; 
}
