#!/usr/local/bin/node

// IMPORTANT: traditional '#!/usr/bin/env node' DOES NOT WORK when running as a Mac Application
// MUST use a simple ABSOLUTE path (runs without a shell?)

// 'npm install' this package will do the following:
// - ln -s `pwd`/index.js /usr/local/bin/doclink
// - chmod +x index.js 

const log = console.log.bind(console),
      path = require('path'),
      fs = require('fs'),
      http = require('http'),
      url = require('url'),
      { execFile } = require('child_process');

const VISUAL_CODE_EDITOR = '/usr/local/bin/code'; // must be an absolute path
const CHROME_BROWSER = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; // ALWAYS! (AND MUST be quoted to use on command line/shell)

const DOCLINK = `/usr/local/bin/doclink`; // as installed by npm (what if non install -g ?)

/* for reference:
    #!/bin/bash
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    APP="file:///Users/frederic/simplytel-dev/vue-webpack-1/vue-app-2/DOCS/LINUX.md"
    "$CHROME" --app="$APP"

    ## to auto close terminal window: method 1
    ## from: https://stackoverflow.com/questions/5125907/how-to-run-a-shell-script-in-os-x-by-double-clicking
    ##osascript -e 'tell application "Terminal" to close front window' > /dev/null 2>&1 &

    ## to auto close terminal window: method 2
    ## READ: https://stackoverflow.com/a/17910412/11256689
*/

if (process.argv.length === 3)
    linkDocument(process.argv[2]); // ~/... auto converted to /Users/frederic/... by shell
else if (process.argv.length === 4 && process.argv[2] === 'viewer')
    useAsViewer(process.argv[3]);

function linkDocument(docFile) {
    const desktopDir = `${process.env.HOME}/Desktop`; // where we put it for easy ref
    const file = docFile[0] === '/' ? docFile : `${process.env.PWD}/${docFile}`; // make absolute    
    const name = path.basename(file).replace(/[.]\w+$/i, ''); // remove extension (cleaner look for app name)    
    const appDir = `${desktopDir}/${name}.app/Contents/MacOS`,
          pkgInfo = `${desktopDir}/${name}.app/Contents/PkgInfo`,
          appPgm = `${appDir}/${name}`,
          pgm = `#!/bin/bash\n${DOCLINK} viewer "${file}"`;
    
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(appPgm, pgm, {mode: 0o755}); // rwx r-x r-x (ugo or a = user-group-others)
    fs.writeFileSync(pkgInfo, 'APPL???'); // yep, exactly like that
    
    log('created app ' + name + ' for ' + file + '\nas mac app ' + appPgm);
}

function useAsViewer(doc) {
    const SERVER = {
        HOSTNAME: 'localhost',
        PORT: 56789,
        get URL() { return `http://${SERVER.HOSTNAME}:${SERVER.PORT}`; },
    };
    
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
    
    const markdownIt = require(`markdown-it`),
          md = new markdownIt();
           
    md.use(require(`markdown-it-anchor`)); // Optional, but makes sense as you really want to link to something
    md.use(require(`markdown-it-table-of-contents`));
    
    var stickAround = false; // true if/when server is also started (i.e. first time)
    
    function showDocument() {
        execFile(CHROME_BROWSER, [`--app=${SERVER.URL}?doc=${encodeURI(doc)}`], err => {
            err ? process.exit(19) : stickAround || process.exit(0);
        });
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
                            + `\n\n**[${DOCLINK}** v.${require('./package.json').version}]`));
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
    
}
