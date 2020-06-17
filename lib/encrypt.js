const CryptoJS = require('crypto-js');

const keySize = 256;
const ivSize = 128;
const iterations = 100;
const password = `cohesityvCD`;

module.exports = {
    encrypt(data, encryptionPassword) {
        var salt = CryptoJS.lib.WordArray.random(128 / 8);
        var key = CryptoJS.PBKDF2(encryptionPassword, salt, {
            keySize: keySize / 32,
            iterations: iterations
        });

        var iv = CryptoJS.lib.WordArray.random(128 / 8);
        var encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
            iv: iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        });

        var transitmessage = salt.toString() + iv.toString() + encrypted.toString();
        return transitmessage;
    },

    decrypt(transitmessage, decryptionPassword) {
        var salt = CryptoJS.enc.Hex.parse(transitmessage.substr(0, 32));
        var iv = CryptoJS.enc.Hex.parse(transitmessage.substr(32, 32))
        var encrypted = transitmessage.substring(64);

        var key = CryptoJS.PBKDF2(decryptionPassword, salt, {
            keySize: keySize / 32,
            iterations: iterations
        });

        var decrypted = CryptoJS.AES.decrypt(encrypted, key, {
            iv: iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        })

        return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    },

    randomKey() {
        return CryptoJS.lib.WordArray.random(128 / 4)
            .toString();
    }
}