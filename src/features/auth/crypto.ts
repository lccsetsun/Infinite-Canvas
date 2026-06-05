import CryptoJS from "crypto-js";
import JSEncrypt from "jsencrypt";
import { AUTH_RSA_PRIVATE_KEY, AUTH_RSA_PUBLIC_KEY } from "./authConfig";

function generateRandomString(length: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return output;
}

export function generateAesKey() {
  return CryptoJS.enc.Utf8.parse(generateRandomString(32));
}

export function encryptBase64(value: CryptoJS.lib.WordArray) {
  return CryptoJS.enc.Base64.stringify(value);
}

export function decryptBase64(value: string) {
  return CryptoJS.enc.Base64.parse(value);
}

export function encryptWithAes(message: string, aesKey: CryptoJS.lib.WordArray) {
  return CryptoJS.AES.encrypt(message, aesKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

export function decryptWithAes(message: string, aesKey: CryptoJS.lib.WordArray) {
  return CryptoJS.AES.decrypt(message, aesKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
}

export function encryptWithRsa(value: string) {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(AUTH_RSA_PUBLIC_KEY);
  const encrypted = encryptor.encrypt(value);
  if (!encrypted) throw new Error("RSA encryption failed");
  return encrypted;
}

export function decryptWithRsa(value: string) {
  const decryptor = new JSEncrypt();
  decryptor.setPrivateKey(AUTH_RSA_PRIVATE_KEY);
  const decrypted = decryptor.decrypt(value);
  if (!decrypted) throw new Error("RSA decryption failed");
  return decrypted;
}
