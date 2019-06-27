import { crEl, loadCSS, loadSCRIPT, log, sleep, qs, qsa, toggleAttr, attr, byTag, copyToClipboard, on, tooltip, asyncFeature } from '../app-utils.js';

// example of an externally loaded editor

// SERIOUSLY GOOD SVG source of icons: https://www.onlinewebfonts.com/icon & https://www.onlinewebfonts.com/icon/packs
// no more need to "create" icon images: use EITHER of UNICODES (as plain text) or SVG images/icons
// for svg: can change css FILL color (pen color)
// from https://www.onlinewebfonts.com/icon can also get:
// - <img src="data:image/svg+xml;base64,CjxpbWcgc3R5bGU9...pc3RlciI+CiAg" width="128" height="128">

// https://unicode-search.net/unicode-namesearch.pl?term=LOCK
// https://www.fileformat.info/info/unicode/char/1f512/index.htm


// METHOD to connect CSS events and javascript: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/animationend_event
// other methods? that's pretty powerful!
// - yes! https://developer.mozilla.org/en-US/docs/Web/Events#CSS_Animation_events
// - AND: https://developer.mozilla.org/en-US/docs/Web/Events#CSS_Transition_events

// LOTS of interesting events available in javascript:
// - https://developer.mozilla.org/en-US/docs/Web/Events


import {encrypt, decrypt} from './encrypt-decrypt.js'; // need .js postfix for node server to find file

function testEncDec() {
    const pwd = 'asdfas1343423^%$&$%  8756234a456345634563456dfghdfghdfsda4567(&(&*^',
        content = `this is my content `.repeat(10000);

    encrypt(content, pwd)
        .then(encrypted => {
            log('ENCRYPTED', content.length, content.substring(0, 40) + '...\n', encrypted);
            return decrypt(encrypted, pwd)// + '1')
                .then(decrypted => log('DECRYPTED back', decrypted === content, '\n', decrypted))
        })
        .catch(err => log(err.message));

    encrypt()
        .then(res => log('1ENC OK???', res))
        .catch(err => log(err.message));

    encrypt('ertwergwerg34')
        .then(res => log('2ENC OK???', res))
        .catch(err => log(err.message));

    encrypt(null, 'ertwergwerg34')
        .then(res => log('3ENC OK???', res))
        .catch(err => log(err.message));

    encrypt('a ', 'ertwergwerg34')
        .then(res => {
            log('4ENC OK???', res.length, res);
            decrypt(res, 'ertwergwerg34')
                .then(res => log('1DEC - B OK??? [' + res + ']', res.length))
                .catch(err => log('WHoper', err.message));
        })
        .catch(err => log(err.message));
    //
    decrypt()
        .then(res => log('1DEC OK???', res))
        .catch(err => log(err.message));

    decrypt('ertwergwerg34')
        .then(res => log('2DEC OK???', res))
        .catch(err => log(err.message));

    decrypt(null, 'ertwergwerg34')
        .then(res => log('3DEC OK???', res))
        .catch(err => log(err.message));
}

