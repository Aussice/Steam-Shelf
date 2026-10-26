const {test}=require('node:test');
const assert=require('node:assert/strict');
const {plainText,normalizeDetails,gameDetails}=require('../electron/details.cjs');
test('store descriptions remain inert plain text with bounded metadata',()=>{
 const result=normalizeDetails({short_description:'<script>bad()</script>你好 &amp; welcome<br>下一行',release_date:{date:'2026'},developers:['A'],genres:[{description:'<b>动作</b>'}]},620);
 assert.equal(result.description,'你好 & welcome\n下一行');assert.deepEqual(result.genres,['动作']);assert.equal(result.appid,620);assert.equal(plainText('x'.repeat(2000)).length,1800);
});
test('details lookup rejects path-like IDs before any request',async()=>{await assert.rejects(()=>gameDetails('../123'),/无效/);await assert.rejects(()=>gameDetails(4294967296),/无效/);});
