// helpers        
export const log = console.log.bind(console); 
log.info = log; // alias
log.error = (...args) => console.error(...logArgs(args)); // different from: https://developer.mozilla.org/en-US/docs/Web/API/Console/error
log.warning = (...args) => console.warn(...logArgs(args)); // different from: https://developer.mozilla.org/en-US/docs/Web/API/Console/warn
log.record = (...args) => log('[important]', ...args); // not implemented; for permanent/cloud-based record keeping? (significant events?)

// for example: const debug = log.group('DEBUG'); (though no real need in browser-based apps, since all msgs are debug by nature)
// then: debug(...); debug.info(...); debug.error(...); debug.warning(...);
// although probably should not: debug.record(...)

// todo: add more options (e.g. display date/time)
log.category = log.group = name => {
    const groupLabel = `[${name}]:`;
    const customLogger = (...args) => log(groupLabel, ...args); // prefix all logging with group name
    customLogger.info = customLogger;
    customLogger.error = (...args) => console.error(logArgs(args, groupLabel));
    customLogger.warning = (...args) => console.warn(logArgs(args, groupLabel));
    customLogger.record = (...args) => log.record(groupLabel, ...args);
    return customLogger;
}

function logArgs(args, groupName = '') { 
    
    // used just for warn & error since first string is a "template-type %o..." string

    if (typeof args.first() === 'string') {
        const [str, parms] = fixArgs((groupName ? `${groupName} ` : ``) + args.shift())
        return [str, ...parms];
    }
    else if (args.first() instanceof Error) {
        groupName && (args.first().message = `${groupName} ` + args.first().message);
        return args;
    }
    else { // should really not be here: 1st arg should ALWAYS be either a string OR an error
        const [str, parms] = fixArgs(groupName); // oh well...
        return [str, ...parms]; 
    }

    function fixArgs(str) {
        const parms = [];
        for (const a of args) {
            if (typeof a === 'string')
                str += ' ' + a;
            else {
                // available substitutions: 
                // - https://developer.mozilla.org/en-US/docs/Web/API/console#Outputting_text_to_the_console
                str += ' %o'; // o for object
                parms.push(a);
            }
        }
        return [str, parms];
    }
}

// this is a PEEK last/first; should we rename it?
// SHOULD WE make real properties? so NOT a function (like .length)
Object.defineProperty(Array.prototype, 'last', {
    value() {
        return this.length > 0 ? this[this.length - 1] : undefined;
    }
});
Object.defineProperty(Array.prototype, 'first', {
    value() {
        return this.length > 0 ? this[0] : undefined;
    }
});


const camel = x => x.replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase());

// document: https://developer.mozilla.org/en-US/docs/Web/API/Window/document
// - Document (the type): https://developer.mozilla.org/en-US/docs/Web/API/Document
// document.documentElement: root of document (so the 'html' tag)

// used when detecting args by type (keep private)
const DOCUMENT_ELEMENTS = [HTMLElement, HTMLDocument];
const ANY_EVENT_LISTENER = [...DOCUMENT_ELEMENTS, window];

export const qs = (selector,el) => (el || document).querySelector(selector);
// todo: create a qsx: same as qs but extends result like crEl does;
// todo: qsax also?
export const qsa = (selector,el) => (el || document).querySelectorAll(selector); // use as for (const el of qsa('sel-here'))
export const spl = parts => parts.split('@'); // used for 'event-name@dom-selector' -> ['event-name', 'dom-selector']

// keeping it simple & consistent:
// - value (string or function) is always LAST element
// - if there is a selector string, it is always FIRST element
// - if [also] passing dom element, it is always AFTER selector (if any), and always BEFORE value

/* Philosophy: use attribute names instead of class names makes for cleaner looking
               and more semantically-readable documents
   BUT... must be careful of using:
   - reserved attributes: e.g. 'hidden' (future replacement for display: none; )
   - common attributes likely to be used by others and create confusion
*/

