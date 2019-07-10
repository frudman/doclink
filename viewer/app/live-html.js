// magic, part 1


import { log, on, qs, toCamel, nullObj } from './utils.js';
//import { parseHtml } from './html-parser.js';

import { parseCss } from './css-parser.js';


const attribsToObj = el =>[...el.attributes]
        .reduce((obj,attr) => { obj[attr.name] = attr.value || true; return obj; }, nullObj());


/*
    loading a component:
    - implicitly: via <html-tag @events :attrs $directives>
        - looks for 'html-tag' in loaded components
            - executes its .new method with attributes, events
                - directives are handled by the parent
    - explicitly: via el.append(comp.new({
        '@events': ()=>{},
        $directive: '...',
        ':attr': '...',
    }))

    access a component:
        doctypeCompApi.load('component-name' [,url]);
            returns component's API
            SHOULD have:
                .new({parms}) to create a new instance of this component
                    -> returns array of elements (or just one)

    <!doctype vue-component>
    <!doctype react-component>


    BUT, everyone's component will have very different CSS requirements (i.e. styling)
    IS IT REALISTIC to think there's a need for such a service???
*/

/* once uploaded to doctype-components.io/...

    individual parts are combined into a single file
    - .less/scss/stylus files are built then added as <style> to downloadable component
    - small binaries converted to base64 (images, audio, ...)
    - all these must be referenced directly in the file
    - all else left untouched

    - maybe ALSO create a .min.html version:
        - comments removed
        - js/css/html minified
        - comment at top: source available as https://doctype-component/@user-id/comp-name.1.3.1

*/


// 2 parts:
// 1- set obj in observable mode (convert to get/setters; add event listening based on names)
// 2- parse html to use live object from (1)
//  2b- be efficient in re-rendering elements (reorder but don't redraw if unchanged)

const domparser = new DOMParser(); // reusable? TBV
function parseComponentHtml(htmlSrcCode) {

    // MUST MUST USE: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
    // - special case for text/html: MUST READ
    // Do NOT parse html manually:
    // - https://stackoverflow.com/questions/1732348/regex-match-open-tags-except-xhtml-self-contained-tags/1732454#1732454

    // FIREFOX: see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
    return domparser.parseFromString(htmlSrcCode, 'text/html'); 
}

const META = {
    USES: Symbol('uses-these-components'),
    REQUIRES: Symbol('requires-these-things(!)'),
    SUPPORTS: Symbol('supports-these-platforms'),
};

