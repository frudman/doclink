// magic, part 2

import { log, on, qs } from './utils.js';
import { ONLIVEDATA } from './live-html.js';

// IMPORTANT: can render self (including template tag) or kids only
// - maybe by default if templ tag is known html it renders self: div ul span ...
// - if contains dash, renders kid (override with render=self or full or all)
// - if render self and contains ID, ID is REMOVED always

const prePat = {};
export function setPrefixes({directive = '$', event = '@', attr = ':'} = {}) {
    prePat.directive = new RegExp(`^${RegExp.escape(directive)}`, 'i');
    prePat.startDirective = directive.length;
    prePat.event = new RegExp(`^${RegExp.escape(event)}`, 'i');
    prePat.startEvent = event.length;
    prePat.attr = new RegExp(`^${RegExp.escape(attr)}`, 'i');
    prePat.startAttr = attr.length;
}

setPrefixes();

function attrType(attr) {
    return {
        directive: prePat.directive.test(attr) && attr.substring(prePat.startDirective),
        event: prePat.event.test(attr) && attr.substring(prePat.startEvent),
        attr: prePat.attr.test(attr) && attr.substring(prePat.startAttr),
    };
}

// used to show/hide elements
var HIDDEN_ATTRIBUTE = 'hidden'; // usually set in user-agent/native CSS as {display: none;}
export function setHiddenAttribute(attrValue = 'hidden') {
    HIDDEN_ATTRIBUTE = attrValue;
}



// maybe trim blank #text at start and end of component (whether or not single or multi comp)?
// replace inter-ones with " " or "\n" if include \n+
// always remove #comments

// how to move a component's html within the DOM, if comp consists of multiple nodes?
// - need api to comp.moveEl(location){} where individual parts are moved

export function parseHtml(selector, htmlDocFrag, data) {

    // returns an ARRAY of elements cloned/inflated from within htmlDocFrag
    // - if know/expect always a single element, can just access as 'const [el] = parseHtml(...)'
    
    const fragSrc = selector ? qs(selector, htmlDocFrag) : htmlDocFrag;

    // NEVER change original html source fragment/template

    // MISSING: recursion for child nodes; NEEDED?
    // only need to examine attributes for nodes/kids; 

    const nodes = [];
    const addNode = c => nodes.push(typeof c === 'string' ? document.createTextNode(c) : c.cloneNode(true))

    var spacer = ''; // blank space between nodes (only need to preserve as single space, as per html rules)
    for (const child of fragSrc.childNodes) {
        const nodeType = child.nodeType;
        if (nodeType === Node.COMMENT_NODE || (nodeType === Node.TEXT_NODE && /^\s+$/.test(child.textContent))) {
            spacer = ' ';
        }
        else {
            spacer && nodes.length && addNode(spacer); // add spacer (if not first)
            spacer = '';
            addNode(child);
        }
    }

    return makeLive(nodes, data);
    //return nodes; // what will be added to doc
}

function makeLive(nodes, data) {
    for (const el of nodes) {//fragSrc.childNodes) {
        const nodeType = el.nodeType;
        if (nodeType === Node.COMMENT_NODE || nodeType === Node.TEXT_NODE)
            continue;

        // scan for $attributes
        // process kids?

        for (const {name,value} of el.attributes) {
            const {directive,event,attr} = attrType(name);
            if (directive) {
                const handler = DIRECTIVES[directive.toLowerCase() + 'Directive'];
                if (handler) {
                    el.removeAttribute(name);
                    handler(value, data, el);
                }
                else
                    log('warning: directive-looking attribute but not a known directive', name, value);
            }
            else if (event) {
                el.removeAttribute(name);
                handleEvent(name, value, data, el);

            }
            else if (attr) {
                // can be single or multiple...
                el.removeAttribute(name, value, data, el);
                // handle it
            }
            else {
                // regular attribute: scan for {{embedded expressions}}
            }
        }

    }
    return nodes; // or different from nodes? (for constructs?)
}

export function setDirectiveHandler(name, handler) {
    const existing = DIRECTIVES[name];
    DIRECTIVES[name.toLowerCase() + 'Directive'] = (value, data, el) => handler(value, data, el, existing);
}

const DIRECTIVES = {
    ifDirective,
    forDirective,
    htmlDirective,
    textDirective,
};

const EVENTS = {
    // custom events
    // e.g. @next
}

function ifDirective(value, data, el) {
    log('handling $IF directive', value, el);

    // options: detach html node when not displayed (then reattach when shown)
    // - use hidden attribute
    // - replace with a blank node (e.g. text node): but this takes up space in dom tree
    //   (and can skew css if set using positions (i.e. first/last child))

    data[ONLIVEDATA](value, result => {
        if (result) 
            el.removeAttribute(HIDDEN_ATTRIBUTE);
        else
            el.setAttribute(HIDDEN_ATTRIBUTE, true);
    });
}

function forDirective(value, data, el) {
    log('handling $FOR directive', value, el);
}
function htmlDirective(value, data, el) {
    log('handling $HTML directive', value, el);

}

function textDirective(value, data, el) {
    log('handling $TEXT directive', value, el);

}

function handleEvent(name, value, data, el) {
    // may want to break with attr.x.y.z:abc=123
}

function handleLiveAttr(name, value, data, el) {
    // may want to break with attr.x.y.z:abc=123
}