//export 
function gattr(attrAndSelector, domEl) { // get attribute value
    // not implemented: implement when needed (so can also test it)
}

// used ONLY to SET a value: NOT to read it (use gattr for that)
export function attr(...args) { // ('attr-name[@selector]'[, domEl], value)

    // 1- ('attr-name', domEl, value): domEl.attr-name = value;
    // 2- ('attr-name', value): INVALID
    // 3- ('attr-name@selector', value): [all elements with selector].attr-name = value
    // 4- ('attr-name@selector', domEl, value): [all elements with selector WITHIN domEl].attr-name = value

    const value = args.pop(), // always last arg
          isListener = typeof value === 'function',
          [attrName, selector] = spl(args.shift()),
          domEl = args.shift(); // should be only arg left (if any)

    ///\s+/.test(attrName) && log('attr', attrName, ';', value, selector, ';', isListener, !!domEl);

    if (selector) { // cases 3 & 4
        const els = qsa(selector, domEl);
        for (const el of els)
            updateAttr(attrName, el, value);
    }
    else if (domEl) { // case 1
        updateAttr(attrName, domEl, value);
    }
    else { // case 2
        throw new Error(`set attribute (attr) requires either '...@selector' or a dom element (or both) - got neither`)
    }
    
    function updateAttr(attr, el, value) {

        // strategy: we check to make sure we can (add|remove) attr (or listener)
        // because not all elements can do this (must have .nodeType === Node.ELEMENT_NODE)
        // (see https://www.w3schools.com/jsref/prop_node_nodetype.asp)

        // this will SILENTLY IGNORE those cases where the call would fail
        // (e.g. setAttribute on a #text node)

        // BUT, we permit this so that loop constructs that walk through children (for example)
        // can have cleaner code by just calling attr() wihtout having to first check for each
        // node's type (e.g. createTOC function in markdown-editor.js)


        if (isListener) // setting an event listener
            el.addEventListener && el.addEventListener(attr.replace(/^on[-_]*/i, '').toLowerCase(), value);
        else 
            (value === true) ? setAttr('')
          : (value === false) ? removeAttr()
          : setAttr((value || '').toString());

        function setAttr(v) { el.setAttribute && attr.split(/\s+/).forEach(a => el.setAttribute(a, v)); }
        function removeAttr() { el.removeAttribute && attr.split(/\s+/).forEach(a => el.removeAttribute(a)); }        
    }
}

export const on = (...args) => { // ('evt[@selector]'[, domEl], listener)
    const listener = args.pop(), // always last arg
          evtAndSelector = args.shift(), // always first
          domEl = args.shift(); // should be only arg left (if any)

    attr(evtAndSelector, domEl, listener);
};

export function byTag(tag, domEl = document.documentElement) {

    // expects a tag (required) and an element (optional) to search in (uses full doc if not used)

    return domEl.getElementsByTagName(tag.toUpperCase());
}

export const crEl = (tag, ...attrs) => {
    const el = document.createElement(tag.toLowerCase());

    for (const attribute of attrs) {
        if (typeof attribute === 'string')
            attribute && attr(attribute, el, true);
        else if (typeof attribute === 'function')
            attribute.name && attr(attribute.name, el, attribute);
        else for (const attrName in attribute || {}) {
            attr(attrName, el, attribute[attrName] || true);
        }
    }    

    // BONUS helpers for users of crEl...
    const helper = (helper, fcn) => helper in el ? log.warning(`did not replace existing <${tag}.${helper}> property`, el)
                                                 : Object.defineProperty(el, helper, { value: fcn });

    helper('add', (...args) => {
        for (const arg of args)
            arg && el.append(arg);
        return el; // can chain
    })

    // next 2 are PROBLEMATIC: SHOULD be empty (undefined) BUT...
    // ...BUT...
    // typeof el.text is STRING when tagname === 'script'|'a'
    // ...not sure why; TBI
    // ...so, at least for SCRIPT tags, CANNOT DEPEND ON/USE .text feature (hmmm...)
    helper('html', (...args) => { el.innerHTML = args.join(' '); return el; });
    helper('text', (...args) => { el.innerText = args.join(' '); return el; });

    helper('on', (evt, action) => {
        on(evt, el, action);
        return el; // can chain
    })

    return el;
}