export function loadComponent(componentName, srcCode) {

    // enforce <!doctype component>?
    if (/^\s*[<][!]doctype\s+component[>]\s*$/i.test(srcCode))
        return { error: 'not a valid component' }

    const doc = parseComponentHtml(srcCode);
    const staticData = componentsStatics[componentName] || (componentsStatics[componentName] = {});

    log('DOCIN', doc.head, doc.body);

    const compData = {
        get name() { return componentName; }, // read only
        staticData, // 1 of these for ALL components of this type

        // from doc
        meta:{
            [META.USES]: [], // components
            [META.REQUIRES]: [], // ??? custom reqs?
            [META.SUPPORTS]: [], // platforms
        }, 

        html:{}, 
        style:{}, 
        script:{}, 

        // add useful methods here...
        api: { 
            load: {
                css(){},
                html: loadHtmlX,
            },
            live(obj) { return liveMe(obj); }, // this live must be tied to load() above (for control model)
            log,
        },

        // how to create an instance of that component programatically
        // (can create implicitly within html using <component-name ...>)
        new(root = false) { // root: create a parent div if not already single-rooted
            // create a new instance of this component
            // returns:
            // - root === false: an array of elements (can have just 1 entry)
            // - root === truthy: a root element containing the component
            //    - if component already has a root element, that element is returned
            //    - if component did not have a root, a parent div is created as the top level
            //    - ALSO, if root is a string, that string is added as attribute to root element
            //       (whether naturally rooted, or div-created as root)

            // returned value (array or element) has EXPLICIT HELPER API:
            // - .appendTo(domEl); .prependTo(...) .appendAfter(...) .appendBefore(...) .replace(...)
            // .isSingle .isRooted === true is only 1 top element
            // .asSingle() returns top element if single; else creates a parent div for elements
        }
    };

    var t = false;
    parseParts(doc.head);
    t=true;
    parseParts(doc.body);

    function parseParts(parts) {
        var first = true;
        for (const tl of parts.children) { 
            // .children because don't care about non-content nodes
            // ignore all other nodes (what about cdata nodes? (e.g. to store image data or such?))
            if (tl.nodeType === Node.ELEMENT_NODE) {
                const tag = tl.nodeName.toLowerCase(), // lc needed?
                    id = tl.getAttribute('id');
                //if (t) 
                //log('TAG: ' + tag);
                if (tag === 'meta') {
                    if (tl.attributes.length === 0) continue;

                    const singleAttr = tl.attributes.length === 1;
                
                    if (singleAttr) {
                        const {name,value} = tl.attributes[0];
                        log('single attr', name, value.length === 0 ? '--' : value)
                        const parts = name.split('.'),
                              varName = parts.shift(),
                              srcp = parts.indexOf('src'),
                              hrefp = parts.indexOf('href');
                        if (srcp > -1)
                            var src = parts.splice(srcp, 1);
                        if (hrefp)
                            var src = parts.splice(hrefp, 1);
                        const resType = parts.pop() || ''; // should be last one, if any
                        if (src) {
                            // downloading content
                            // uses promise, but need to know when all meta loaded
                            compData.meta[toCamel(varName)] = compData.meta[varName] = 'download.' + (resType?`${resType}.`:'') + value;
                        }
                        else {
                            // immediate content
                            compData.meta[toCamel(varName)] = compData.meta[varName] = value.length === 0 ? true : value;
                        }
                        continue;
                    }

                    // supports requires uses 
                    // requires=...
                    const first = tl.attributes[0].name.toUpperCase();//LowerCase();

                    if (first in META) {
                        const x = [...tl.attributes],
                              skip = x.shift(), // skips first one
                              zz = x.map(({name,value}) => value ? {[name]:value} : name)
                        //log('pp', zz);//[...tl.attributes])
                        compData.meta[META[first]].push(...zz);
                    }
                    else {
                        const name = tl.attributes[0].value;// .name should be 'name';
                        const {name:aname,value} = tl.attributes[1];
                        // must now parse next attribute: content...=... or src...=... or href...=...
                        // name=varname content=... or src= or href=...
                        const existing = compData.meta[name],
                              newVal = aname + ':' + value;
                        if (Array.isArray(existing))
                            existing.push(newVal);
                        else if (typeof existing === 'string') 
                            compData.meta[toCamel(name)] = compData.meta[name] = [ existing, newVal];
                        else
                            compData.meta[toCamel(name)] = compData.meta[name] = newVal;
                    }
                }
                else if (/^meta[-]/i.test(tag)) {
                    const name = tag.substring(5),
                          content = tl.innerHTML.trim();//.textContent.trim();
                    compData.meta[name] = content;

                    // todo: multiple metas of same: append? treat as array?
                }
                else if (tag === 'style') {
                    // may make some sense to allow $conditional on CSS (e.g. based on device)?
                    // or do via @media tags, within <style> section?
                    if (id) compData.style[id] = (compData.style[id] || '') + tl.textContent;
                    else {
                        compData.style.default = (compData.style.default || '') + tl.textContent; // or .htmlContent? for "visible" stuff?
                    }
                }
                else if (tag === 'script') {

                    // scripts should be pre-compiled when requested: doc.script.idName is already a Function
                    // and simply returns it's result (likely it's api)
                    // scripts are executed just once, and on demand for all those with IDs

                    // other attributes on a script tag?
                    // - src? on-demand? 

                    //attribsToObj(tl);
                    const idx = id || 'default';
                    if (!(compData.script[idx]))
                        compData.script[idx] = [];

                    compData.script[idx].push(tl);

                    // if (id) compData.script[id] = (compData.script[id] || '') + tl.textContent;
                    // else {
                    //     compData.script.default = (compData.script.default || '') + tl.textContent; // or .htmlContent? for "visible" stuff?
                    // }
                }
                else { // treat as html tag
                    if (id)
                        compData.html[id] = tl;
                    if (!(tag in compData.html))
                        compData.html[tag] = [];
                    compData.html[tag].push(tl);
                }
            }
        }        
    }

    prepareScripts(compData);

    parseCss(compData.style.default);

    // activate main script?

    log('PPx', compData.script);



    return compData;

    // once loaded, run any script? or run script only if loaded?
    // what if need to attach to main doc? 

    // each component returns its access api:
    // - for component
    //  - { new(for new instances) display(if-static-singleton) }
    // - for each instance of that component
    //  - render()?



    const componentExport = script.call(compData, windowStub, documentStub, evalStub); // so docApi becomes the 'this';
    log('COMPONENT EXPORT', componentName, componentExport); // export can be API, data (text? binary? image/audio?), other? (object, function?)





    for (const el of qsa('script', doc)) {
        if (!el.id) runScript('component-name-here', el);
    }

    const dataModel = {}; // live here or set to live later? or either way?
    const arrayOfElements = parseHtml('main-part', doc, dataModel);
    // these can then be added as needed to parent doc
    log('ADDING TO DOC', arrayOfElements);

    // log('goty-2', doc.doctype, doc, doc.head, doc.body);
    // for (const tld of doc.childNodes) {
    //     //log('got', tld.nodeType, tld.nodeName); // 10=doctype; 8=comment; 1=html
    //     if (tld.nodeType === 10) log('DOCTYPE is', tld.name);//nodeName);
    // }
    // for (const el of doc.head.childNodes)
    //     x('head', el);
    // for (const el of doc.body.childNodes) 
    //     x('body', el);

    // function x(title, el) {
    //     if (el.nodeType === 8)
    //         return;
    //     else if (el.nodeType === 3) {
    //         const t = el.innerText || '';
    //         if (t.length && !/\s+/.test(t))
    //             log(title, '#TEXT', t);
    //     }
    //     else
    //         parseDoctypeComponentTag(el);//log(title, 'node', el.nodeType, el.nodeName);
    // }

    return compData;
}

