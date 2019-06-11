#!/usr/local/bin/node

// IMPORTANT: traditional '#!/usr/bin/env node' DOES NOT WORK when running as a Mac Application
// MUST use a simple ABSOLUTE path (runs without a shell?)

const log = console.log.bind(console);

const http = require('http'),
      url = require('url'),
      fs = require('fs'),
      { execFile } = require('child_process');

const SERVER = {
    HOSTNAME: '127.0.0.1',
    PORT: 56789,
    get URL() { return `http://${SERVER.HOSTNAME}:${SERVER.PORT}`; },
};

const VISUAL_CODE_EDITOR = '/usr/local/bin/code'; // must be an absolute path
const CHROME_BROWSER = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; // ALWAYS! (AND MUST be quoted to use on command line/shell)

const THIS_APP_DOC = fs.readFileSync(__dirname + '/docfile'); // a full file path
const DOCLINK_SOURCE = fs.readFileSync(__dirname + '/doclink-source');

// MUST be replaced with actual src files (i.e. where doclink is installed)
// doclinkSourceInstallation
//const DOCLINK_SOURCE = `/Users/frederic/simplytel-dev/doclink`;
const srcModules = `${DOCLINK_SOURCE}/node_modules`; 

const htmlPageTemplate = `<!doctype html>
<html>
    <head>
    </head>
    <body>
        {{content-here}}
    </body>
</html>`;

function htmlPage(body) {
    return htmlPageTemplate.replace('{{content-here}}', body);
}

// 3 ways to install this:
// - npm install it: requires copying package.json file; then exec npm install for each app
// - npm install GLOBAL those required here (and assume they'll get picked up here: do once from source app)
// - explicit path to source installs: WHAT WE USE BELOW (requires usage of reqModule below)

// required FOR ALL NON-STANDARD modules because there is NO node_modules dir in mac os app's generated folder
const reqModule = mod => require(`${srcModules}/${mod}`);

const MarkdownIt = reqModule(`markdown-it`),
      md = new MarkdownIt();
       
md.use(reqModule(`markdown-it-anchor`)); // Optional, but makes sense as you really want to link to something
md.use(reqModule(`markdown-it-table-of-contents`));

var stickAround = false; // true if/when server is also started (i.e. first time)

function showDocument() {

    //fs.readFile(THIS_APP_DOC, (err,url) => {
        // chrome switches: https://peter.sh/experiments/chromium-command-line-switches/

        // method 1: runs with a shell (slower, heavier)
        // exec(`"${chromeBrowser}" --app="${SERVER.URL}?doc=${encodeURI(err ? `docfile-problem:${err.message}` : url)}"`, err => {
        //     err ? process.exit(19) : stickAround || process.exit(0);
        // });

        // method 2 (better): execFile to run without the shell (not needed)
        // execFile(CHROME_BROWSER, [`--app=${SERVER.URL}?doc=${encodeURI(err ? `docfile-problem:${err.message}` : url)}`], err => {
        //     err ? process.exit(19) : stickAround || process.exit(0);
        // });
        execFile(CHROME_BROWSER, [`--app=${SERVER.URL}?doc=${encodeURI(THIS_APP_DOC)}`], err => {
            err ? process.exit(19) : stickAround || process.exit(0);
        });
    //})
}

function editFile(doc) {
    execFile(VISUAL_CODE_EDITOR, [doc]);
}

function fmtDoc(doc, cb) {
    fs.readFile(doc, (err, data) => {
        var type = 'text/plain', code = 200, resp = '';
        if (err) {
            code = 400;
            resp = err.message;
        }
        else {
            type = 'text/html';
            resp = htmlPage(md.render(`\n\n[file:/${doc}](${SERVER.URL}/edit?doc=${encodeURI(doc)})\n\n[[TOC]]\n\n` 
                        + data 
                        + `\n\n**doclink source: ${DOCLINK_SOURCE}**`));
        }

        cb(resp, type, code);
    });
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

function startLocalServer() {
    const server = http.createServer((req, res) => {
        
        const doc = () => decodeURI(url.parse(req.url, true).query.doc || '');

        // note: error in nodejs docs
        // - ref: https://nodejs.org/dist/latest-v12.x/docs/api/http.html#http_response_writehead_statuscode_statusmessage_headers
        // - .writeHead SHOULD allow for chaining (resp.writeHead(...).end(...)) but it DOES NOT!
        // todo: notify node folks

        if (/^[/](stop|kill)$/i.test(req.url)) {
            res.end('ok, stopped\n');
            process.exit(0);
        }
        else if (/^[/]started[?]?$/i.test(req.url)) {
            res.end('yes, started, all good\n');
        }
        else if (/^[/]edit[?]/i.test(req.url)) {
            editFile(doc());
            // redirect to itself (else page clicked on would show nothing after click)
            res.writeHead(302, { Location: `${SERVER.URL}?doc=${encodeURI(doc())}` }); 
            res.end();
        }
        else {
            fmtDoc(doc(), (body,type,code) => {
                res.writeHead(code, { 'Content-Type': type });
                res.end(body);
            });
        }
    });
      
    server.listen(SERVER.PORT, SERVER.HOSTNAME, () => {
        log(`doclink server running as ${SERVER.URL}`);
        stickAround = true;
        showDocument();
    });
}

// see if an instance is already running
httpGet(SERVER.URL + '/started?')
    .then(showDocument)
    .catch(startLocalServer);

// #!/bin/bash
// CHROME_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
// "$CHROME_BROWSER" --kiosk --app="http://127.0.0.1:56351?doc=sdfgsdfgsdfgsdf"
