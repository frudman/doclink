#!/usr/local/bin/node

// IMPORTANT: traditional '#!/usr/bin/env node' DOES NOT WORK when running as a Mac Application
// MUST use a simple ABSOLUTE path (runs without a shell?)

// 'npm install' this package will do the following:
// - ln -s `pwd`/index.js /usr/local/bin/doclink
// - chmod +x index.js 

// if already running, stop it with: curl localhost:56789/stop
// start manually:
// - from this folder: node . start

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

const DEV_MODE = true; // keep true while changing viewer/app.html
const YEAR = new Date().getFullYear();


// helpers ---
const { log, mustache, sleep, htmlNoPrivateComments, httpGet, tryStaticFiles, markdown } = require('./utils');

const path = require('path'),
      fs = require('fs'),
      http = require('http'),
      url = require('url'),
      { execFile, execFileSync } = require('child_process');


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
                sleep(1000).then(resolve); // WORKAROUND from WHOAAA!!! above (not clear how long to wait: 1s seems to work)
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

function startLocalServer() {

    // a server always runs after calling this method
    // this method returns [a promise] whether the caller (a process) should:
    // - stick around (true) because server was launched by us (and must remain live for others)
    // - exit after done (false) because server launched by someone else so we can exit when our task is done

    // must first find out: is there an instance already started?
    return httpGet(SERVER.URL + '/started?')
        .then(() => false) // yes, already running, no need for us to stick around
        .catch(err => { // nope...
            startServer(); // ...so let's start one now...
            return true; // ...then let caller know to stick around after its task is done
        }); 

    function startServer() {
        http.createServer((req, res) => {

            const purl = url.parse(req.url, true),
                urlPath = purl.pathname, // differentiate from cmd-line doc
                [openFolder, folderNameToOpen] = urlPath.match(/^[/]open-folder([/].+)/) || [],
                [editDocument, docNameToEdit] = urlPath.match(/^[/]edit-document([/].+)/) || [],
                [gettingDoc, docName] = urlPath.match(/^[/]get-document([/].+)/) || [],
                [savingDoc, docNameToSave] = urlPath.match(/^[/]save-document([/].+)/) || [];;
            
            // note: error in nodejs docs
            // - ref: https://nodejs.org/dist/latest-v12.x/docs/api/http.html#http_response_writehead_statuscode_statusmessage_headers
            // - .writeHead SHOULD allow for chaining (resp.writeHead(...).end(...)) but it DOES NOT!
            // todo: notify node folks

            // when must redirect to itself (else page clicked on would show nothing after click)
            const backToCaller = () => { res.writeHead(302, { Location: req.headers.referer }); res.end(); }

            if (/^[/]stop$/i.test(urlPath)) {
                res.end('ok, stopped\n');
                process.exit(0);
            }
            else if (/^[/]started[?]?$/i.test(urlPath)) {
                res.end('yes, started, all good\n');
            }
            else if (editDocument) {
                res.end();
                execFile(VISUAL_CODE_EDITOR, [docNameToEdit]);
                //backToCaller();
            }
            else if (openFolder) {
                res.end();
                // todo: 'open' works on Macs (what about linux? windows? probably not...)
                execFile('open', [folderNameToOpen === '/doclink-folder' ? __dirname : folderNameToOpen]); 
                //backToCaller();
            }
            else if (gettingDoc) {
                fmtDoc(docName).then(content => res.json(content));
            }
            else if (savingDoc) {
                saveDocument(docNameToSave, req) // never fails
                    .then(updatedResults => res.json(updatedResults))
            }
            else {
                tryStaticFiles(res, `${__dirname}/viewer${urlPath}`)
                    .then(file => log('sent static file', file))
                    .catch(err => {
                        if (err.notFound) {                            
                            mainHtmlPage(urlPath, (body,type,code) => {
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
        }).listen(SERVER.PORT, SERVER.HOSTNAME, () => {
            log(`doclink server running as ${SERVER.URL}`);
        });
    }
}

// eventually, for our browser app:
// chrome/firefox: mac, windows (10, 8.1, 7?), linux (ubuntu only?)
// - covers all OS platforms
// then: safari on mac; Edge on windows
// - no IE? (likely not, since edge avail on all now (right?); but if not, chrome/firefox)

// iPhone/Android?
// - for monitoring & some admin
// iPads, tablets:
// - for monitoring & more admin; minor content edits
// Desktop:
// - admin, content creation

function useAsViewer(doc) {

    // - https://peter.sh/experiments/chromium-command-line-switches/
    // - http://www.chromium.org/developers/how-tos/run-chromium-with-flags (window, linux, mac)
    // - https://v8.dev/


    doc && startLocalServer().then(stickAround => execFile(CHROME_BROWSER, [`--app=${SERVER.URL}${encodeURI(doc)}`], err => {
        // if error launching browser, exit with a distinct error code (19!) [killing server as well, if it was launched here]
        // if no error, exit if only launched browser (running on its own, so we're done)
        // if no error, do NOT exit if we also launched the server (keeps it available for subsequent requests from other docs)
        err ? process.exit(19) : stickAround || process.exit(0);
    }));
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

const mainHtmlPage = (function(dev) {
    if (dev)
        return (DOCUMENT_FILE, cb) => {
            const html = fs.readFileSync(`${__dirname}/viewer/app.html`, 'utf8'); // re-reads it EVERY TIME

            // full rendering every time
            const resp = htmlNoPrivateComments(mustache(html, {
                DOCUMENT_FILE,
                DOCLINK,
                DOCLINK_VERSION,
                DOCLINK_FOLDER,
                GITHUB_PROJECT,
                YEAR: new Date().getFullYear(),
            }));

            cb(resp, 'text/html; charset=utf-8', 200);
        };
    else {
        const html = require('./viewer/app.html'); // NOT reloaded if changed (good for prod; do when dev complete)

        // do most of the rendering here...
        const resp = htmlNoPrivateComments(mustache(html, {
            //DOCUMENT_FILE,
            DOCLINK,
            DOCLINK_VERSION,
            DOCLINK_FOLDER,
            GITHUB_PROJECT,
            YEAR: new Date().getFullYear(),
        }));

        // last bit of rendering here
        return (DOCUMENT_FILE, cb) => cb(mustache(resp, { DOCUMENT_FILE }, 'text/html; charset=utf-8', 200));
    }
})(DEV_MODE);

function getContentEditorType(doc) {
    
    // TODO: get type/editor from live list (to be added by users)
    //       - editors would be URLs (from npm?)

    const knownAsText = ``;
    const knownAsBinary = ``;

    // determine content of file (text or binary)
    const isText = /[.](te?xt|html?|js|css|php|md|markdown|java|gitignore|settings|conf|xml|yaml|json5?)$/i.test(doc); // if on this list, can ALWAYS be edited at browser
    //  ? 'text' // todo: use mimetype for this?
    //     : /[.](bin|jpe?g|png|gif|ico)$/i.test(doc) ? 'binary'
    //     : 'unknown'; // should be treated as binary

    // determine which editor to use
    // - todo: use other meta data for file (no just its extension)
    const preferedEditor = /[.](te?xt)$/i.test(doc) ? 'text-editor'
        : /[.](md|markkdown)$/i.test(doc) ? 'markdown-editor' 
        : /[.](html?)$/i.test(doc) ? 'rich-editor' 
        : /[.](css)$/i.test(doc) ? 'css-editor' // eventually; also, eventually, maybe .stylus, .less, .sass, .scss, ...
        : /[.](js)$/i.test(doc) ? ['js-code-editor', 'code-editor'] // eventually (later: .cs .python .php .ruby .go .java ...)
        : /[.](php)$/i.test(doc) ? ['php-code-editor', 'code-editor']
        : /[.](cs)$/i.test(doc) ? ['csharp-code-editor', 'code-editor']
        : 'text-editor';

    return {isText,preferedEditor};
}

function fmtDocMD(doc, raw) {
    // doc used as a self ref


    //return { doc, ...getTypeAndEditor(doc), plain, html:`<h2 toc>table of content</h2>` + markdown.render('[[TOC]]\n\n' + plain), };
    return { doc, ...getContentEditorType(doc), raw };//, html: markdown.render(raw), };

    // could leave html blank to let local editor do initial formatting
}

function fmtDoc(doc) {
    return new Promise(resolve => { // never fails
        fs.readFile(doc, 'utf8', (err, plain) => {
            resolve(err ? {doc, error: { message: err.message || 'unknown error', title: `can't read this file` }}
                        : fmtDocMD(doc, plain));
        });    
    })
}

// --- From command line ---

const cli = process.argv; // for clarity

if (cli.length === 3) {
    if (cli[2] === 'install')
        installDocLink();
    else if (cli[2] === 'start')
        startLocalServer();
    else if (cli[2] === 'stop')
        httpGet(`${SERVER.URL}/stop`);
    else // last arg is doc to be linked (i.e. given a desktop ref)
        linkDocument(cli[2]); // ~/... auto converted to /Users/frederic/... by shell
} 
else if (cli.length === 4 && cli[2] === 'viewer')
    useAsViewer(cli[3]); // last arg is doc to be viewed
else
    log('usage: doclink (file-to-be-viewed.md | install | start | stop)');