function prepareScripts(comp) {
    const scripts = comp.script; // an object

    const def = scripts.default;
    var code = '', attrs = nullObj();
    while (def.length) {
        const x = def.shift();
        code += x.textContent + '\n\n';
        Object.assign(attrs, attribsToObj(x));
    }
    //log('default code', attrs, code);

    var fcn = false;
    Object.defineProperty(comp.script, 'default', {
        get() {
            if (!fcn) {
                fcn = genScriptRuntime(code); // now an async function
            }
            return fcn;
        }
    })

    // if (def.length === 0) {
    //     // no activating script
    // }
    // else if (def.length === 1) {
    //     // single activating script
    // }
    // else {
    //     // multiple: combine content; what about their attributes (merge?)
    // }

    // a component can be:
    // - not yet downloaded (download on demand)
    // - downloaded (not yet activated/initialized)
    // - activated (initialized but not loaded anywhere, if ever)
    // - loaded somewhere

    return comp;
}




// same for all arrays so do only once
// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
// calling any of these ARRAY methods triggers change notification
// BIG ISSUE: custom methods that modify array (e.g. like .first() if was destructive) are NOT HANDLED here
const modifyingMethods = 'pop push shift unshift copyWithin fill reverse sort splice'.split(/\s+/); 
const notProxied = (ignored_parent_obj, ignored_propName, arr, idx) => arr[idx]; // passthrough get
const arrProxy = modifyingMethods.reduce((proxy,methodName) => { // proxied get (because method that changes array)
    proxy[methodName] = (parent_obj, arrayPropName, array, ignored_index) => (...args) => {
        const results = array[methodName](...args); // do the work (proxy call)
        notifyOfChanges(parent_obj, arrayPropName, results, 'changed array: ' + arrayPropName + '.' + methodName + '(', ...args, ')');
        return results;
    };
    return proxy;
}, {});

const componentsStatics = {};

// prevent webpack/babel from removing async syntax (which would neutralize its intended effect) when going ES6->ES5
// see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
export const AsyncFunction = new Function(`return Object.getPrototypeOf(async function(){}).constructor`)();

// easy to circumvent but block for trivial (accidental) access
// also: Function (but can get around that); other evident ones?
const windowStub = nullObj();//Object.create(null);
const documentStub = nullObj();//Object.create(null); // BUT will those limitations REDUCE flexibility of component usability?
const evalStub = () => {};  // or just nullObj?
// Function is also into global space (but blocking it is futile since can always get it as (function(){}).prototype...

// maybe define a component as self-contained vs needs-rights?

export function genScriptRuntime(scriptCode) {//el) {
    //const scriptCode = el.textContent; // get script content
    try {
        // AsyncFunction to allow for slow loading components (they can use await at top level)
        return new AsyncFunction('doctypeComponentApi', 'window', 'document', 'eval', scriptCode); // other backdoor globals to remove?
    }
    catch(err) {
        log.error('INVALID SCRIPT', err, {code: [scriptCode]});
        return () => {};
    }
}


