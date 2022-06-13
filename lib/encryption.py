# Python equivalent for `encrypt.js` util.

import js2py
from js2py.pyjs import *

CryptoJS = js2py.require('crypto-js')

keySize = 256
ivSize = 128
iterations = 100

# Encrypts a JS object.
def encrypt(dataAsJSObject, encryptionPassword):
    # Genrate a random salt.
    salt = CryptoJS.lib.WordArray.random(128 / 8)

    # Generate an encryption key using the salt.
    key = CryptoJS.PBKDF2(encryptionPassword, salt, Js(
        {'keySize': keySize/32, 'iterations': iterations}))

    # Random IV
    iv = CryptoJS.lib.WordArray.random(128 / 8)

    JSON = js2py.eval_js('JSON')
    encProp = Js({'iv': iv, 'padding': CryptoJS.pad.Pkcs7,
                 'mode': CryptoJS.mode.CBC})

    # Encrypted message
    encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(dataAsJSObject), key, encProp)

    # Final encrypted message.
    return salt.toString() + iv.toString() + encrypted.toString()


# Returns the object instance after successful decryption.
def decrypt(transitmessage, encryptionPassword):
    JSON = js2py.eval_js('JSON')
    # Extract the salt.
    salt = CryptoJS.enc.Hex.parse(transitmessage[0:32])
    # Extract the IV.
    iv = CryptoJS.enc.Hex.parse(transitmessage[32:64])
    # Extract the encrypted message.
    encrypted = transitmessage[64:]

    # Generate key from salt
    key = CryptoJS.PBKDF2(encryptionPassword, salt, Js(
        {'keySize': keySize/32, 'iterations': iterations}))

    # Decrypt the message.
    decryptedMessage = CryptoJS.AES.decrypt(encrypted, key,
                                            Js({'iv': iv, 'padding': CryptoJS.pad.Pkcs7,
                                                'mode': CryptoJS.mode.CBC}))

    return JSON.parse(decryptedMessage.toString(CryptoJS.enc.Utf8))
