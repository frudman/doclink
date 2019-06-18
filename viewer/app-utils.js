// helpers        
export const log = console.log.bind(console);
log.error = console.error.bind(console); // TODO: NOT WHAT YOU EXPECT!!! console.error uses 1st parm as fmt string...
    // should accept: ('error', ...parms), (Error, ...parms), (...parms) then act like our log above

const camel = x => x.replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase());

export const qs = (selector,el) => (el || document).querySelector(selector);
export const qsa = (selector,el) => (el || document).querySelectorAll(selector); // use as for (const el of qsa('sel-here'))
export const spl = parts => parts.split('@');

// used when detecting args by type (keep private)
const DOCUMENT_ELEMENTS = [HTMLElement, HTMLDocument];
const ANY_EVENT_LISTENER = [...DOCUMENT_ELEMENTS, window];

export const on = (...args) => { // (el, 'evt@selector', listener) or ('evt@selector', listener)
    const listener = args.pop(); // always last arg
    if (args.length === 2) {
        const [el,evt] = reorderArgs([ANY_EVENT_LISTENER, 'string'], ...args);
        attr(el, evt, listener);
    }
    else if (args.length === 1) {
        attr(args.pop(), listener);
    }
    else
        return log(`ERROR: expecting 2 or 3 parameters for 'on' function`)    
};

export const onEvt = on; // alias; TODO: fall back to 1 only (on?)
// function onEvt(...args) {

//     const fcn = args.pop(); // always last arg; args.length now less 1

//     if (args.length === 2) { // el 'evt' action()
//         // read notes in private_for_documentation_only() above
//         const [el, evt] = reorderArgs([[...DOCUMENT_ELEMENTS, window], 'string'], ...args); 
//         el.addEventListener(evt, fcn);
//     }
//     else if (args.length === 1) { // 'evt@selector', action
//         const [evt, sel] = spl(args.pop());
//         qs(sel).addEventListener(evt, fcn);
//     }
//     else
//         throw new Error(`expecting 2 or 3 arguments for onEvt (got ${args.length})`);
// }



export function byTag(tagOrElement, elementOrTag) {

    // expects a tag (required) and an element (optional) to search in (uses full doc if not used)
    // order of parms is irrelevent

    const [el, tag] = reorderArgs([DOCUMENT_ELEMENTS, 'string'], tagOrElement, elementOrTag);
    return (el || document.documentElement).getElementsByTagName(tag.toUpperCase());
}

export const crEl = (tag, ...attrs) => {
    const el = document.createElement(tag);

    for (const attribute of attrs) {
        if (typeof attribute === 'string')
            attribute && attr(el, attribute, '');
        else for (const attrName in attribute || {}) {
            attr(el, attrName, attribute[attrName]);
        }
    }

    // and for all users of crEl, a bonus...
    el.add = (...args) => {
        for (const arg of args)
            el.append(arg); // AS TEXT or as HTML???
        return el;
    }

    return el;
}

export function toggleAttr(...args) {
    if (arguments.length === 1) {
        var [attr,sel] = spl(what); 
        var el = qs(sel);//.toggleAttribute(attr);     
    }
    else {
        var el = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
        var attr = typeof arguments[0] === 'string' ? arguments[0] : arguments[1];
    }
    el && attr && el.toggleAttribute(attr);     
};

// ALSO do for byTag (parm order)


// warning: solution below can also fail at times
// not a trivial issue: https://stackoverflow.com/questions/332422/get-the-name-of-an-objects-type
// - e.g. is this not same as obj.constructor.name?: many times yes, but not always!
// - in general: [object HTMLElement] -> HTMLElement
export const actualTypeOf = obj => Object.prototype.toString.call(obj).slice(8, -1); 

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