export function toggleAttr(...args) { // ('attr[@selector]'[, domEl])
    const [attr,selector] = spl(args.shift()),
          el = args.pop();

    if (selector) {
        const els = qsa(selector);
        for (const el of els)
            el.toggleAttribute(attr);    
    }
    else if (el) {
        el.toggleAttribute(attr);
    }
    else {
        throw new Error(`toggleAttr expects either a '...@selector' or a domElement (or both) - got neither`)
    }
};

// warning: solution below can also fail at times
// not a trivial issue: https://stackoverflow.com/questions/332422/get-the-name-of-an-objects-type
// - e.g. is this not same as obj.constructor.name?: many times yes, but not always!
// - in general: [object HTMLElement] -> HTMLElement
// NOT FULLY TESTED
export const actualTypeOf = obj => Object.prototype.toString.call(obj).slice(8, -1); 

// NOT FULLY TESTED
export function isInstanceOf(baseType, objectToCheck, maxChainDepth = 10) {

    // warning: since based on 'actualTypeOf', and .constructor.name strategy,
    //          solution below can also fail at times (read above notes)

    // EDGE CASES (for convenience): should really pass Window & Document (the types), 
    // but folks likely to use window & document (the objects) instead, so we compensate for that
    if (baseType === window || baseType === document)
        return baseType === objectToCheck;

    let objTypeName = actualTypeOf(objectToCheck); // first time around
    while (objTypeName && objTypeName !== baseType.name && maxChainDepth-- > 0) {
        objectToCheck = Object.getPrototypeOf(objectToCheck.constructor); // go up the chain
        objTypeName = objectToCheck.name; // since must now be a function (i.e. a constructor), just get its name
    }

    if (maxChainDepth === 0)
        log('LIKELY ERROR', baseType, objectToCheck, objTypeName);

    return baseType.name === objTypeName;
}

//export UNTESTED
function reorderArgs(order, ...args) {
    
    // reorders args into required order: possible ONLY IF all parms have a different type
    // order is sequence of: 'type1, type2, ...', typeX, typeY, 'moreTypes...'

    const parmtypes = order.reduce((sofar,now) => {
        (typeof now === 'string') ? sofar.push(...now.split(/[^\w]+/g)) : sofar.push(now);
        return sofar;
    }, []);

    return parmtypes.map(type => args.find(a => typesMatch(type, a)));

    function typesMatch(type, item, caseInsensitive = true) {

        // todo: allow for multiple types in strings (e.g. 'string|number, function, object')
        //       as we do for actual types; for now, no need in our code base (so not 'over-engineered!)
        //       (though perhaps over-commented) :-)

        if (typeof type === 'string') {
            caseInsensitive && (type = type.toLowerCase());
            if (typeof item === type) return true; // trivial case (e.g. function string ???)
            let realType = actualTypeOf(item);
            caseInsensitive && (realType = realType.toLowerCase());
            return realType === type;    
        }
        else if (Array.isArray(type)) {
            for (const t of type) {
                if (t === item || isInstanceOf(t, item))
                    return true;
            }
            return false;
        }
        else
            return isInstanceOf(type, item); // that's different than matching...
    }
}