//testEncDec();

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
// Your Tiny Account includes access to Tiny Drive, our file and image management service, 
// with a complimentary 100 MB of storage and 1 GB of bandwidth per month.  For more information about Tiny Drive, 
// please see the Developer Guide and documentation.
// Ephox Corporation DBA Tiny Technologies, Inc
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

        //https://www.tiny.cloud/docs/configure/content-filtering/#element_format
        element_format : 'html',

        //content_css: '/a url here - e.g. /editors/rich-editor.css',
        content_style: `[fs-hidden] { display: none; }`,

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
        toolbar: 'filteringSearchButton | searchreplace | undo redo | formatselect | styleselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',

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

            // unique because we'll use this to identify this button later
            // HACK: since tinymce does NOT give us any means to target a particular button
            const UNIQUE_TEXT = 'use filtering search mode';

            const btnx = () => btn || qs(`button[title='${UNIQUE_TEXT}']`); // where we use the HACK
            var btn, inp;//, filterSearching = false;

            editor.ui.registry.addToggleButton('filteringSearchButton', {
                //text: '&#x2295; filter', // REQUIRED (even if empty) else display issues from tinymce when missing
                text: 'filter', // REQUIRED (even if empty) else display issues from tinymce when missing

                // https://stackoverflow.com/questions/54865771/mce5-how-to-put-any-image-as-custom-button-icon-in-tiny-mce-5
                image: '/custom url here', // then target this button to add <img> tag there

                // todo: for icon, need a filter-like icon (search icon is same as search & replace)
                icon: 'search', // from https://community.tiny.cloud/communityQuestion?id=90661000000IgnsAAC
                // required to be replaced below: use better/simpler technique (e.g. just the title text bit)



                tooltip: UNIQUE_TEXT,//'filtering',
                onSetup(e) {
                    btn = btnx();
                    if (btn && !inp) {
                        attr('title', btn, 'filter search');
                        inp = crEl('input', 'filtering-search-term');
                        on('keyup', inp, e => {
                            //ttp=true;
                            // e.preventDefault();
                            // e.stopImmediatePropagation();
                            filterDoc(editor.getBody(), inp.value);
                        });
                        on('keydown', inp, e => {
                            if (e.code === 'Space') {
                                // do NOT prevent default (want it for input)
                                // BUT stop proagation else tinymce will interpret 
                                // it as a toolbar button click
                                e.stopImmediatePropagation(); 
                            }
                        });
                        on('click', inp, e => {
                            e.stopImmediatePropagation(); 
                        })
                        btn.append(inp);    

                        const icon = qs('svg', btn);
                        //log('icon', icon, icon.parentElement);
                        const par = icon.parentElement;

                        const iconUrl = `/editors/icon-edit.svg`;//`/editors/icon-bland-person.svg`; // '/editors/icon-filter-search.2.svg'
                        fetch(iconUrl)
                            .then(resp => resp.text()).then(svgIcon => {
                                // yey! node returned proper 'image/svg+xml' content type (how???)
                                //const svgIcon = resp.text();
                                //log('got svr icon?', svgIcon);
                                par.innerHTML = svgIcon;//.appendChild(svgIcon);
                                attr('width@svg', par, 24);
                                attr('height@svg', par, 24);
                            })
                            .catch(err => log('failed to get server icon', err));
                    }
                },
                onAction(api) {
                    api.setActive(!api.isActive());
                    const filterSearching = api.isActive();
                    log('sss', filterSearching);//api.isActive());
                    // log('got action', e, ttp);
                    // if (ttp) {return;}
                    //filterSearching = !filterSearching;
                    attr('filter-searching', btn, filterSearching)
                    if (filterSearching) {
                        inp.focus();
                        filterDoc(editor.getBody(), inp.value)
                    } 
                    else 
                        filterDoc(editor.getBody(), '');// : inp.blur();
                }
            });   

            //var ttp = false;
            
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
                log('btn0', btnx());
            })

        },
    });       
    return api; 
}

function allKids(el) {
    return el.children;
}

