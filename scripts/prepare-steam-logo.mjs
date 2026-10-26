// Extract only the circular mark from Valve's official Steam header SVG.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DOMParser} from '@xmldom/xmldom';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
// The isolated mark contains only paths; SVGLoader's gradient query needs this
// small DOM adapter because xmldom deliberately does not implement selectors.
globalThis.DOMParser=class extends DOMParser {
  parseFromString(...args){const doc=super.parseFromString(...args);doc.querySelectorAll=selector=>{if(selector!=='linearGradient, radialGradient')throw new Error('Unexpected SVG selector');return [];};return doc;}
};
const root=path.resolve(import.meta.dirname,'..');
const source=await fs.readFile(path.join(root,'asset-sources/steam-logo-original.svg'),'utf8');
const document=new DOMParser().parseFromString(source,'image/svg+xml');
const paths=[...Array.from(document.getElementsByTagName('path')).slice(0,3)].map(node=>node.getAttribute('d'));
if(paths.length!==3||!paths[0].startsWith('M44.238'))throw new Error('Unexpected Valve logo source');
const xml='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 89 89">'+paths.map(d=>`<path d="${d}"/>`).join('')+'</svg>';
const shapes=new SVGLoader().parse(xml).paths.flatMap(path=>SVGLoader.createShapes(path));
const output={source:'https://store.akamai.steamstatic.com/public/shared/images/header/logo_steam.svg',viewBox:[0,0,89,89],paths,shapes:shapes.map(shape=>shape.toJSON())};
await fs.writeFile(path.join(root,'src/steamLogoData.json'),JSON.stringify(output));
await fs.writeFile(path.join(root,'public/steam-mark.svg'),xml);
console.log(`Prepared ${shapes.length} official Steam mark shapes`);