function private_for_documentation_only() {

    // element & document both inherit from Node
    // addEventListener is on EventTarget but that does NOT seem to work below (not instanceof???)
    // https://developer.mozilla.org/en-US/docs/Web/API/Element
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement
    // https://developer.mozilla.org/en-US/docs/Web/API/Document
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLDocument


    const ta = document.createElement('textarea');
    log('TA TEST 1', 
        isInstanceOf(EventTarget, ta), // false: why???
        isInstanceOf(Node, ta), // false: why???
        isInstanceOf(Element, ta), // false: why???
        isInstanceOf(HTMLElement, ta), // true
    );

    const da2 = document;
    log('DA TEST 2', 
        isInstanceOf(EventTarget, da2), // false: why???
        isInstanceOf(Node, da2), // false: why???
        isInstanceOf(Document, da2), // true
        isInstanceOf(HTMLDocument, da2), // true
    );    
}

// function to allow early calls BEFORE a library (script) is actually loaded & ready
// - will keep track of early birds until lib is set; set the actual lib with lib.ready(...)
// - return results on first call only (refresh after placeholder) has nowhere to return results to
// SO...
// - this means that the functions (tmp and ready) must be self-contained; if results are returned,
//   they must be self-updatable after the facts
export function asyncFeature(placeholderFcn) {
    var ready;
    const earlyBirds = [];
    function x(...args) {
        if (ready) 
            return ready(...args);
        earlyBirds.push(args);
        if (placeholderFcn) 
            return placeholderFcn(...args);
    }
    x.ready = fcn => {
        ready = fcn;
        while(earlyBirds.length)
            ready(...earlyBirds.shift()); // nothing to return to
    }
    return x;
};


// do after doc is fully loaded (i.e. window.onload) BUT...
// - window load event is called only once, so only on already-registered listeners
// - Trying to listen for the window loaded event AFTER it's done, will NOT be work
// - onReady (below) will ALWAYS call actions, even if requested after original load
//   event is done
// TBI: ??? is this SAME AS document.addEventListener('DOMContentLoaded',function(){}) ???
var winLoaded = false;
on('load', window, () => winLoaded = true);
export const onReady = action => winLoaded ? action() : on('load', window, action);

// warn of unsaved changes
export function dontLeavePageIf(dontLeave) {
    on('beforeunload', window, e => {
        // https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload        
        if (dontLeave()) {
            e.preventDefault(); // Cancel the event
            e.returnValue = ''; // Chrome requires returnValue to be set
        }
    });
}

export function scrollBackToTop({
    scrollingEl,
    triggerScrollAmt = 10, // how much drop from top before control is displayed
    scrolledIndicatorAttr = 'scrolled', // added/removed to control when scrolled/not (used for css)
    scroller = 'back-to-top@a', // control itself
    scrollerText = 'top' // text displayed on control
}) {
    // - https://www.w3schools.com/howto/howto_js_scroll_to_top.asp
    // - https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#Attributes (under href: see note)

    if (!scrollingEl)
        throw new Error(`need a scrolling element to track for scrollBackToTop feature`);

    const [scrollerAttr, scrollerTag] = spl(scroller);
    log('scroller info', scrollerTag, scrollerAttr, ';', scrollerText);
    const el = crEl(scrollerTag, scrollerAttr)
        .add(scrollerText)
        .on('click', () => scrollingEl.scrollTop = 0);

    onReady(() => {
        document.body.append(el); // wait until actual doc set to append at very end
        on('scroll', scrollingEl, e => attr(scrolledIndicatorAttr, el, (e.target.scrollTop > triggerScrollAmt)))
    })
}

export const copyToClipboard = (function() {

    // MUST have def in css (mostly position: absolute; left: -9999999px;)
    const cta = crEl('textarea', 'clipboard-utility');

    onReady(() => document.body.appendChild(cta)); 
    return (str,el) => {
        cta.value = str;
        cta.select();
        document.execCommand('copy');
        toaster({text: 'copied to clipboard', el, width: 150 });
    }    
})();

const isMac = /mac/i.test(window.navigator.platform);
export function onCtrlSave(action) {
    on('keydown', document, e => {
        if (e.key === 's' && (isMac ? e.metaKey : e.ctrlKey)) {
            e.preventDefault(); // important (else browser wants to save the page)
            action();
        }
    });
}