function filterDoc(doc, searchText, {exactMatch = false, hideAttr = 'fs-hidden'} = {}) { 

    // FS-HIDDEN does NOT work as an attribute (ignored: iFrame issue?)
    // - add CSS stylesheet to doc?

    // see for reference: https://bitbucket.org/frudman/my-tidbits/src/master/server-app/assets/tiny-app.es6
    // - grepDocument() function
    exactMatch || (searchText = searchText.toLowerCase());
    searchText = searchText.replace(/\s+/g, ' ');

    // case insensitive (or not === exact match): create regexp or .toLowerCase()?
    // - regexp may be slower: https://stackoverflow.com/questions/4757438/javascript-indexof-vs-match-when-searching-strings
    // - but more possibilities (typos, near-letters)
    // important: innerText or textContent? (would taht include <tags>)
    // - https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent#Differences_from_innerText
    //const containText = el => exactMatch ? el.innerText.indexOf(text) !== -1 : el.innerText.toLowerCase().indexOf(text);

    //todo: trim multi spaces into single (or none?)
    function containText(el) {
        const txt = el.textContent.replace(/\s+/g, ' ');
        //exactMatch || (txt = txt.toLowerCase());
        return exactMatch ? txt.indexOf(searchText) !== -1 : txt.toLowerCase().indexOf(searchText) !== -1;
    }

    // todo: flag marked/found words in tinymce: HARD (select range, then format that)

    function makeSectionVisible(el) {
        // self
        if (el.nodeType === 1)
            attr(hideAttr, el, false); // display

        // next:
        //        qsa(`[${hideAttr}]`, doc).forEach(el => attr(hideAttr, el, false));

        // children
        for (const sub of el.childNodes) 
            makeSectionVisible(sub);
    }

    function hideSection(el) {
        if (el.nodeType === 1)
            attr(hideAttr, el, true); // display
    }

    var skipUntilHeaderN = 0;
    function filterNestedNode(el) {
        log('x', el.nodeType, ';', el.nodeName, ';', el.textContent.substring(0, 50)); // ALL content (whether visible or not); NO <TAGS>

        const nodeTag = el.nodeName.toLowerCase(),
              isHeader = /^h[1-6]$/i.test(nodeTag),
              headerLevel = isHeader && parseInt(nodeTag[1]),
              isTable = /^table$/i.test(nodeTag),
              isList = /^ul|ol$/i.test(nodeTag),
              // below based on: https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
              isNestedBlockElement = /^article|aside|dl|div|header|footer|main|section|body|p$/i.test(nodeTag); // or .children.length > 0?

        if (skipUntilHeaderN) {
            if (isHeader && headerLevel <= skipUntilHeaderN) {
                // reached same (or higher) section header so done skipping...
                skipUntilHeaderN = 0; // ...will also continue below
            }
            else {
                makeSectionVisible(el);
                return; // move on to next sibling
            }
        }                  

        if (containText(el)) {
            // first make everything visible to start (in case had been hidden previously)
            makeSectionVisible(el);

            if (isHeader) {
                skipUntilHeaderN = headerLevel;
            }
            else if (isTable) { // only consider full rows 
                // for simplicity, below will consider ALL TRs, incl. nested ones: oh well...
                //$('tr', el).each((i,elx) => setNodeVisibility(elx));
                qsa('tr', el).forEach(filterNestedNode);//elx => filterNestedNode(elx));
            }
            else if (isList) { // only consider full items
                //$('li', el).each((i,elx) => setNodeVisibility(elx));
                qsa('li', el).forEach(filterNestedNode);//elx => filterNestedNode(elx));
            }
            else { //if (isNestedBlockElement) {
                // we use .contents() instead of .children() (below) as per https://api.jquery.com/contents/
                // console.log('going through kids');
                // console.group();
                //$(el).contents().each((i,elx) => filterNestedNode(elx));
                for (const c of el.children)//childNodes)
                    filterNestedNode(c);
                // console.groupEnd();
            }
            // else { // consider all other elements as single block: display all or nothing
            //     //console.log('...all or nothing');
            //     log('NOT SURE WHY HERE???', el);//setNodeVisibility(el);
            // }                
        }
        else
            hideSection(el);//attr(hideAttr, c, !contains);
        //}
    }

    
    if (searchText.length) {
        filterNestedNode(doc);//c);
    }
    else { // no more filtering
        qsa(`[${hideAttr}]`, doc).forEach(el => attr(hideAttr, el, false));
        // could also makeSectionVisible(doc); // faster? slower?
    }
}

