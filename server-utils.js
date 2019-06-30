const log = console.log.bind(console);
log.error = console.error.bind(console); // TODO: console.error has DIFFERENT parms expectation than we do (1st string is a FMT string)
// - see code from viewer sode

const fs = require('fs'),
      http = require('http');


// --- MODIFYING RUNTIME ENVIRONMENT
Object.defineProperty(http.ServerResponse.prototype, 'json', {
    value(...args) {
        const obj = args.pop(), // always last
              code = args.pop() || 200;
        this.writeHead(code, { 'Content-Type': 'application/json' });
        this.end(JSON.stringify(obj));  
    }
});

// this is a PEEK last/first; should we rename it?
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


// enables non-js requires: e.g. require('./text-based-file.css')
`txt html css x.js` // .x.js for template-based .js code (so won't interfere with require processing for normal modules)
    .split(/\s+/) 
    .forEach(ext => require.extensions[`.${ext}`] = (module, file) => module.exports = fs.readFileSync(file, 'utf8'));


// --- UTILITIES
const mustache = (str,vars) => Object.entries(vars).reduce((sofar,[k,v]) => sofar.replace(`{{${k}}}`,v), str);
const sleep = delayInMS => new Promise(resolve => setTimeout(resolve, delayInMS));

function htmlNoPrivateComments(html) {
    // private comments start with '<!--- ' instead of '<!--' (3 dashes AND a space)
    // - they MUST also end with a space before terminating -->
    return html.replace(/\s*[<][!][-]{3,}\s+.*?\s+[-]{2,}[>]/g, ' ');
}

// convenient simple means to get text-based resource from another server
function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, resp => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => resolve(data));
        }).on("error", reject);
    });
}

function tryStaticFiles(resp, ...files) { // last parm may be function to send first write(s): a "preamble" if static file is valid

    // todo: could add check to see if 'file' is a directory, send file/index.??? instead
    // - ???: if only a single index.ext file, send that; if more than once (e.g. .js .css .html), then what?
    //      - could pass "expectation"? 
    // - OR, if there's an extension (e.g. abc.xyz) try for abc/index.xyz (if no abc.xyz)

    return new Promise((resolve,reject) => {
        const preamble = typeof files.last() === 'function' ? files.pop() 
                : file => resp.writeHead(200, { 'Content-Type': mimetype(file, utfType(file)) });
        const file = files.shift(); // first one
        fs.createReadStream(file)
            .on('error', err => {
                if (err.code === 'ENOENT') { // Error - NO [such] ENTry
                    if (files.length)
                        tryStaticFiles(resp, ...files, preamble) // some recursion
                            .then(resolve)
                            .catch(reject);
                    else 
                        reject({notFound: true});
                }
                else {
                    err.file = file; // which one failed
                    reject(err); // e.g. no such directory; can't open for read; ...
                }
            })
            .on('open', () => preamble(file)) // file is good so give caller chance to write something first (e.g. headers)
            .on('end', () => resolve(file)) // pipe auto-ends res (https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
            .pipe(resp);
    });
}

// https://www.npmjs.com/package/mime (e.g. from 'filename.css' to 'text/css')
const mimetype = (file,charset) => require('mime/lite').getType(file) + (charset ? `; charset=${charset}` : ``);
const utfType = file => /[.](css|m?js|html|svg)$/i.test(file) ? 'utf-8' : ''; // basically...

const textOrBinary = (function() {
    // determine content of file (text or binary)
    // - if on this list, can ALWAYS be edited at browser or with simple text editor
    // - do NOT add to list any known text/[type] or [type]/...xml: te?xt html? css md  markdown conf ya?ml xml svg
    // todo: keep this list where it can be edited, added to
    const textFiles = `(m|e)?js  php  java  cs  python  ruby  go
                       styl(us)?  less  s(a|c)ss
                       gitignore  settings  config  json5?`;

    const isTextPat = new RegExp('[.](' + textFiles.replace(/\s+/g, '|') + ')$', 'i');

    return filename => {
        const mime = mimetype(filename); // https://en.wikipedia.org/wiki/Media_type
        const isText = /^text|\bxml\b|javascript|\bjson\b/i.test(mime) || isTextPat.test(filename); 
        const encoding = isText ? 'utf8' : 'binary'; // so 1-treat unknowns as binary; 2-always default to utf8 for text
        return {isText, isBinary: !isText, mimetype: mime, encoding};
    }
})();



module.exports = {
    log, 
    mustache,
    sleep,
    htmlNoPrivateComments,
    httpGet,
    tryStaticFiles,
    mimetype,
    utfType,
    textOrBinary,
}
        