export const post = (...args) => { // url[,headers],body

    log('postaging', args);

    const url = args.shift(), // always first
          body = args.pop(), // always last
          headers = args.shift() || {}; // always after url

    if (typeof body === 'string')
        return fetch(url, { method: 'post', body, headers });
    else
        return fetch(url, { method: 'post', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(data), });

    // maybe also: postForm(...) then use 'Content-Type': 'application/x-www-form-urlencoded'
}

export class EventEmitter {

    // NOT NEEDED in node (built-in): https://nodejs.org/api/events.html

    // todo: consider replacing with https://www.npmjs.com/package/events
    //       - BUT that would require a build step (code below requires no build step)

    /* using private fields (what we'd like, eventually):

        these (public|#private) fields require @babel/plugin-proposal-class-properties
        - OR, seems to work as-is with chrome browser 74+
        - based on: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes#Field_declarations

        eslint: works for tc39 stage 4 (finished), not stage 3 (candidate) or less (https://tc39.es/process-document/)
        - all tc39 proposals: https://tc39.es/#proposals & https://github.com/tc39/proposals
        - private props (#syntax) are at stage 3 as of jun 16, 2019; can't use here without "squiggly errors"

        As of Jun 16, 2019, support is only for:
        - chrome 72+
        - firefox 67+ [partial support only: ???]

        // what we'd like, eventually
        #events = {}; 
        #peekAll = []; // allows peeking into full stream of events
    */

    constructor() {
        this.events = {}; 
        this.peekAll = []; // allows peeking into full stream of events    
    }

    // eventName is never passed to normal listeners: so prob should not have 1 listener for multiple events
    // - eventName IS PASSED to all peekAll and catchAll listeners
    // if eventName is '*', that's the catch-all listener for all events with NO current listeners
    // if no eventName, listens for ALL events (i.e. that's the peekAll listener)
    // - in which case, first parm (to listener) is ALWAYS eventName

    // listeners ALWAYS called with 'this' as EventEmitter so can ADD props to it, accessible within listeners

    on(eventName, listener) {

        const {events,peekAll} = this; // shorthand

        if (arguments.length === 1) // no eventName...
            typeof arguments[0] === 'function' && peekAll.push(arguments[0]); // ...arg[0] is listener
        else // named event
            (events[eventName] || (events[eventName] = [])).push(listener);

        return this; // for chaining
    }

    once(eventName, listener) {
        const self = this;
        self.on(eventName, (...args) => {
            self.removeListener(eventName, listener);
            listener.apply(self, args);
        });
    }

    emit(eventName, ...args) {
        
        // note: using setTimeout to allow for next-tick processing

        const self = this,
              {events,peekAll} = self, // shorthand
              exec = listener => setTimeout(listener, 0); // always do on next go round (don't lock the loop)

        peekAll.forEach(listener => exec(() => listener.call(self, eventName, ...args))); // note: eventName is 1st parm

        const evts = events[eventName];
        if (evts && evts.length > 0)
            evts.forEach(listener => exec(() => listener.apply(self, args))); // note: eventName is NOT PASSED
        else 
            (events['*'] || []).forEach(listener => exec(() => listener.call(self, eventName, ...args))); // note: eventName is 1st parm
    }

    removeAll(safety = false) {
        if (safety === 'listeners') {
            this.events = {};
            this.peekAll = [];
            return this;
        }
        throw new Error(`to remove ALL listeners, MUST past 'listeners' as single parameter`);
    }