function grepDocument(editor, filterText, useExactMatch) {

    // COPIED FROM: https://bitbucket.org/frudman/my-tidbits/src/master/server-app/assets/tiny-app.es6

    searchMode = 'filtering';

    if (!editor) return; // trivial validation
    const docNode = editor.dom.select('body')[0]; // edited content (an html node)

    // trivial validation
    filterText = (filterText || '').trim();
    if (!filterText) {
        makeSectionVisible(docNode); // no filter text so everything visible
        editor.selection.getNode().scrollIntoView(); // important! in case user clicked where they want to end up
        return;
    }

    const [filterPat, maxLikelyMatchedLen] = genSearchPat(filterText, useExactMatch, false); // filterPat is a regular expression

    function setNodeVisibility(el) {
        const content = el.textContent,
              containsText = filterPat.test(content);
        // if (el.nodeName === 'STRONG') {
        //     console.log('setting visi', filterPat, el, el.textContent, containsText);
        // }
        containsText ? makeSectionVisible(el) : hideSection(el);
    }
    
    // once we hit a relevant header (i.e. that contains filter text), skip all its subsequent 
    // siblings until the next header of that or higher level (i.e. a lower number)
    var skipUntilHeaderN = 0; // 0 means not skipping for now

    function filterNestedNode(el) {
        const nodeType = el.nodeType;

        // if (nodeType !== HTML_TAG_NODE) {
        //     if (nodeType !== COMMENT_NODE && el.nodeValue.length > 1)
        //         // TBV: can we assume that ALL text is inside an html tag-node?
        //         // TBV: can this occur in tinymce? 
        //         // - maybe if editing code directly within tinymce...
        //         console.log('WHOOPS', nodeType, el.nodeName, el.nodeTag, el); 
        //     return; // skip it for now
        // }

        function tc(xel) {
            return xel.nodeName + '(' + xel.nodeType + ')=[[' + (xel.textContent || '[empty]').substr(0, 60) + ']]';
        }

        const nodeTag = el.nodeName.toLowerCase(),
              isHeader = /^h[1-6]$/i.test(nodeTag),
              headerLevel = isHeader && parseInt(nodeTag[1]), // lower number is higher level
              isTable = /^table$/i.test(nodeTag),
              isList = /^ul|ol$/i.test(nodeTag),
              // below based on: https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
              isNestedBlockElement = /^article|aside|dl|div|header|footer|main|section|body|p$/i.test(nodeTag); 

        
        // todo: not sure if would be applicable for tinymce
        // dl: contains sequence of [dt followed-by dd]
        // treated as single flow: address|blockquote|figcaption|figure|
        // treated as for html pages only: details|dialog|fieldset|footer|form|

        // TODO: all HTML elements (e.g. form, fieldset) COULD be available from tinymce
        //       documents since users CAN edit the underlying code directly
        //       - not sure what that means for 'filtering' displayed output (maybe just ignore
        //         since not a realistic/intended use-case for filtering)

        if (skipUntilHeaderN) {
            if (isHeader && headerLevel <= skipUntilHeaderN) {
                // reached same (or higher) section header so done skipping...
                skipUntilHeaderN = 0; // ...will also continue below
            }
            else {
                makeSectionVisible(el);
                return; // move on to next sibling
            }
        }
            
        const containsText = filterPat.test(el.textContent); // see if filter text is there at all

        //console.log('looking at node', filterPat, containsText, tc(el));

        if (containsText) {
            //console.log('FOUND', filterPat, tc(el));

            // first make everything visible to start (in case had been hidden previously)
            makeSectionVisible(el);

            if (isHeader) {
                skipUntilHeaderN = headerLevel;
            }
            else if (isTable) { // only consider full rows 
                // for simplicity, below will consider ALL TRs, incl. nested ones: oh well...
                $('tr', el).each((i,elx) => setNodeVisibility(elx));
            }
            else if (isList) { // only consider full items
                $('li', el).each((i,elx) => setNodeVisibility(elx));
            }
            else if (isNestedBlockElement) {
                // we use .contents() instead of .children() (below) as per https://api.jquery.com/contents/
                // console.log('going through kids');
                // console.group();
                $(el).contents().each((i,elx) => filterNestedNode(elx));
                // console.groupEnd();
            }
            else { // consider all other elements as single block: display all or nothing
                //console.log('...all or nothing');
                setNodeVisibility(el);
            }
        }
        else { // text not contained in this node or any of its children
            //console.log('NOT found', filterPat, filterPat.test(el.textContent), tc(el));//.textContent);
            hideSection(el);
        }
    }

    filterNestedNode(docNode);

    //editor.selection.getNode().scrollIntoView(true); // important!
}