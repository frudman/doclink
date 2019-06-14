// helpers        
export const log = console.log.bind(console);
log.error = console.error.bind(console);

export const qs = selector => document.querySelector(selector);
export const qsa = selector => document.querySelectorAll(selector); // use as for (const el of qsa('sel-here'))
export const spl = parts => parts.split('@');
export const on = (what, listener) => { let [evt,sel] = spl(what); qs(sel).addEventListener(evt, listener); };
export const toggleAttr = what => { let [attr,sel] = spl(what); qs(sel).toggleAttribute(attr); };

export const crEl = tag => document.createElement(tag);

export function attr(what, value) {
    let [attr,sel] = spl(what);
    if (value === true)
        qs(sel).setAttribute(attr, '');
    else if (value === false)// || value === undefined || value === null)
        qs(sel).removeAttribute(attr);
    else if (typeof value === 'string')
        qs(sel).setAttribute(attr, value);
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

export const post = (url, body) => fetch(url, { method: 'post', body});
