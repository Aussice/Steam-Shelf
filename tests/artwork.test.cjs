const {test} = require('node:test');
const assert = require('node:assert/strict');
const {publicArtwork, artworkUrls, imageMime} = require('../electron/artwork.cjs');
test('new Steam versioned capsule and 2x artwork paths are retained',()=>{
  const metadata={library_assets_full:{library_capsule:{image:{english:'d7697088/library_capsule.jpg'},image2x:{english:'d7697088/library_capsule_2x.jpg',schinese:'d7697088/library_capsule_schinese_2x.jpg'}}}};
  const paths=publicArtwork(metadata);
  assert.equal(paths[0],'d7697088/library_capsule_schinese_2x.jpg');
  const urls=artworkUrls(4108000,paths);
  assert.ok(urls.includes('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4108000/d7697088/library_capsule_2x.jpg'));
  assert.ok(urls.includes('https://cdn.akamai.steamstatic.com/steam/apps/4108000/library_600x900.jpg'));
});
test('artwork requests cannot escape the fixed Steam CDN path',()=>{
  assert.deepEqual(publicArtwork({library_assets_full:{library_capsule:{image:{english:'../../password.jpg',schinese:'https://example.com/a.jpg',tchinese:'file:///secret.jpg'}}}}),[]);
});
test('HTML error responses are rejected rather than cached as image files',()=>{
  assert.equal(imageMime(Buffer.from('<html>'+('error'.repeat(100))+'</html>')),null);
  const jpeg=Buffer.alloc(128);jpeg[0]=255;jpeg[1]=216;assert.equal(imageMime(jpeg),'image/jpeg');
  assert.equal(imageMime(Buffer.alloc(10)),null);
});