    removeListener(eventName, listener) {
        const {events,peekAll} = this; // shorthand
        if (arguments.length === 1) {
            if (typeof arguments[0] === 'string') { // remove by name
                var safe = false;
                const event = eventName.replace(/^all[:]\s*/i, () => (safe=true,''));
                if (safe)
                    events[event] = [];
                else
                    throw new Error(`must prepend 'all:' (i.e. all:${eventName}) to really remove ALL listeners`);
            }
            else { // remove by method

                const listener = arguments[0]; // for clarity

                // search all events 
                for (const listeners in Object.values(events)) {
                    const pos = listeners.indexOf(listener);
                    (pos > -1) && listeners.splice(pos, 1);        
                }

                // search peek all
                const pos = peekAll.indexOf(listener);
                (pos > -1) && peekAll.splice(pos, 1);    
            }
        }
        else {
            const pos = (events[eventName] || []).indexOf(listener);
            (pos > -1) && events[eventName].splice(pos, 1);
        }
    }
};

function asCssString(...allCss) {

    // just in case...
    const clean = x => x.replace(/[;]\s*[;]/g, ';')

    function props(props) {

        //  - string: 'prop-name: prop-value; prop2-name: prop2value; ...'
        if (typeof props === 'string')
            return clean(props + ';');

        //  - object: { propname: 'prop value', ... }
        var css = '';
        for (const p in props)
            css += '\n' + cssProp(p) + ': ' + props[p] + ';' // each prop is { propName: 'prop-value' }
        return clean(css);
    }

    var cssStr = '';
    for (const css of allCss) {
        if (typeof css === 'string')
            cssStr += '\n' + css;
        else for (const cssSel in css) // it's an object: keys are selectors; values are strings or objects
            cssStr += '\n' + cssSel + ' {' + props(css[cssSel]) + '\n}\n';
    }

    return cssStr;
}

const cssProp = (function() {

    // WARNING: ISSUES to be aware of before using; READ BELOW!

    // creates a css prop name from its non-camelized name: e.g. fontsize to font-size 
    // - cleaner (?) when passing as object properties: no more need for fontSize!
    
    // todo: allow for these to be specified? how? why? (just pass as strings)
    // @charset @import @font-face @font-feature-values @keyframes @media @counter-style @page @viewport

    // strategy: rather than store all possible css properties (with translations), store only 2nd words (e.g. 'weight' 
    // in 'font-weight') which are much fewer in count (and reused a lot); then use those to break up words
    
    // ISSUES:
    // - display->dis-play; blend->bl-end [and possible words nested in others]
    //  - solution: prescreen these using 'leaveAlone' pattern below

    // SOLUTION BELOW WILL FAIL: not all edge cases have been found; MORE NEED TO BE ADDED
    // - some problematic entries below: dis-play|area-s|bl-end|r-end-ering|over-flow|under-line|up-right|in-side|out-side
    // - BIG ONES: x & y; used all over the place: REMOVED from below; to use, MUST Capitalize them as X and Y
    // - so: play area end flow line right side x y

    // // manually entered from: https://www.w3schools.com/cssref/
    // const xpat = `weight size top left bottom right radius color image content items delay direction duration mode fill name iteration count play state 
    //    timing function visibility attachement blend mode clip origin position repeat style width height collapse outset slice source spacing 
    //    decoration break shadow sizing after before inside outside side count fill gap rule span increment reset cells basis flow grow shrink wrap
    //    family feature settings kerning language override adjust stretch synthesis variant alternates caps east asian ligatures numeric 
    //    area auto columns rows end start gap template areas punctuation rendering type fit position offset x y events behavior align last first 
    //    combine upright decoration line indent justify overflow shadow transform underline timing bidi select space index`;

    // // generated for below
    // log('COPY THIS STRING:', [...new Set(xpat.split(/\s+/).sort())].join(' '));

    // based on generated from above
    const css2ndWords = `adjust after align alternates area areas asian attachement auto basis before behavior bidi blend bottom break caps cells clip 
        collapse color columns combine content count decoration delay direction duration east end events family feature fill first fit flow function gap 
        grow height image increment indent index inside items iteration justify kerning language last left ligatures line mode name numeric offset origin 
        outset outside overflow override play position punctuation radius rendering repeat reset right rows rule select settings shadow shrink side size 
        sizing slice source space spacing span start state stretch style synthesis template timing top transform type underline upright variant visibility 
        weight width wrap`; // x y`;

    const css2ndPat = new RegExp(`[a-z](${css2ndWords.split(/\s+/).join('|')})`, 'g');

    const leaveAlone = /^(display)$/; // else dis-play
    
    // 1) fontSize => font-size and 2) fontsize -> font-size
    return p => leaveAlone.test(p) ? p : camel(p).replace(css2ndPat, m => m[0] + '-' + m.substring(1)); 
})();

