#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml not found. Run `npx cap add android` first.');
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');
const MARKER = '<!-- SK_CODER_INTENT_FILTERS -->';
if (xml.includes(MARKER)) {
  console.log('Intent filters already present. Nothing to do.');
  process.exit(0);
}

const exts = [
  'html','htm','css','scss','sass','less','js','mjs','cjs','jsx','ts','tsx','vue','svelte','json','yml','yaml','toml','xml','md','markdown','py','rb','php','java','kt','swift','dart','go','rs','c','cpp','cc','h','hpp','cs','m','sh','bash','zsh','sql','env','txt','log','ini','conf','dockerfile','gradle','properties','lua','pl','r','svg'
];

const fileFilters = exts.map(ext => `
            ${MARKER}
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="file" />
                <data android:scheme="content" />
                <data android:mimeType="*/*" />
                <data android:pathPattern=".*\\.${ext}" />
                <data android:pathPattern=".*\\..*\\.${ext}" />
                <data android:pathPattern=".*\\..*\\..*\\.${ext}" />
                <data android:host="*" />
            </intent-filter>`).join('');

const shareFilter = `
            ${MARKER}
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/*" />
                <data android:mimeType="application/zip" />
                <data android:mimeType="application/json" />
                <data android:mimeType="application/xml" />
                <data android:mimeType="application/octet-stream" />
            </intent-filter>
            ${MARKER}
            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="*/*" />
            </intent-filter>`;

const activityClose = '</activity>';
const idx = xml.indexOf(activityClose);
if (idx === -1) {
  console.error('Could not find </activity> in AndroidManifest.xml.');
  process.exit(1);
}
xml = xml.slice(0, idx) + fileFilters + shareFilter + '\n        ' + xml.slice(idx);

const perms = `
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" tools:ignore="ScopedStorage" />`;
if (!xml.includes('MANAGE_EXTERNAL_STORAGE')) {
  xml = xml.replace('<application', perms + '\n\n    <application');
  if (!xml.includes('xmlns:tools')) xml = xml.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
}

fs.writeFileSync(manifestPath, xml);
console.log('AndroidManifest.xml patched with SK Coder open-with and share intent filters.');
console.log('Now run: npx cap sync android && npx cap open android');