export function reorderArgs(order, ...args) {
    
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

export function attr(...args) {

    // SHOULD we allow for setting attributes on MULTIPLE elements? e.g. 'attrx@div[custom-divs]
    // - then would need some sort of loop
    
    const value = args.pop(); // always last arg; args.length now less 1

    if (args.length === 2) { 
        var [el, attr] = reorderArgs([HTMLElement, 'string'], ...args)
        if (el.nodeType !== Node.ELEMENT_NODE) {
            return log('WARNING: cannot set a non-element node attribute', el, attr, value);
        }
    }
    else if (args.length === 1) {
        var [attr,sel] = spl(args.pop());
        var el = qs(sel);
    }
    else {
        return log('ERROR: unexpected attribute value', el, attr, value);
        //throw new Error(`expecting 2 or 3 arguments for attr`); // a
    }

    if (value === true)
        el.setAttribute(attr, '');
    else if (value === false)
        el.removeAttribute(attr);
    else if (typeof value === 'string')
        el.setAttribute(attr, value);
    else if (typeof value === 'function') {

        // COULD STILL HAVE evt@selector WITHIN el: if so need to use qs or qsa(selector).addEventSelector
        a b 


        // setting an event listener
        el.addEventListener(attr.replace(/^on/i, '').toLowerCase(), value);
    }
    else 
        log('ERROR: unexpected attribute value', el, attr, value);
}

// do after doc is fully loaded (i.e. window.onload) BUT...
// - window load event is called only once, so only on already-registered listeners
// - Trying to listen for the window loaded event AFTER it's done, will NOT be work
// - onReady (below) will ALWAYS call actions, even if requested after original load
//   event is done
var winLoaded = false;
window.addEventListener('load', () => winLoaded = true);
export const onReady = action => winLoaded ? action() : window.addEventListener('load', action);

// warn of unsaved changes
export function dontLeavePageIf(dontLeave) {
    window.addEventListener('beforeunload', e => {
        // https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload        
        if (dontLeave()) {
            e.preventDefault(); // Cancel the event
            e.returnValue = ''; // Chrome requires returnValue to be set
        }
    });
}

export const toaster = (function(TOASTER_FADE_IN_MS) {

    // todo: allow placement of toast next to caller (e.g. copied! on black rectangle)
    
    // really minimal toast
    // MUCH NICER ONE (and simple also, mostly css): https://codepen.io/kipp0/pen/pPNrrj
    
    const el = crEl('div', 'minimal-toaster');
    onReady(() => document.body.append(el))

    return (...args) => { // text or title,text
        const text = args.pop(), title = args.pop();
        el.innerHTML = title ? `<h1>${title}</h1><p>${text}</p>` : `<h2>${text}</h2>`;
        attr(el, 'visible', true);
        setTimeout(() => attr(el, 'visible', false), TOASTER_FADE_IN_MS)
    };
})(1500);

export function scrollBackToTop({
    scrollingEl,// = '[viewer]', 
    triggerScrollAmt = 10, 
    scrollAttr = 'scrolled@body', 
    scroller = 'back-to-top@a',
    scrollerText = 'top'
}) {

    if (!scrollingEl)
        throw new Error(`need a scrolling element to track for scrollBackToTop feature`);

    const [scrollerAttr, scrollerTag] = spl(scroller);
    const el = crEl(scrollerTag, scrollerAttr).add(scrollerText);
    el.addEventListener('click', () => scrollingEl.scrollTop = 0);

    onReady(() => {
        log('ready yet?');
        document.body.append(el); // wait until actual doc set to append at very end
        scrollingEl.addEventListener('scroll', e => attr(scrollAttr, (e.target.scrollTop > triggerScrollAmt)))
    })
}

// (function(SCROLL_AMOUNT_BEFORE_TOP) {
//     const el = crEl('a', 'back-to-top').add('top');
//     el.addEventListener('click', () => qs('[viewer]').scrollTop = 0);

//     onReady(() => {
//         document.body.append(el); // wait until actual doc set to append at very end
//         qs('[viewer]').addEventListener('scroll', e => {
//             log('scorlla', e.target.scrollTop);;
//             attr('scrolled@body', (e.target.scrollTop > SCROLL_AMOUNT_BEFORE_TOP));
//         })
//     })
// })(10);


export const copyToClipboard = (function() {
    const cta = crEl('textarea', 'clipboard-utility');
    onReady(() => {
        document.body.appendChild(cta);
        //cta.setAttribute('clipboard-utility', ''); // MUST have def in css (mostly position: absolute; left: -9999999px;)
    })
    return str => {
        cta.value = str;
        cta.select();
        document.execCommand('copy');
        toaster('copied to clipboard');
    }    
})();

const isMac = /mac/i.test(window.navigator.platform);
export function onCtrlSave(action) {
    document.addEventListener('keydown', e => {
        if (e.key === 's' && (isMac ? e.metaKey : e.ctrlKey)) {
            e.preventDefault(); // important (else browser wants to save the page)
            action();
        }
    });
}

export const post = (url, body) => {

    // todo: add 3rd parm (object) as headers (always middle element, always an object)

    if (typeof body === 'string')
        fetch(url, { method: 'post', body}); // no headers?
    else
        fetch(url, { method: 'post', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data), });

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
                {events,peekAll} = self; // shorthand

        peekAll.forEach(listener => setTimeout(() => listener.call(self, eventName, ...args), 0)); // note: eventName is 1st parm

        const evts = events[eventName];
        if (evts && evts.length > 0)
            evts.forEach(listener => setTimeout(() => listener.apply(self, args), 0)); // note: eventName is NOT PASSED
        else 
            (events['*'] || []).forEach(listener => setTimeout(() => listener.call(self, eventName, ...args), 0)); // note: eventName is 1st parm
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

export const loadSCRIPT = (...code) => document.head.append(crEl('script').add(...code));
secureProp(loadSCRIPT, { fromUrl(src) { return new Promise(onload => document.head.append(crEl('script', {src, onload}))); } });

export const mustache = (str,vars) => Object.entries(vars).reduce((sofar,[k,v]) => sofar.replace(`{{${k}}}`,v), str);
export const sleep = delayInMS => new Promise(resolve => setTimeout(resolve, delayInMS));

