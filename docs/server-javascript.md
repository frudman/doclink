## How to make running javascript apps on the server faster, more efficient

- MUST consider uWebSockets as substitute for express/others
    - https://github.com/uNetworking/uWebSockets/blob/master/misc/READMORE.md
    - https://medium.com/@alexhultman/millions-of-active-websockets-with-node-js-7dc575746a01
    - https://levelup.gitconnected.com/will-node-js-forever-be-the-sluggish-golang-f632130e5c7a
    - https://react-etc.net/page/node-js-needs-to-die-in-a-fire-and-golang-is-the-perfect-arsonist
    - https://github.com/uNetworking/uWebSockets.js
    - https://unetworking.github.io/uWebSockets.js/generated/interfaces/websocketbehavior.html
    - https://unetworking.github.io/uWebSockets.js/generated/interfaces/httprequest.html
    - https://github.com/uNetworking/uWebSockets.js
    - https://github.com/uNetworking/uWebSockets.js/blob/master/README.md
    - https://www.npmjs.com/package/uws

- Some uWebSocket examples:
    - https://github.com/uNetworking/uWebSockets.js/tree/master/examples
    - https://github.com/uNetworking/uWebSockets.js/blob/master/examples/HelloWorld.js
    - https://github.com/uNetworking/uWebSockets.js/blob/master/examples/JsonPost.js
    - https://github.com/uNetworking/uWebSockets.js/blob/master/examples/Upload.js
    - https://github.com/uNetworking/uWebSockets.js/blob/master/examples/Headers.js
    - https://github.com/uNetworking/uWebSockets.js/blob/master/examples/PubSub.js
    - https://github.com/uNetworking/uWebSockets.js/blob/master/examples/WebSockets.js

- About create of uWebSockets
    - https://www.reddit.com/r/node/comments/ae0rn0/alpha_builds_of_uwebsocketsjs_uws_are_available/
    - https://www.reddit.com/r/node/comments/91kgte/uws_has_been_deprecated/
    - https://react-etc.net/page/node-js-needs-to-die-in-a-fire-and-golang-is-the-perfect-arsonist
    - https://www.npmjs.com/package/uws

- Deno: a [very fast?] Node alternative
    - likely NOT production ready
    - poor documentation
    - https://deno.land/
    - https://deno.land/manual.html
    - https://github.com/denolib/awesome-deno
    - modules: https://deno.land/x/
    - https://medium.com/@balramchavan/i-regret-says-the-creator-of-node-js-and-dawn-of-deno-fb2b1d3fa554
    - https://github.com/denoland/deno


- FYI:
    - [V8 Options](https://gist.github.com/ry/1c5b080dcbdc6367e5612392049c9ee7)