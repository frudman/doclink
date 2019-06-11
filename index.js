#!/usr/bin/env node

// should: ln -s `pwd`/index.js /usr/local/bin/doclink
// also must: chmod +x index.js 
// also MUST: chmod +x server.js
// also MUST: npm install

const log = console.log.bind(console);

/* previously from:

    #!/bin/bash

    ## METHOD 3: ADD EXTENSION TO Chrome browser: 
    ## - https://chrome.google.com/webstore/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk?hl=en
    ##   - THEN, make sure to "Allow access to file URLs" in its settings

    ## touch ~/Desktop/my-notes
    ## chmod +x ~/Desktop/my-notes
    ## code ~/Desktop/my-notes [then copy this content]
    ## now, can double click on this file on desktop

    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    #APP="http://enervisionmedia.com"
    APP="file:///Users/frederic/simplytel-dev/vue-webpack-1/vue-app-2/DOCS/LINUX.md"

    "$CHROME" --kiosk --app="$APP"

    ## auto close terminal window: method 1
    ## from: https://stackoverflow.com/questions/5125907/how-to-run-a-shell-script-in-os-x-by-double-clicking
    ##osascript -e 'tell application "Terminal" to close front window' > /dev/null 2>&1 &

    ## auto close terminal window: method 2
    ## READ: https://stackoverflow.com/a/17910412/11256689

    ## BEST METHOD 3: https://superuser.com/a/1354541
    ## mkdir -p myapp.app/Contents/MacOS [from any folder]
    ## touch myapp.app/Contents/MacOS/myapp [name must be same as above: myapp; TBV]
    ##  - add content/script to file
    ## chmod ugo+x myapp.app/Contents/MacOS/myapp [user-group-others]
    ## cat > myapp.app/Contents/PkgInfo [then type:]
    ## APPL??? [do NOT hit return]
    ## [then ctrl-D ctrl-D (yes, twice); on my mac: window-D window-D]
    ## Can now double click on script: will execute WITHOUT a terminal window
*/

if (process.argv.length !== 3) {
    log('usage: doclink [document-file.md goes here: required!]');
    return;
}

const docFile = process.argv[2]; // ~/... auto converted to /Users/frederic/... by shell

const serverTemplate = `${__dirname}/server.js`;

const path = require('path'),
      fs = require('fs');

const desktopDir = `${process.env.HOME}/Desktop`; // where we put it for easy ref
const curDir = process.env.PWD;

const file = docFile[0] === '/' ? docFile : `${curDir}/${docFile}`; // make absolute

const name = path.basename(file).replace(/[.]\w+$/i, ''); // remove extension (cleaner look for app name)

const appDir = `${desktopDir}/${name}.app/Contents/MacOS`,
      pkgInfo = `${desktopDir}/${name}.app/Contents/PkgInfo`,
      appPgm = `${appDir}/${name}`,
      docFileUrl = `${appDir}/docfile`,
      doclinkSrc = `${appDir}/doclink-source`;

console.log('linking', name, 'to', file);

fs.mkdirSync(appDir, { recursive: true });
fs.copyFileSync(serverTemplate, appPgm); // MUST BE EXECUTABLE; 0o755 or more; 
//fs.writeFileSync(appPgm, pgmCode, {mode: 0o777}); // rwx r-x r-x (ugo or a = user-group-others)
fs.writeFileSync(pkgInfo, 'APPL???'); // yep, exactly like that
fs.writeFileSync(docFileUrl, file); // to be read when running app (to know which file to display)
fs.writeFileSync(doclinkSrc, __dirname); // to allow running app access to these node_modules

console.log('done', appDir);
