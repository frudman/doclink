import { log } from "./utils.js";

// simple-minded parser
// - allows for nested rules
// - picks up live variables (--var-here--)
// todo: &::...
// maybe also @(media|supports|keyframes|...) nested at-rules

/*
    writing css as per the standard can quickly become text-intensive (at best) and excrutiatingly hard at worst
    unless using css preprocessors such as less, scss/sass, or stylus
    unfortunately, using these preprocessor is harder or impossible to do on the fly in a browser (possible but hard)

    - no easy way to "encapsulate" (generic scoping) of css rules: e.g. div[long-unique-attribute-name-here{ ...nested rules here... }]

    for complicated css, i highly recommend it both for its ability to target lots of browsers (e.g. prefixes, simpler calculations)
    and also to explictly build that css.

    however, for components in general (and more generic ones at that), a build step complicates the delivery and "tweakability"
    of components (still can do it); and still can include built css files easily eough

    for an in-between solution, there is a pre-processor built-in to doctypex
    - it allows nesting of rules (the single missing part of css)
    - it also allows for live properties (i.e. css updates automagically when prop value changed)

    Allows for much cleaner (and shorter) css without requiring the building and processing of preprocessors

*/

// SHOULD opt-in using <style type=simple> so NO pre-processing if have issues

// NOT FULLY TESTED!!! 
// **** in particular, not tested against possible clashes between actual pseudo classes and legitimate
// **** property values; IF any are similar, becomes REALLY HARD to allow for nesting of classes
// **** because it's no longer easy to decide if starting a new group or defining a property
// classes below from: 
// - https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes#Index_of_standard_pseudo-classes
// only included STANDARD classes, NOT experimental (as of Jul 10, 2019)
// only included common prefixes
const pseudoClasses = `active checked default defined disabled empty enabled first focus has(
    host hover indeterminate in-range invalid is( lang( last left link not( nth- only- optional out-of-range
    read- required right root scope target valid visited ` +
    // add pseudo ELEMENTS (for convenience)
    `after before cue first- selection slotted placeholder`;

const maxPseudos = pseudoClasses.split(/\s+/).reduce((a,b) => a.length > b.length ? a : b).length + 1,
      pseudoPat = new RegExp(`^[:]{1,2}(${RegExp.escape(pseudoClasses).replace(/\s+/g,'|')})`);

function testPseudo(css, i) {

    // is pseudo if:
    //   ':' followed by another ':' (pseudo ELEMENT: https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements)
    //   is followed by a pseudo class: https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes
    // is NOT pseudo if followed by a space

    if (css[i+1] === ':') return [true, 2]; // trivial case
    if (css[i+1] === ' ') return [false]; // trivial case
    const m = css.substring(i, i+maxPseudos).match(pseudoPat);
    return m ? [true, m[0].length] : [false]
}

export function parseCss(css) {

    const startingTime = Date.now();

    var i = 0, space = '', accumulating = '', propname; // current property name being parsed

    const keep = c => {accumulating += space + c; space = ''; };
    const accumulated = () => {
        const acc = accumulating;
        space = accumulating = ''; // reset
        return acc;
    }

    const spacer = () => accumulating.length ? (space = ' ') : (space = ''); // trims start

    const addProp = () => { selectors.last().rules.push({[propname]: accumulated()}); propname = ''; };

    const selectors = [ { rules: [], nestedRules: [] } ]; // [0] = root rules; nesting is by depth of this array

    while (i < css.length) {
        const c = css[i], nextc = css[i+1] || '';

        if (c === '/' && nextc === '*') {
            i+=2;
            while (i < css.length && (css[i] !== '*' || css[i+1] !== '/')) i++;
            i++;
            spacer();
        }
        else if (c === '/' && nextc === '/') {
            i+=2;
            while (i < css.length && css[i] !== '\n') i++;
            spacer();
        }
        else if (c === "'" || c === '"') {
            const openingQuote = c;
            var backslashCount = 0; // MUST keep track of UNeven back-slashes: even ones cancel each other out
            const unevenBackslashes = () => backslashCount % 2 === 1
            keep(c);
            i++;
            while (i < css.length && (css[i] !== openingQuote || unevenBackslashes())) { 
                (css[i] === '\\') ? backslashCount++ : (backslashCount=0);
                keep(css[i]);
                i++;
            }
        }
        else if (/^\s$/.test(c)) {
            while(i+1 < css.length && /^\s$/.test(css[i+1])) i++;
            spacer();
        }
        else if (c === '{') {
            // end of selector (could have many separated by commas: do we care?)
            // start of group of rules
            selectors.push({selector: accumulated(), rules: [], nestedRules: []});
        }
        else if (c === '}') {
            // end of current group of rules

            const lastPropVal = accumulated();

            if (propname && lastPropVal) {
                addProp();
            }
            else if (propname) {
                log('ERROR in css: property name but no value', propname);
            }
            else if (lastPropVal) {
                log('ERROR in css: property value but no property name', lastPropVal);
            }

            // now extract this as its own rule
            const thisRule = selectors.pop();
            selectors.last().nestedRules.push(thisRule);
        }
        else if (c === ':') {
            let [pseudo, skipAtLeast] = testPseudo(css, i);
            if (pseudo) {
                keep(c);
                // skip over at least next ':' (if any) and some part of pseudo (maybe all)
                while (--skipAtLeast) keep(css[++i]); 
            }
            else
                propname = accumulated(); // collect rule's prop name; start collecting its value
        }
        else if (c === ';') { // end of single rule
            addProp(); // collected its propname and value so add it to rule set
        }
        else {
            keep(c); // don't know what we have yet (selector, propname, prop value)
        }

        i++; // keep last & distinct for better code readability above
    }

    // convert:
    // - inflate nested classes: parent-selector my-selector { my rules }
    // - flag props with --var-names-- (prefix, postfix)
    //  - remember nesting selectors with that 1 rule: on update, re-add that rule
    // - FLAG '&' for replacement with SELF selector (usually for ::classes; else can just add nested selector)

    // How to allow for SCOPING: a UID for EACH component, and the css just for that

    log("PARSED CSS", selectors.first().nestedRules);
    log('TOOK ' + (Date.now() - startingTime) + 'ms');
}