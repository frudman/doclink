const log = console.log.bind(console);
log.error = console.error.bind(console); // TODO: console.error has DIFFERENT parms expectation than we do (1st string is a FMT string)

const fs = require('fs'),
      http = require('http');


// --- MODIFYING RUNTIME ENVIRONMENT
//const http = require('http');
Object.defineProperty(require('http').ServerResponse.prototype, 'json', {
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
    .split(' ') 
    .forEach(ext => require.extensions[`.${ext}`] = (module, file) => module.exports = fs.readFileSync(file, 'utf8'));


// --- UTILITIES
const mustache = (str,vars) => Object.entries(vars).reduce((sofar,[k,v]) => sofar.replace(`{{${k}}}`,v), str);
const sleep = delayInMS => new Promise(resolve => setTimeout(resolve, delayInMS));

function htmlNoPrivateComments(html) {
    // private comments start with '<!--- ' instead of '<!--' (3 dashes AND a space)
    return html.replace(/\s*[<][!][-]{3,}\s+.*?\s+[-]{2,}[>]/g, ' ');
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, resp => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => resolve(data));
        }).on("error", reject);
    });
}

function tryStaticFiles(res, ...files) { // last parm may be function to send first write(s): a "preamble" if static file is valid

    return new Promise((resolve,reject) => {
        const preamble = typeof files.last() === 'function' ? files.pop() 
                : file => res.writeHead(200, { 'Content-Type': mimetype(file, utfType(file)) });
        const file = files.shift(); // first one
        fs.createReadStream(file)
            .on('error', err => {
                if (err.code === 'ENOENT') { // Error - NO [such] ENTry
                    if (files.length)
                        tryStaticFiles(res, ...files, preamble) // some recursion
                            .then(resolve)
                            .catch(reject);
                    else 
                        reject({notFound: true});
                }
                else {
                    err.file = file; // which one failed
                    reject(err);
                }
            })
            .on('open', () => preamble(file)) // file is good so give caller chance to write something first (e.g. headers)
            .on('end', () => resolve(file)) // pipe auto-ends res (https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
            .pipe(res);
    });
}

// https://www.npmjs.com/package/mime (e.g. from 'filename.css' to 'text/css')
const mimetype = (file,charset) => require('mime/lite').getType(file) + (charset ? `; charset=${charset}` : ``);
const utfType = file => /[.](css|m?js|html)$/i.test(file) ? 'utf-8' : ''; // basically...

// for when converting markdown to html
const markdownIt = require(`markdown-it`),
      markdown = new markdownIt()
        .use(require(`markdown-it-anchor`))
        .use(require(`markdown-it-table-of-contents`)); // so we can add a [[TOC]]

module.exports = {
    log, 
    mustache,
    sleep,
    htmlNoPrivateComments,
    httpGet,
    tryStaticFiles,
    mimetype,
    utfType,
    markdown,
}
        