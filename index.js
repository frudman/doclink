#!/usr/local/bin/node

// IMPORTANT: traditional '#!/usr/bin/env node' DOES NOT WORK when running as a Mac Application
// MUST use a simple ABSOLUTE path (runs without a shell?)

// 'npm install' this package will do the following:
// - ln -s `pwd`/index.js /usr/local/bin/doclink
// - chmod +x index.js 

// if already running, stop it with: curl localhost:56789/stop
// start manually: [cd ~/simplytel-dev/doclink]
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

const appdir = filename => __dirname + filename;

const wdot = x => (x || '')[0] === '.' ? x : ('.' + x);



// helpers ---
const { log, mustache, sleep, htmlNoPrivateComments, httpGet, tryStaticFiles, textOrBinary } = require('./server-utils');

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

const srcLargestIcon = appdir(`/mac-app/src-appicon-1024x1024.png`);
const commonAppIcons = appdir(`/mac-app/macos-appicon.icns`);
const commonInfoPlist = appdir(`/mac-app/macos-info.plist`);

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
        http.createServer((req, resp) => {

            const purl = url.parse(req.url, true),
                urlPath = purl.pathname, // differentiate from cmd-line doc
                [openFolder, folderNameToOpen] = urlPath.match(/^[/]open-folder([/].+)/) || [],
                [vscEditDocument, docNameToEdit] = urlPath.match(/^[/]edit-document([/].+)/) || [],
                [gettingDoc, docName] = urlPath.match(/^[/]get-document([/].+)/) || [],
                [savingDoc, docNameToSave] = urlPath.match(/^[/]save-document([/].+)/) || [],
                //[savingBinary, binDataToSave] = urlPath.match(/^[/]save-binary([/].+)/) || [],
                [isViewingDoc, docPath] = urlPath.match(/^[/]doclink-viewer([/].+)/i) || []; // must match prefix in useAsViewer()
            
            // note: error in nodejs docs
            // - ref: https://nodejs.org/dist/latest-v12.x/docs/api/http.html#http_response_writehead_statuscode_statusmessage_headers
            // - .writeHead SHOULD allow for chaining (resp.writeHead(...).end(...)) but it DOES NOT!
            // todo: notify node folks

            if (/^[/]stop$/i.test(urlPath)) {
                resp.end('ok, stopped\n');
                process.exit(0);
            }
            else if (/^[/]started[?]?$/i.test(urlPath)) {
                resp.end('yes, started, all good\n');
            }
            else if (isViewingDoc) { 
                // send basic framework for full ui (same for ALL docs)
                // browser app will then make an explicit request for actual doc content (text or binary)
                mainHtmlPage(docPath, (body,type,code) => {
                    resp.writeHead(code, { 'Content-Type': type });
                    resp.end(body);
                    log('HOME page for\n\t' + docPath);
                });
            }
            else if (openFolder) { // only on mac platforms for now
                resp.end();
                // todo: 'open' works on Macs (what about linux? windows? probably not...)
                execFile('open', [folderNameToOpen === '/doclink-folder' ? DOCLINK_FOLDER : folderNameToOpen]); 
            }
            else if (vscEditDocument) { // only on macs and only for vscode, for now
                resp.end();
                execFile(VISUAL_CODE_EDITOR, [docNameToEdit]);
            }
            else if (gettingDoc) {
                sendDoc(docName, resp);
            }
            else if (savingDoc) {
                saveDocument(docNameToSave, req) // never fails
                    .then(updatedResults => {
                        log('SAVED DOC', updatedResults);
                        resp.json(updatedResults);
                    })
            }
            else {
                tryStaticFiles(resp, appdir(`/viewer${urlPath}`))
                    .then(file => log('sent static file\n\t', file))
                    .catch(err => {
                        if (err.notFound) {                            
                            log('NOT FOUND\n\t', urlPath);
                            resp.writeHead(404, { 'Content-Type': 'text/plain'});
                            resp.end('file not found');
                        }
                        else {
                            log('ERROR\n\t', urlPath, err);
                            resp.writeHead(500, { 'Content-Type': 'text/plain'});
                            resp.end('server error: ' + err.message);
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

/* google chrome as an app:

    - for terminal:
        - alias gc="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"

    - All available switches:
        - https://peter.sh/experiments/chromium-command-line-switches/
        - also to read:
            - http://www.chromium.org/developers/how-tos/run-chromium-with-flags (window, linux, mac)
            - https://v8.dev/

    - Switches of interest (more to explore):
        --enable-browser-side-navigation  
        --enable-mac-views-native-app-windows  
        --load-and-launch-app 
        --no-first-run 
        --no-startup-window 
        --process-per-site 
        --process-per-tab  
        --renderer   
        --restore-last-session  
        --silent-launch  
        --site-per-process   
        --timeout  
        --bwsi

    - How to create a chrome app & shortcut:
        - https://www.thewindowsclub.com/use-google-chrome-in-application-mode
        - https://superuser.com/questions/1376060/google-chrome-no-longer-allows-me-to-create-shortcuts-to-open-tabs-as-windows
*/

function useAsViewer(doc) {

    // - https://peter.sh/experiments/chromium-command-line-switches/


    doc && startLocalServer().then(stickAround => 
        execFile(CHROME_BROWSER, [`--app=${SERVER.URL}/doclink-viewer${encodeURI(doc)}`], err => {
            // if error launching browser, exit with a distinct error code (19!) [killing server as well, if it was launched here]
            // if no error, exit if only launched browser (running on its own, so we're done)
            // if no error, do NOT exit if we also launched the server (keeps it available for subsequent requests from other docs)
            err ? process.exit(19) : stickAround || process.exit(0);
        }));
}

// unicode lock icon: 1f512; unlock: 1f513

function saveDocument(filename, req) {

    // for binary docs, post with 'content-type: binary [;] [[.]ext]'
    // - if 'ext' present: (e.g. .locked)
    //  - .ext is added to filename on write
    //  - if file without .ext already existed, it is DELETED

    return new Promise(resolve => {
        const [isBinary, binExt] = (req.headers['content-type'] || '').match(/^\s*binary\s*(?:[;]\s*)?[.]?(\w+)?/i) || [];
        const dst = filename + (isBinary && binExt ? wdot(binExt) : ``);
        log('saving', isBinary ? `BINARY file` : `TEXT doc`, dst);
        // according to: https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options
        // - "The encoding can be any one of those accepted by Buffer"
        // - https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings
        // - BUT none of these refer to NO encoding (i.e. bytes only)
        // - does this mean encoding: null to NOT encode data?
        // but DEFAULT is utf8, so MUST set to null???
        const fd = fs.createWriteStream(dst, {
             /// SHOULD THIS BE REMOVED as per https://stackoverflow.com/questions/33976205/nodejs-binary-fs-createreadstream-streamed-as-utf-8
             // encoding: isBinary ? 'binary' : 'utf8',
             // or set to null???
        })
        req.on('end', () => resolve({ok: 'written ' + dst}));
        // if error, which one will be triggered???
        fd.on('error', err => resolve({ error: 'not saved (file stream error): ' + err.message }))
        req.on('error', err => resolve({ error: 'not saved (request error): ' + err.message }))
        req.pipe(fd);
    });


    return new Promise(resolve => {
        const bodyParts = [];
        req
            .on('data', chunk => bodyParts.push(chunk))
            .on('end', () => {
                const plainBody = Buffer.concat(bodyParts).toString();

                // save this TO FILE!!!
                fs.writeFileSync(filename, plainBody); // default is utf-8 (what we want)

                log('written!!!', filename);

                // lastly...
                resolve(getDocMeta(filename, plainBody)); // may already have been rejected if there was an error...
            })
            .on('error', err => resolve({ error: 'not saved: ' + err.message }));
    });
}

const mainHtmlPage = (function(dev) {
    if (dev)
        return (DOCUMENT_FILE, cb) => {
            const html = fs.readFileSync(appdir(`/viewer/app/index.html`), 'utf8'); // re-reads it EVERY TIME

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
        const html = require('./viewer/app/index.html'); // NOT reloaded if changed (good for prod; do when dev complete)

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

const knownEditors = new Map([

    // TODO: get type/editor from a live list (to be added by users)
    //       - editors would be URLs (from npm?)

    // let each editor determine which extensions it understands?

    // for BINARY: not editable!!! (images? videos? audio? other: can only update by uploading over it)
    // maybe create a binary editor (i.e. just an upload and display area: display img/video/audio)


    [ /[.](te?xt)$/i, 'text-editor' ],
    [ /[.](md|markdown)$/i, 'markdown-editor' ],
    [ /[.](html?)$/i, 'rich-editor', ],
    [ /[.](css)$/i, 'css-editor' ], // eventually; also, eventually, maybe .stylus, .less, .sass, .scss, .. 
    [ /[.](js)$/i, ['js-code-editor', 'code-editor'] ], // eventually (later: .cs .python .php .ruby .go .java ...
    [ /[.](php)$/i, ['php-code-editor', 'code-editor'] ],
    [ /[.](cs)$/i, ['csharp-code-editor', 'code-editor'] ],
]);

function getPreferredEditor(filename, filemeta, {defaultEditor = 'text-editor', editors = knownEditors} = {}) {

    if (filemeta) {
        // todo: use file meta (e.g. from s3 tags) to determine editor 
        // - as explicitly set by user (and kept with document as tag)
        // - based on s3 mimetype (more accurate than by extension?)

        log.warning('file meta ignored for getting prefered editor - not implemented', filename, filemeta);
    }
    
    for (const [pattern,editor] of editors)
        if (pattern.test(filename)) 
            return editor;

    return defaultEditor;
}

function getDocMeta(filename) {
    
    const doc = filename.replace(/[.]locked$/i, ''); // trim it

    const {isText, mimetype: mime, encoding} = textOrBinary(doc);
    const preferedEditor = getPreferredEditor(filename);

    // doc === filename UNLESS doc is locked
    return {doc, filename, isText, preferedEditor, mimetype: mime, encoding};
}

function sendDoc(doc, resp) {
    const {isText, preferedEditor} = getDocMeta(doc);

    const xdoc = locked => (locked ? 'locked;' : 'open;') + (isText ? 'text;' : 'binary;') + preferedEditor;

    // do NOT use .writeHead: writes to network without caching; 
    // BAD for us since we may change these values if file is locked (content-type then binary)
    // as per: https://nodejs.org/api/http.html#http_response_setheader_name_value
    // and: https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
    resp.statusCode = 200; // https://nodejs.org/api/http.html#http_response_statuscode
    resp.setHeader('X-Document', xdoc(false));

    // for createReadStream: default encoding is null (good for binary); do NOT use 'binary' as it means 'Latin1'
    // as per: https://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options
    // https://stackoverflow.com/questions/33976205/nodejs-binary-fs-createreadstream-streamed-as-utf-8
    // skip encoding so default is null (no interpretation)
    fs.createReadStream(doc) 
        .on('error', err => {
            if (err.code === 'ENOENT') { // let's try as locked
                resp.setHeader('X-Document', xdoc(true));
                fs.createReadStream(doc + '.locked')
                    .on('error', err => {
                        if (err.code === 'ENOENT')
                            resp.json(404, {error: `file not found`});
                        else
                            resp.json(500, {error: `cannot read file (${err.code}): ${err.message}`});
                    })
                    .pipe(resp);
            }
            else {
                resp.json(500, {error: `file error (${err.code}): ${err.message}`});
            }    
        })
        .pipe(resp);
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
