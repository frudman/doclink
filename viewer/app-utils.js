// helpers        
export const log = console.log.bind(console);
log.error = console.error.bind(console); // NOT WHAT YOU EXPECT!!! console.error uses 1st parm as fmt string...

export const qs = (selector,el) => (el || document).querySelector(selector);
export const qsa = (selector,el) => (el || document).querySelectorAll(selector); // use as for (const el of qsa('sel-here'))
export const spl = parts => parts.split('@');
export const on = (what, listener) => { let [evt,sel] = spl(what); qs(sel).addEventListener(evt, listener); };
export const toggleAttr = what => { let [attr,sel] = spl(what); qs(sel).toggleAttribute(attr); };

const camel = x => x.replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase());

export function byTag(tagOrElement, elementOrTag) {

    // expects a tag (required) and an element (optional) to search in (uses full doc if not used)
    
    var tag, el;
    const which = x => (typeof x === 'string') ? (tag = x) : (x instanceof HTMLElement) ? (el = x) : '';

    which(tagOrElement);
    which(elementOrTag);

    return (el || document.documentElement).getElementsByTagName(tag.toUpperCase());
}

export const crEl = (tag, ...attrs) => {
    const el = document.createElement(tag);
    log('crel', tag, el.add, el.insert, el.append);

    for (const attr of attrs) {
        log('add attrs', typeof attr, attr);
        if (typeof attr === 'string')
            el.setAttribute(attr, '');
        else for (const attrName in attr) {
            log('attrx', attrName, attr[attrName])
            if (typeof attr[attrName] === 'function')
                el[attrName] = attr[attrName]
            else
                el.setAttribute(attrName, attr[attrName]);
        }
    }

    el.add = (...args) => {
        for (const arg of args)
            el.append(arg); // AS TEXT or as HTML???
        return el;
    }

    return el;
}

export function attr(what, value) {
    if (arguments.length === 3) {
        var bt = arguments[0];
        var attr = arguments[1];
        value = arguments[2];
        log('set-attr', bt, attr, value);
        if (bt.nodeType !== Node.ELEMENT_NODE) {
            log('cannot set a non-element node attribute', bt, attr);
            return;
        }
    }
    else {
        var [attr,sel] = spl(what);
        var bt = qs(sel);
    }

    if (value === true)
        bt.setAttribute(attr, '');
    else if (value === false)// || value === undefined || value === null)
        bt.removeAttribute(attr);
    else if (typeof value === 'string')
        bt.setAttribute(attr, value);
    else 
        log.error('unexpected attribute value', value);
}

// do after doc is fully loaded
export const onReady = action => window.addEventListener('load', action);

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
    // really minimal toast
    // MUCH NICER ONE (and simple also, mostly css): https://codepen.io/kipp0/pen/pPNrrj
    const el = crEl('div');
    onReady(() => {
        document.body.appendChild(el);
        el.setAttribute('minimal-toaster', ''); // attr(el, 'minimal-toaster', true);
    })

    return (...args) => {
        const text = args.pop(), title = args.pop();
        el.innerHTML = title ? `<h1>${title}</h1><p>${text}</p>` : `<h2>${text}</h2>`;
        el.setAttribute('visible', '');
        setTimeout(() => el.removeAttribute('visible'), TOASTER_FADE_IN_MS)
    };
})(1500);


export const copyToClipboard = (function() {
    const cta = crEl('textarea');
    onReady(() => {
        document.body.appendChild(cta);
        cta.setAttribute('clipboard-utility', ''); // MUST have def in css (mostly position: absolute; left: -9999999px;)
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

