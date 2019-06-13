// helpers        
const qs = selector => document.querySelector(selector);
const spl = parts => parts.split('@');
const on = (what, listener) => { let [evt,sel] = spl(what); qs(sel).addEventListener(evt, listener); };
const toggleAttr = what => { let [attr,sel] = spl(what); qs(sel).toggleAttribute(attr); };

// main initialization
window.addEventListener('load', () => {
    on('click@a[edit-here]', () => toggleAttr('editing@main'));
    on('click@h2[toc]', () => toggleAttr('hide@div.table-of-contents'))
});
