/**
 * TEST-ONLY build step for the DRM fixture.
 *
 * ffmpeg's DASH muxer encrypts the segments but does not emit the CENC signaling
 * a player needs, so the generated manifest gets the `ContentProtection` and
 * `cenc:default_KID` elements injected here. Without them the player would never
 * request a license and would hand encrypted bytes to the decoder.
 *
 * The key id is the same throwaway test value used to encrypt the media.
 */
const fs = require('node:fs');

const FILE = process.argv[2];
const KID = process.argv[3];

if (!FILE || !KID) {
  console.error('usage: node patch-mpd.js <manifest> <kid>');
  process.exit(2);
}

let xml = fs.readFileSync(FILE, 'utf8');

if (!xml.includes('xmlns:cenc=')) {
  xml = xml.replace('<MPD ', '<MPD xmlns:cenc="urn:mpeg:cenc:2013" ');
}

const protection =
  '<ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc" />' +
  '<ContentProtection schemeIdUri="urn:uuid:EDEF8BA9-79D6-4ACE-A3C8-27DCD51D21ED">' +
  `<cenc:default_KID>${KID}</cenc:default_KID></ContentProtection>`;

xml = xml.replace(/<AdaptationSet /g, `${protection}<AdaptationSet `);

if (!xml.includes('cenc:default_KID') || !xml.includes('value="cenc"')) {
  console.error('CENC signaling was not injected');
  process.exit(1);
}

fs.writeFileSync(FILE, xml);
console.log('CENC signaling injected');
