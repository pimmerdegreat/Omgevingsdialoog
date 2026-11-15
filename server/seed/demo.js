// Maakt de bestanden voor de demo zonder server (bijvoorbeeld op GitHub Pages): npm run demo
// - web/public/demo/traject.json: het voorbeeldtraject zoals deelnemers het ophalen
// - web/public/demo/resultaten.html: het resultatenrapport van de voorbeelddata
import { mkdir, writeFile } from 'node:fs/promises';
import { bouwRapport } from '../rapport/bouw.js';
import { rapportGegevens } from '../rapport/gegevens.js';
import { voorbeeldGegevens, voorbeeldTraject } from './voorbeeld.js';

const organisatie = {
	naam: process.env.ORGANISATIE_NAAM || 'Buro SRO',
	website: process.env.ORGANISATIE_WEBSITE || 'https://www.burosro.nl',
	email: process.env.ORGANISATIE_EMAIL || 'utrecht@buro-sro.nl',
};

const traject = voorbeeldTraject();
const gegevens = voorbeeldGegevens();
const doel = new URL('../../web/public/demo/', import.meta.url);
await mkdir(doel, { recursive: true });

const publiek = { slug: traject.slug, titel: traject.titel, status: traject.status, voorbeeld: true, definitie: traject.definitie, organisatie };
await writeFile(new URL('traject.json', doel), JSON.stringify(publiek));

// Zonder e-mailadressen en met alleen de cijfers van de postcode, net als bij een echt rapport.
const zonderPersoonsgegevens = gegevens.inzendingen.map((i) => ({ ...i, email: null, postcode: i.postcode ? i.postcode.slice(0, 4) : null }));
const html = await bouwRapport(rapportGegevens({ traject, ...gegevens, inzendingen: zonderPersoonsgegevens }, organisatie));
await writeFile(new URL('resultaten.html', doel), html);

console.log(`Demo-bestanden geschreven naar ${doel.pathname} (rapport: ${Math.round(html.length / 1024)} kB).`);