// exporting FCN when also FCN.subFcn(...): nice way to access BUT RIPE for being hijacked!
// import FCN cannot be [usually*] modified BUT its properties can...
// [*usually]: because if using 'require' form, require.cache objects CAN be modified
// - safest to use a build system (e.g. webpack) that pre-package exports (and make private to users)
// - in the meantime...
// - WORKAROUND: use 'secureProp' (below) to protect each added property for these exported functions
// - IMPORTANT: Object.seal(...) is NOT a solution because this allows for existing props
//              to be modified

export function secureProp(obj, ...props) {
    // props is sequence of: 'propname', prop-value AND { propname:prop-value, ...}
    // using Object.defineProperty (below) because defaults to configurable=editable=writable=FALSE (hence secured)
    while (props.length) {
        const prop = props.shift(); // get next in line
        if (typeof prop === 'string') {
            Object.defineProperty(obj, prop, { value: props.shift() })
        }
        else { // object: iterate through its keys as props
            for (const k in prop)
                Object.defineProperty(obj, k, { value: prop[k]})
        }
    }
}

export const loadCSS = (...css) => document.head.appendChild(crEl('style').add(asCssString(...css)));
secureProp(loadCSS, 'fromUrl', href => new Promise(onload => document.head.appendChild(crEl('link', {href, rel: 'stylesheet', onload}))));

// fyi: alt to Promise.all(...)
// https://github.com/tc39/proposal-promise-allSettled

// simple polyfill (not checked against tc39 api)
// - returns an array of object: { status: 'resolved/rejected', resolved: true/missing, rejected: true/missing, value: 'from promise'}
const settled = p => p.then(value => ({status: 'resolved', resolved: true, value}))
                      .catch(error => ({status: 'rejected', rejected: true, error}));
Promise.allSettled || (Promise.allSettled = promises => Promise.all(promises.map(settled)));

export const loadSCRIPT = (...code) => document.head.append(crEl('script').add(...code));
secureProp(loadSCRIPT, { 
    fromUrl(...args) {

        // if first parm is boolean, first parm === IN_SEQUENCE
        // - IN_SEQUENCE=true means that later scripts are only loaded if prior scripts all loaded correctly
        //      - IN_SEQUENCE=true is default if not specified (i.e. 1st param is not boolean)
        // - IN_SEQUENCE=false used ONLY if loading multiple scripts AND NONE is dependent on the others
        //      - load order likely to be random
        //      - this means an explicit 'false' as first param

        // Background: (not sure that reason is correct; more research required;)
        // scripts loaded with javascript tags SHOULD load as 'defer' but when redirects are involved, 
        // later loaded scripts MAY end up executing ahead of prior loaded ones
        // so the only way to force it to is NOT load next script until first one is actually finished loading

        const IN_SEQUENCE = typeof args[0] === 'boolean' ? args.shift() : true;

        return IN_SEQUENCE ? loadInOrder() : loadInAnyOrder();

        function loadInOrder() {
            return new Promise(async (resolve, reject) => {                
                while (args.length) {
                    try {
                        await loadScript(args.shift());
                    }
                    catch(err) {
                        return reject(err + (args.length ? ` [skipping: ${args.join('; ')}]` : ``));
                    }
                }
                resolve();
            })
        }

        function loadInAnyOrder() {
            const scripts = args.map(s => loadScript(s));
            return Promise.allSettled(scripts).then(results => {
                const errors = [...results.filter(r => r.rejected)];
                if (errors.length)
                    throw errors;
            })
        }

        function loadScript(src) {
            return new Promise((resolve,reject) => {
                document.head.append(crEl('script', { src,
                    onload() { resolve(); }, 
                    onerror() { reject('failed loading ' + src); }
                }));
            }); 
        }
    } 
});

