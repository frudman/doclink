// for encrypt/decrypt, algos available: 
// - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto#Supported_algorithms
// - fyi: aes-ctr not supported in some browsers; use aes-cbc or aes-gcm
// - aes-cbc [seems to have] better performance than aes-gcm
// ref: https://medium.com/@encryb/comparing-performance-of-javascript-cryptography-libraries-42fb138116f3
// also: "...In AES-CBC, the encryption will be done in the CBC mode (Cipher Block Chaining mode), 
//        in AES-GCM, it'll be done in the GCM mode (Galois/Counter Mode)..."
// another ref: https://crypto.stackexchange.com/questions/2310/what-is-the-difference-between-cbc-and-gcm-mode#2311

// SHA-512 SUPPORTED (?): might replace in our javascript utils

//import { log } from './app-utils.js';

// todo: implement encryptToBytes() & decryptFromBytes() (when sending to server, no need to convert to strings (more work & more data))

const ALGO = { 
    // AES is a symmetrical block-cipher algorithm with a 128-bit block size: 
    // - its initialization vector is ALWAYS 16 bytes (128 bits) for AES 128, 192 and 256
    name: "AES-GCM", 
    length: 256, // so AES-256?
    ivLength: 16, // MUST === 16, as per above; in bytes; 128 bits; 32 hex digits
    fromIV: iv => Object.assign({}, ALGO, {iv})
};

const SALT_LENGTH = 32; // in bytes; arbitrary is better (but slower)

const SALT_HEX_DIGITS = SALT_LENGTH * 2; // 2 hex digits per byte
const IV_HEX_DIGITS = ALGO.ivLength * 2; // 2 hex digits per byte
const MIN_STRING_ENC_BYTES = 32; // min enc len seems to be 32 + 2*len of string (32 if len===0; 34 if len===1, 36 if len===2, ...)
const MIN_ENC_BYTES = SALT_HEX_DIGITS + IV_HEX_DIGITS + MIN_STRING_ENC_BYTES; 

const invalidString = (str, minLen = 0) => typeof str !== 'string' || str.length < minLen;

// from: https://developer.mozilla.org/en-US/docs/Web/API/Window/crypto
const crypto = (window.crypto || window.msCrypto),
      subtle = crypto.subtle;

// compute once...
const hexByte = Array(256).fill().map((v,i) => i.toString(16).padStart(2, "0")); // better perf than ('0' + i.toString(16)).slice(-2));
const hex = byte => hexByte[byte]; // ...reuse many times

const toHex = buffer => ((buffer instanceof ArrayBuffer) ? new Uint8Array(buffer) : buffer)
                .reduce((str,b) => str += hex(b), '');

function fromHex(str, start = 0, length = (str||'').length - start) {
    const a = new Uint8Array(length/2); // 2 hex digits per byte
    for (var i = start; i < start + length; i += 2)
        a[(i-start)/2] = parseInt(str[i]+str[i+1], 16);
    return a;
}

// https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder
const utf8Encoder = new TextEncoder(); // reuse
const stringToBytes = str => utf8Encoder.encode(str);
const utf8Decoder = new TextDecoder();
const bytesToString = bytes => utf8Decoder.decode(bytes);

async function keyFromPassphrase(password, salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))) {

    // read: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey#PBKDF2
    // read: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey#PBKDF2_2
    // also: https://github.com/mdn/dom-examples/blob/master/web-crypto/derive-key/pbkdf2.js

    const keyMatAlgo = { 
        name: "PBKDF2",
        iterations: 100000, // significance?
        hash: "SHA-256", // reason? alternatives? benefits?
        withSalt: salt => Object.assign({}, keyMatAlgo, {salt})
    };

    const keyMat = await getKeyMaterial(password),
          key = await getKey(keyMat, salt);

    return { key, salt };

    function getKeyMaterial(password) {
        return subtle.importKey(
            'raw', // keyFormat
            stringToBytes(password),
            keyMatAlgo,
            false, // NOT exportable (no need)
            ["deriveBits", "deriveKey"] // what we'll be doing with it
        );
    }
    
    function getKey(keyMaterial, salt) {       
        // derive an AES-GCM key using PBKDF2, given some key material and salt (below: false === not exportable)
        return subtle.deriveKey(keyMatAlgo.withSalt(salt), keyMaterial, ALGO, false, [ "encrypt", "decrypt" ]);
    }    
}

export function encrypt(clearText, passPhrase) {

    // read: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt

    return new Promise(async (resolve,reject) => {
        if (invalidString(clearText))
            return reject(new Error('cannot encrypt (invalid clear text data)'));
        if (invalidString(passPhrase))
            return reject(new Error('cannot encrypt (invalid pass phrase)'));

        try {
            const encoded = stringToBytes(clearText),
                  iv = crypto.getRandomValues(new Uint8Array(ALGO.ivLength)), // MUST be saved with msg else can't be decoded
                  {key, salt} = await keyFromPassphrase(passPhrase),
                  ciphertext = await subtle.encrypt(ALGO.fromIV(iv), key, encoded);

            resolve(toHex(salt) +  toHex(iv) + toHex(ciphertext)); // PUBLIC STRING (aka the encrypted string)
        }
        catch(err) {
            reject(new Error(`failed to encrypt (${err.message})`));
        }
    })
}

export function decrypt(encrypted, passPhrase) {
    return new Promise((resolve,reject) => {
        if (invalidString(encrypted, MIN_ENC_BYTES))
            return reject(new Error('cannot decrypt (invalid encrypted data)'));
        if (invalidString(passPhrase))
            return reject(new Error('cannot decrypt (invalid pass phrase)'));

        const salt = fromHex(encrypted, 0, SALT_HEX_DIGITS),
              iv = fromHex(encrypted, SALT_HEX_DIGITS, IV_HEX_DIGITS),
              ciphertext = fromHex(encrypted, SALT_HEX_DIGITS + IV_HEX_DIGITS);

        keyFromPassphrase(passPhrase, salt)
            .then(({key}) => subtle.decrypt(ALGO.fromIV(iv), key, ciphertext))
            .then(decrypted => resolve(bytesToString(decrypted)))
            .catch(err => reject(new Error(`failed to decrypt`))) // no need to give more info
    });
}
