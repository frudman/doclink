#!/usr/local/bin/node

// IMPORTANT: traditional '#!/usr/bin/env node' DOES NOT WORK when running as a Mac Application
// MUST use a simple ABSOLUTE path (runs without a shell?)

// 'npm install' this package will do the following:
// - ln -s `pwd`/index.js /usr/local/bin/doclink
// - chmod +x index.js 

// pgrep -f LINUX | xargs kill (or maybe pkill -f LINUX)
// restart finder: sudo killall Finder

// todo: each AppIcon.icns file is about 390K; maybe use a hard/soft link back to source dir instead?
//       - not sure if that works for mac os (i.e. link inside app's /Resources folder)
      
/* for reference from before:
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

//#region Basic Definitions

// this app ---
const GITHUB_PROJECT = 'https://github.com/frudman/doclink';
const DOCLINK = `/usr/local/bin/doclink`; // as installed by npm (what if npm install -g? different dir?)
const DOCLINK_FOLDER = __dirname;
const DOCLINK_VERSION = require('./package.json').version;


// helpers ---
const log = console.log.bind(console),
      path = require('path'),
      fs = require('fs'),
      http = require('http'),
      url = require('url'),
      { execFile, execFileSync } = require('child_process');

const mustache = (str,vars) => Object.entries(vars).reduce((sofar,[k,v]) => sofar.replace(`{{${k}}}`,v), str);
const sleep = (delayInMS, doAfter) => setTimeout(doAfter, delayInMS); // alt: sleep = delayMS => new Promise(resolve => setTimeout(resolve,delayMS)) 

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

Object.defineProperty(http.ServerResponse.prototype, 'json', {
    value(...args) {
        const obj = args.pop(), // always last
              code = args.pop() || 200;
        this.writeHead(code, { 'Content-Type': 'application/json' });
        this.end(JSON.stringify(obj));  
    }
});

Object.defineProperty(Array.prototype, 'last', {
    value() {
        return this.length > 0 ? this[this.length - 1] : undefined;
    }
});

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

// enables non-js requires: e.g. require('./text-based-file.css')
`txt html css x.js` // .x.js for template-based .js code (so won't interfere with require processing for normal modules)
    .split(' ') 
    .forEach(ext => require.extensions[`.${ext}`] = (module, file) => module.exports = fs.readFileSync(file, 'utf8'));

// https://www.npmjs.com/package/mime (e.g. from 'filename.css' to 'text/css')
const mimetype = (file,charset) => require('mime/lite').getType(file) + (charset ? `; charset=${charset}` : ``);
const utfType = file => /[.](css|m?js|html)$/i.test(file) ? 'utf-8' : ''; // basically...

// for when converting markdown to html
const markdownIt = require(`markdown-it`),
      md = new markdownIt()
            .use(require(`markdown-it-anchor`))
            .use(require(`markdown-it-table-of-contents`)); // so we can add a [[TOC]]


// APP SETTINGS ---
const VISUAL_CODE_EDITOR = '/usr/local/bin/code'; // must be an absolute path
const CHROME_BROWSER = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; // ALWAYS! (AND MUST be quoted to use on command line/shell)

const DOCLINK_ICONS = 'appicons';

// when running as a server
const SERVER = {
    HOSTNAME: 'localhost',
    PORT: 56789,
    get URL() { return `http://${SERVER.HOSTNAME}:${SERVER.PORT}`; },
};

// read: http://www.mactipsandtricks.com/website/articles/Wiley_HT_appBundles2.lasso
// using CoreFoundation keys (hence CF)
// CFBundleGetInfoString may be obsolete but still seems to work, so...
const INFO_PLIST = mustache(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleGetInfoString</key>
	<string>{{DOCLINK_VERSION}}, Copyright © 2019-{{YEAR}}, Freddy Inc.</string>
	<key>CFBundleIconFile</key>
	<string>{{DOCLINK_ICONS}}</string>
</dict>
</plist>`, {
    DOCLINK_VERSION,
    DOCLINK_ICONS,
    YEAR: new Date().getFullYear() + 1,
});

const srcLargestIcon = `${__dirname}/src-appicon-1024x1024.png`;
const commonAppIcons = `${__dirname}/macos-appicon.icns`;
const commonInfoPlist = `${__dirname}/macos-info.plist`;

//#endregion

if (process.argv.length === 3) {
    if (process.argv[2] === 'install')
        installDocLink();
    else if (process.argv[2] === 'stop')
        httpGet(`${SERVER.URL}/stop`);
    else // last arg is doc to be linked (i.e. given a desktop ref)
        linkDocument(process.argv[2]); // ~/... auto converted to /Users/frederic/... by shell
} 
else if (process.argv.length === 4 && process.argv[2] === 'viewer')
    useAsViewer(process.argv[3]); // last arg is doc to be viewed
else
    log('usage: doclink (file-to-be-viewed.md | install | stop)');

async function installDocLink() {

    // done one time: creates common info.plist & appicons.icns files used by all
    // - all created links (i.e. desktop apps) will softlink-point to these

    // Step 1 - Create app's icons first
    await createAppIcons(srcLargestIcon, commonAppIcons);

    // step 2:
    fs.writeFileSync(commonInfoPlist, INFO_PLIST);
}

function createAppIcons(src, dst) {

    // big whoaaa comment below no longer applicable because we now only create the icon
    // file once, during installation of this doclink app; from there on, any created links/apps
    // will then point back to this "common" file (i.e. a softlink, shown as an "alias" in a mac folder)

    // [comment below for ref only]
    // BIG WHOAAA!!!: it seems that the appicons.icns file must be created BEFORE copy to app directory
    // otherwise Finder does NOT seem to pick it its icons for the app
    // - possible reason: the file time must be at least a few seconds older than app itself???
    // - workaround below: create .icns file first, then wait a few seconds before creating the app itself
    
    // actual AppIcon.icns file generated from: iconutil -c icns AppIcon.iconset
    // files in .iconset are exactly as is (yes, 64 bit entries NOT there)
    // read: https://elliotekj.com/2014/05/27/how-to-create-high-resolution-icns-files/
    // also read: http://www.mactipsandtricks.com/website/articles/Wiley_HT_appBundles2.lasso
    // also read: https://applehelpwriter.com/tag/iconutil/

    // IMAGE LIBRARY: http://sharp.dimens.io/en/stable/ [WOW, very impressive!!!]
    // https://stackoverflow.com/questions/24026320/node-js-image-resizing-without-imagemagick/28148572
    const sharp = require('sharp');

    return new Promise(async (resolve,reject) => {
        
        log('creating app icon set\nfrom:', src, '\nto:', dst);

        const workFolder = path.dirname(dst) + '/' + path.parse(dst).name + '.iconset';
        fs.mkdirSync(workFolder, { recursive: true });

        // as required by Apple (generates exactly 10 entries); note: NO 64 bit entry...
        const icnsSizes = [ 16, 32, 128, 256, 512 ]; // no 64 entry...
        for (const size of icnsSizes) {
            await sharp(src).resize(size, size).toFile(`${workFolder}/icon_${size}x${size}.png`);
            await sharp(src).resize(size*2, size*2).toFile(`${workFolder}/icon_${size}x${size}@2x.png`);
        };

        // now MUST: iconutil -c icns AppIcon.iconset
        execFile('iconutil', ['-c', 'icns', workFolder], err => {
            if (err) 
                reject(err);
            else {
                log('all icons generated; removing ' + workFolder);
                execFileSync('rm', ['-rf', workFolder]);
                sleep(1000, resolve); // WORKAROUND from WHOAAA!!! above (not clear how long to wait: 1s seems to work)
            }
        });
    })
}

async function linkDocument(docFile, destDir = `${process.env.HOME}/Desktop`) {
    
    // bare minimum Mac OS application!

    const file = docFile[0] === '/' ? docFile : `${process.env.PWD}/${docFile}`; // make absolute    
    const name = path.basename(file).replace(/[.]\w+$/i, ''); // remove extension (cleaner look for app name)    
    const appContents = `${destDir}/${name}.app/Contents`,
          macOSDir = `${appContents}/MacOS`,
          resourcesDir = `${appContents}/Resources`,
          appPgm = `${macOSDir}/${name}`,
          pgm = `#!/bin/bash\n${DOCLINK} viewer "${file}"`;//, // YEP! that's the actual "program" :-)

    // Step 1 - create the app itself (folder & actual "program")
    fs.mkdirSync(macOSDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.writeFileSync(appPgm, pgm, { mode: 0o755 }); // rwx r-x r-x (ugo === a (for all) === user-group-others)

    // Step 1b - create softlink to app icon
    fs.symlinkSync(commonAppIcons, `${resourcesDir}/${DOCLINK_ICONS}.icns`)

    // Step 1c - create softlink to app's info.plist
    fs.symlinkSync(commonInfoPlist, `${appContents}/Info.plist`);

    // Step 1d - not required (kept here for ref)
    //fs.writeFileSync(`${appContents}/PkgInfo`, `APPL????`); // yes, '????' is valid!

    log(`created app ${name} for ${file}\nmac app: ${appPgm}`);
}

function useAsViewer(doc) {
                
    var stickAround = false; // true if/when server is also started (i.e. first time)
    
    function showDocument() {
        execFile(CHROME_BROWSER, [`--app=${SERVER.URL}${encodeURI(doc)}`], err => {
                err ? process.exit(19) : stickAround || process.exit(0);
        });
    }
    
    function editDoc(doc) {
        execFile(VISUAL_CODE_EDITOR, [doc]);
    }

    function startLocalServer() {
        const server = http.createServer((req, res) => {

            const purl = url.parse(req.url, true),
                  docc = purl.pathname, // differentiate from cmd-line doc
                  [openFolder, folderName] = docc.match(/^[/]open-folder([/].+)/) || [],
                  [editDocument, documentName] = docc.match(/^[/]edit-document([/].+)/) || [],
                  [gettingDoc, docName] = docc.match(/^[/]get-document([/].+)/) || [],
                  [savingDoc, docNameToSave] = docc.match(/^[/]save-document([/].+)/) || [];;
            
            // note: error in nodejs docs
            // - ref: https://nodejs.org/dist/latest-v12.x/docs/api/http.html#http_response_writehead_statuscode_statusmessage_headers
            // - .writeHead SHOULD allow for chaining (resp.writeHead(...).end(...)) but it DOES NOT!
            // todo: notify node folks

            // when must redirect to itself (else page clicked on would show nothing after click)
            const backToCaller = () => { res.writeHead(302, { Location: req.headers.referer }); res.end(); }
    
            if (/^[/]stop$/i.test(docc)) {
                res.end('ok, stopped\n');
                process.exit(0);
            }
            else if (/^[/]started[?]?$/i.test(docc)) {
                res.end('yes, started, all good\n');
            }
            else if (editDocument) {
                editDoc(documentName);
                backToCaller();
            }
            else if (openFolder) {
                execFile('open', [folderName]);
                backToCaller();
            }
            else if (gettingDoc) {
                fmtDoc(docName).then(content => res.json(content));
            }
            else if (savingDoc) {
                saveDocument(docNameToSave, req) // never fails
                    .then(updatedDoc => res.json(updatedDoc))
            }
            else {
                tryStaticFiles(res, `${__dirname}/viewer${docc}`)
                    .then(file => log('sent static file', file))
                    .catch(err => {
                        if (err.notFound) {                            
                            mainHtmlPage(docc, (body,type,code) => {
                                res.writeHead(code, { 'Content-Type': type });
                                res.end(body);
                                log('sent base page');
                            });
                        }
                        else {
                            log('file found but error sending', err);
                            res.writeHead(500, { 'Content-Type': 'text/plain'});
                            res.end('server error: ' + err.message);
                        }
                    })
            }
        });
          
        server.listen(SERVER.PORT, SERVER.HOSTNAME, () => {
            log(`doclink server running as ${SERVER.URL}`);
            stickAround = true;
            showDocument();
        });
    }
    
    // is there an instance already started?
    httpGet(SERVER.URL + '/started?')
        .then(showDocument) // yep, so use that one
        .catch(startLocalServer); // nope, so let's start one now
}

function saveDocument(filename, request) {
    return new Promise(resolve => {
        const bodyParts = [];
        request
            .on('data', chunk => bodyParts.push(chunk))
            .on('end', () => {
                const plainBody = Buffer.concat(bodyParts).toString();

                // save this TO FILE!!!
                fs.writeFileSync(filename, plainBody); // default is utf-8 (what we want)

                // lastly...
                resolve(fmtDocMD(filename, plainBody)); // may already have been rejected if there was an error...
            })
            .on('error', err => resolve({ error: 'not saved: ' + err.message }));
    });
}

function mainHtmlPage(DOCUMENT_FILE, cb) {
    // const html = require('./viewer/app.html'); // require does NOT reload on changes (do when dev complete)
    const html = fs.readFileSync(`${__dirname}/viewer/app.html`, 'utf8'); // while in dev mode

    const resp = htmlNoPrivateComments(mustache(html, {
        DOCUMENT_FILE,
        DOCLINK,
        DOCLINK_VERSION,
        DOCLINK_FOLDER,
        GITHUB_PROJECT,
        YEAR: new Date().getFullYear(),
    }));
    cb(resp, 'text/html; charset=utf-8', 200);
}

function fmtDocMD(doc, plain) {
    // doc used as a self ref
    return { doc, plain, html:`<h2 toc>table of content</h2>` + md.render('[[TOC]]\n\n' + plain), };
}

function fmtDoc(doc) {
    return new Promise(resolve => {
        fs.readFile(doc, 'utf8', (err, plain) => {
            if (err)
                resolve({doc, error: err.message || 'unknown error', html:`<h2>can't read this file</h2><p>${err.message}</p>`})
            else
                resolve(fmtDocMD(doc, plain));
        });    
    })
}
