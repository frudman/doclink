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

const log = console.log.bind(console),
      path = require('path'),
      fs = require('fs'),
      http = require('http'),
      url = require('url'),
      { execFile, execFileSync } = require('child_process');

// helpers
const mustache = (str,vars) => Object.entries(vars).reduce((sofar,[k,v]) => sofar.replace(`{{${k}}}`,v), str);
const sleep = (delayInMS, doAfter) => setTimeout(doAfter, delayInMS);
      
const VISUAL_CODE_EDITOR = '/usr/local/bin/code'; // must be an absolute path
const CHROME_BROWSER = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; // ALWAYS! (AND MUST be quoted to use on command line/shell)

const DOCLINK = `/usr/local/bin/doclink`; // as installed by npm (what if npm install -g? different dir?)

const APP_VERSION = require('./package.json').version;
const APP_ICONS = 'appicons';

// read: http://www.mactipsandtricks.com/website/articles/Wiley_HT_appBundles2.lasso
// using CoreFoundation keys (hence CF)
// CFBundleGetInfoString may be obsolete but still seems to work, so...
const INFO_PLIST = mustache(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleGetInfoString</key>
	<string>{{APP_VERSION}}, Copyright © 2019-{{YEAR}}, Freddy Inc.</string>
	<key>CFBundleIconFile</key>
	<string>{{APP_ICONS}}</string>
</dict>
</plist>`, {
    APP_VERSION,
    APP_ICONS,
    YEAR: new Date().getFullYear() + 1,
});

if (process.argv.length === 3)
    linkDocument(process.argv[2]); // ~/... auto converted to /Users/frederic/... by shell
else if (process.argv.length === 4 && process.argv[2] === 'viewer')
    useAsViewer(process.argv[3]);
else
    log('usage: doclink file-to-be-viewed.md');

function createAppIcons(src, dst) {

    // BIG WHOAAA!!!: it seems that the appicons.icns file must be created BEFORE copy to app directory
    // otherwise Finder does NOT seem to pick it its icons for the app
    // - possible reason: the file time must be at least a few seconds older than app itself???
    // - workaround below: create .icns file first, then wait a few seconds before creating the app itself
    
    // below based on: https://elliotekj.com/2014/05/27/how-to-create-high-resolution-icns-files/
    // read: http://www.mactipsandtricks.com/website/articles/Wiley_HT_appBundles2.lasso
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
          pgm = `#!/bin/bash\n${DOCLINK} viewer "${file}"`, // YEP! that's the actual "program" :-)
          infoPlist = `${appContents}/Info.plist`;

    // Step 1 - Create app's icons first (MUST be first, as per below)
    // IMPORTANT: read BIG WHOAAA!!! inside createAppIcons() function
    // AppIcon.icns generated from: iconutil -c icns AppIcon.iconset
    // files in .iconset are exactly as is (yes, 64 bit entries NOT there)
    // read: https://elliotekj.com/2014/05/27/how-to-create-high-resolution-icns-files/
    const srcLargestIcon = `${__dirname}/appicon-1024x1024.png`,
          tmpIcns = `${__dirname}/${APP_ICONS}.icns`;
    await createAppIcons(srcLargestIcon, tmpIcns); // will delay by a second or so...

    // Step 2 - Now, create the app itself
    fs.mkdirSync(macOSDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.writeFileSync(appPgm, pgm, { mode: 0o755 }); // rwx r-x r-x (ugo === a (for all) === user-group-others)
    fs.copyFileSync(tmpIcns, `${resourcesDir}/${APP_ICONS}.icns`);
    fs.unlinkSync(tmpIcns); // housekeeping
    fs.writeFileSync(infoPlist, INFO_PLIST);

    // not required (kept here for ref)
    //fs.writeFileSync(`${appContents}/PkgInfo`, `APPL????`); // yes, '????' is valid!

    log(`created app ${name} for ${file}\nmac app: ${appPgm}`);
}

function useAsViewer(doc) {
    const SERVER = {
        HOSTNAME: 'localhost',
        PORT: 56789,
        get URL() { return `http://${SERVER.HOSTNAME}:${SERVER.PORT}`; },
    };
        
    function htmlPage(body) {
        const htmlPageTemplate = `<!doctype html>
        <html>
            <head>
            </head>
            <body>
                {{content-here}}
            </body>
        </html>`;

        return htmlPageTemplate.replace('{{content-here}}', body);
    }
        
    var stickAround = false; // true if/when server is also started (i.e. first time)
    
    function showDocument() {
        execFile(CHROME_BROWSER, [`--app=${SERVER.URL}?doc=${encodeURI(doc)}`], err => {
            err ? process.exit(19) : stickAround || process.exit(0);
        });
    }
    
    function editDoc(doc) {
        execFile(VISUAL_CODE_EDITOR, [doc]);
    }
    
    function fmtDoc(doc, cb) {
        const markdownIt = require(`markdown-it`),
              md = new markdownIt()
                .use(require(`markdown-it-anchor`)) // optional, but makes sense as you really want to link to something
                .use(require(`markdown-it-table-of-contents`));

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
                            + `\n\n**[${DOCLINK}** v.${APP_VERSION}]`));
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
                editDoc(doc());
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
}