const liveObjMeta = Symbol('live-object-for-live-dom');

export const ONLIVEDATA = Symbol('live-object-listening-for-changes');

// MUST allow for loading MULTIPLE components at once and get back a SINGLE BUILT FILE
// from doc-comp.io

// doc-lib comp-lib doctype-lib

export function runScript(componentName, el) {
    const script = genScriptRuntime(el);
    // static data for ALL instances of THIS component
    const staticData = componentsStatics[componentName] || (componentsStatics[componentName] = {});

    const docApi = {
        html:{}, 
        style:{}, 
        meta:{}, 
        api: { // add useful methods here...
            load: {
                css(){},
                html: loadHtmlX,
            },
            live(obj) { return liveMe(obj); }, // this live must be tied to load() above (for control model)
            log,
        },

        // 1 of these for ALL components of this type
        staticData, 
        get name() { return componentName; }, // read only
    };

    const componentExport = script.call(docApi, windowStub, documentStub, evalStub); // so docApi becomes the 'this';
    log('COMPONENT EXPORT', componentName, componentExport); // export can be API, data (text? binary? image/audio?), other? (object, function?)

    //parseHtml(el);
}

function loadHtmlX(str, ctrl) {
    // ctrl should already be LIVE
    log('NOT IMPL: loading html componenet', str, ctrl);
}

const fullName = (prop,parent) => parent ? ((parent.name || 'root') + '.' + prop) : prop;

const notifyOfChanges = (() => {

    // inspired from: https://dbaron.org/log/20100309-faster-timeouts
    // also read: https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout#Reasons_for_delays_longer_than_specified
    // and consider using setInterval instead?

    // can it be TOO fast? (i.e. exec before next loop?)

    var queue = [];
    var queuedEvent = `queued-in-order-events`;

    function addToQueue(fn) {
        queue.push(fn);
        window.postMessage(queuedEvent, "*"); // *?
    }

    // function handleMessage(event) {
    //     if (event.source === window && event.data === queuedEvent) {
    //         event.stopPropagation();
    //         queue.length && queue.shift()(); // queue.length should never be 0 since only post message after push to queue (still...)
    //     }
    // }

    // window.addEventListener("message", handleMessage, true);

    on("message", window, event => {
        if (event.source === window && event.data === queuedEvent) {
            event.stopPropagation();
            //queue.length && 
            queue.shift()(); // queue.length should never be 0 since only post message after push to queue (still...)
        }
    })

    return (obj, propName, newValue, ...fyi) => addToQueue(() => {
        // TODO: ...call listeners for propName here...
        // for now
        log('DOM UPDATE: ' + fullName(propName, obj) + '=', newValue);
        fyi.length && log('\t', ...fyi);
    })
})();

function liveMe(obj, parent) {

    // this is the core of the engine: changes to the object's properties are tracked as they occur (live) and each of these changes
    // trigger a notification (to whoever is listening for those)
    // (i.e. the model) controlling the component; many edge cases when changing/updating arrays & objects

    // we return the actual (i.e. original) object so that when other parts of the app can access it (and so control
    // the live dom)
    // BUT, each prop is modified to become a getter/setter so that notifications can occur on settings
    // - sub-props (object, functions) and array elements are also "observed" for changes

    // for now:
    // - new props are ignored in event notifications 
    //      - eventually, could return a parent proxy for this? (so all objs become proxies)
    // - ancestor props are ignored: just use "simple" objects
    
    // should we SEAL/FREEZE obj afterwards (then flag as error when changed)?
    // seal: can't change structure (?)
    // freeze: can't change struture or values

    if (liveObjMeta in obj) {// WHAT IF simply another call to same?
        //throw new Error(`CYCLE in live object ${parent ? parent.name : ``}`); // or is it OK? just return?
        log(`DONE ALREADY OR CYCLE in live object ${parent ? parent.name : ``}`)
        return obj;
    }
    
    //getSetProps(obj, parent);

    //function getSetProps(obj, parent) {
        obj[liveObjMeta] = parent; // meta: undefined if root, or contains: { .name .obj }
        obj[ONLIVEDATA] = detectChanges.bind(obj);

        // todo? could also walk up the chain: https://stackoverflow.com/a/8024294/11256689
        // for now, direct props, not in proto chain
        const observerdProps = Object.getOwnPropertyDescriptors(obj); 

        // .enumerable .configurable .writable .value .get .set

        for(const [p,observed] of Object.entries(observerdProps)) {
            if (observed.enumerable && observed.configurable) {
                if (observed.writable && 'value' in observed) {
                    observe(p, obj, parent);
                }
                else if ('get' in observed || 'set' in observed) {
                    log('TODO: SKIPPED for now: getter/setter prop: '+ p);// + '=', opt);
                }
                else
                    log('SKIPPED for now: '+ p, observed); // is this possible?
            }
            else {
                log('not enumerable or configurable - skipping', p, observed); // is that an issue?
            }
        }           
    //}


    return obj;
}