export const mustache = (str,vars) => Object.entries(vars).reduce((sofar,[k,v]) => sofar.replace(`{{${k}}}`,v), str);
export const sleep = delayInMS => new Promise(resolve => setTimeout(resolve, delayInMS));

/* tooltip notes:
    We use a popper.js-based library, tippy.js
    - popper.js seems extremely complete but ridiculously complex to use (rctu)
    - popper.js has horrendously difficult documentation to understand (hddu)...
        - ...for what it does (tooltips for fuck sake!!! how hard should this be!!!)
    - popper cannot be used by itself, it requires a framework above it
        - MUST ALWAYS load popper.js first...
        - best to use it (+ framework) as npm + build but used below as straight <scripts>
    - i explored 2 such frameworks: tooltip.js & tippy.js
    - tooltip.js was rctu AND HDDU: i chose to abandon it!!!
    - tippy.js just worked! (BUT, need to include popper.js); 
        - todo: about 15k; should look for something lighter
        - special considerations for IE11:
            - read: https://atomiks.github.io/tippyjs/creating-tooltips/#svg-in-i-e-11
            - NOT IMPLEMENTED below; but easy enough to add an extra loadSCRIPT statement
        - all css works, no need for customization on our part (even with our 'display: flex' framework: yay!)

    - fyi: https://popper.js.org/ [home or popper.js & tooltip.js]
    - fyi: https://popper.js.org/tooltip-examples.html
    - fyi: https://github.com/FezVrasta/popper.js
    - fyi: https://popper.js.org/tooltip-documentation.html
    - THIS ONE: https://atomiks.github.io/tippyjs/all-options/
        - for example usage, see app.js
*/
const tooltips = asyncFeature(el => enhanceElWithTooltip(el)); // i.e. will be ready eventually
const ttApi = Symbol('tooltip api');
function enhanceElWithTooltip(el, tt) {
    el.showTooltip = txt => (tt && (txt && tt.setContent(txt), tt.show()), el);
    el.hideTooltip = () => (tt && tt.hide(), el);
    return el;
}
loadSCRIPT.fromUrl('https://unpkg.com/popper.js', 'https://unpkg.com/tippy.js')
    .then(() => {
        tooltips.ready((el, {html, label, text, arrow = true, placement = 'top', ...moreOptions} = {}) => {
            if (el[ttApi]) 
                return el; // already init
            const options = {
                arrow, placement, 
                content: html || label || text || 'no tooltip specified!',
                allowHTML: !!html,
                ...moreOptions,
            };
            return enhanceElWithTooltip(el, el[ttApi] = tippy(el, options)); // init now
        });
    })
    .catch(err => {
        log.error('error loading tooltip lib (tooltips will NOT be displayed): ', err);
        //log('tooltip feature failed to load - tooltip settings ignored', options);
    });

export function tooltip(...args) { 
    
    // (el, options) or ('sel', options) or ('sel', el, options)
    // options is {obj} or 'tooltip string'

    // for all possible tooltip options, see: https://atomiks.github.io/tippyjs/all-options/
    // BUT, must then ALSO implement these here...

    // TODO: add option to show a tooltip ONCE, then delayed (or not) 2nd time around (less annoying)
    //       - one way: change display delay after shown once

    const options = typeof args.last() === 'string' ? { html: args.pop().replace(/\n+/g, '<br>') } : args.pop();
    const selector = (typeof args.first() === 'string') ? args.shift() : false; // using selector 
    const el = args.shift();

    const elx = (selector && el) ? qs(selector, el) : (selector || el);

    return tooltips(elx, options); 
    //return elx; // chaining
}

export * from './encrypt-decrypt.js';