function observe(prop, obj, parent) {

    // for each prop, replace it with an explicit proxy? (lots of little proxies?)
    //  - but then folks can keep using the object itself;
    //  - in fact, MUST be able to use object itself (else how to set things, props, values)?
    // or single proxy for whole object? (more efficient?)

    // todo: add Map & Set (to array and functions); add others?


    let curVal;
    
    // first time
    setMe(obj[prop], false);

    function setMe(val, notify) {
        if (Array.isArray(val))
            curVal = trapArray(obj, prop, val); // a proxy
        else if (typeof val === 'function')
            curVal = trapFunction(obj, prop, val); // a proxy
        else if (typeof val === 'object')
            curVal = liveMe(val, { // recursion
                // parent info (i.e. obj) for sub props
                obj,
                name: parent ? (parent.name + '.' + prop) : prop,
            });
        // todo: else if (MAP or SET, maybe others?)
        else { // primitives
            curVal = val;
        }
        notify && notifyOfChanges(obj, prop, curVal);
    }

    // all props REPLACED (converted) to getter/setters so can listen when setting
    Object.defineProperty(obj, prop, {
        get() { return curVal; },
        set(val) { setMe(val, true); }
    });

}

function trapFunction(parentObj, prop, curFcn) {
    
    // need to walk fcn first to detect attached props...
    // so, treat it as an object

    //const leaveAlone = 'arguments caller length name prototype'; // prop names to ignore in a function (NOT custom)...

    // const allProps = Object.getOwnPropertyDescriptors(curFcn);
    // const customProps = Object.entries(allProps).filter(([k,v]) => v.enumerable && v.configurable);
    // //log('FCN HACKx', prop + '()', customProps);

    // for (const [p,observed] of customProps) {
    //     if (observed.writable && 'value' in observed) {
    //         observe(p, curFcn, parentObj);
    //     }
    //     else if ('get' in observed || 'set' in observed) {
    //         log('TODO: SKIPPED for now: getter/setter prop: '+ p);// + '=', opt);
    //     }
    //     else
    //         log('SKIPPED for now: '+ p, observed); // is this possible?
    // }

    liveMe(curFcn, {
        obj: parentObj,
        name: parentObj.name + '.' + prop,//curFcn.name, // note: extra FCN's name since not a real obj but an extension to a function
    })


    return new Proxy(curFcn, {
        get(ignored_target, subObjName){
            return curFcn[subObjName]; // correctly returns observed's GET results?
        },
        set(ignored_target, subObjName, value) {

            curFcn[subObjName] = value; // correctly uses observed's SET value?

            return true; // Proxy.set() MUST ALWAYS return true (if setting is accepted)
        },
        apply(target, thisArg, argsList){ // calling me as a function
            curFcn.apply(thisArg, argsList);
        }
    });
}

function trapArray(obj, arrayPropName, array) {

    // flags changes to array itself, NOT changes to objects WITHIN the array
    // - changes to objects within array must be flagged separately if needed (i.e. from independent means
    //   of accessing that object, so explicit ref/access); FOR-LOOP constructs? (sets each individually)

    return new Proxy(array, {
        get(ignored_target, index){
            return (arrProxy[index] || notProxied)(obj, arrayPropName, array, index);
        },
        set(target, index, newValue){
            array[index] = newValue; // MUST CONVERT HERE, right??? but how would listeners have been set???
            // are we notifyin that array changed or is event 'array @ index' changed?
            notifyOfChanges(obj, arrayPropName, array, 'set [' + index + '] to ', newValue);

            return true; // Proxy.set() MUST ALWAYS return true (if setting is accepted)
        },
    })
}

function detectChanges(data) {

}
