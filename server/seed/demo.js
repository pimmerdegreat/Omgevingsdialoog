// Maakt de bestanden voor de demo zonder server (bijvoorbeeld op GitHub Pages): npm run demo
// - web/public/demo/beheer.json: het voorbeeldtraject en de lijst met inzendingen, als beginstand van beheer
// - web/public/demo/resultaten.html: het resultatenrapport van de voorbeelddata
// - web/public/demo/export/: het GeoPackage, de GeoJSON en de CSV-bestanden van het voorbeeldtraject
import { mkdir, writeFile } from 'node:fs/promises';
import { bijdragenCsv, inzendingenCsv } from '../export/csv.js';
import { bijdragenGeojson } from '../export/geojson.js';
import { bouwGeopackage } from '../export/gpkg.js';
import { bouwRapport } from '../rapport/bouw.js';
import { rapportGegevens } from '../rapport/gegevens.js';
import { voorbeeldGegevens, voorbeeldTraject } from './voorbeeld.js';

// Vaste sleutel van het voorbeeldtraject in de demo; de website kent dezelfde waarde (web/src/api.ts).
export const DEMO_TRAJECT_ID = '00000000-0000-4000-a000-000000000001';

const organisatie = {
	naam: process.env.ORGANISATIE_NAAM || 'Buro SRO',
	website: process.env.ORGANISATIE_WEBSITE || 'https://www.burosro.nl',
	email: process.env.ORGANISATIE_EMAIL || 'utrecht@buro-sro.nl',
};

const voorbeeld = voorbeeldTraject();
const gegevens = voorbeeldGegevens();
const traject = {
	id: DEMO_TRAJECT_ID,
	slug: voorbeeld.slug,
	titel: voorbeeld.titel,
	status: voorbeeld.status,
	voorbeeld: true,
	definitie: voorbeeld.definitie,
	aangemaakt: gegevens.inzendingen[0].ingediend,
	gewijzigd: gegevens.inzendingen[0].ingediend,
};

const doel = new URL('../../web/public/demo/', import.meta.url);
const exportMap = new URL('export/', doel);
await mkdir(exportMap, { recursive: true });

// Beginstand van beheer: het traject en per deelnemer een regel, zoals beheer die van de server krijgt.
const telling = (lijst) => lijst.reduce((m, x) => m.set(x.inzending_id, (m.get(x.inzending_id) || 0) + 1), new Map());
const perBijdrage = telling(gegevens.bijdragen);
const perReactie = telling(gegevens.reacties);
const inzendingen = gegevens.inzendingen.map((i) => ({
	id: i.id,
	ingediend: i.ingediend,
	postcode: i.postcode,
	leeftijd: i.leeftijd,
	email: i.email,
	op_de_hoogte: i.op_de_hoogte,
	bijdragen: perBijdrage.get(i.id) || 0,
	reacties: perReactie.get(i.id) || 0,
}));
await writeFile(new URL('beheer.json', doel), JSON.stringify({ organisatie, traject, inzendingen }));

// Rapport en exports zonder e-mailadressen en met alleen de cijfers van de postcode, net als op de server.
const zonderPersoonsgegevens = { traject, ...gegevens, inzendingen: gegevens.inzendingen.map((i) => ({ ...i, email: null, op_de_hoogte: false, postcode: i.postcode ? i.postcode.slice(0, 4) : null })) };
const html = await bouwRapport(rapportGegevens(zonderPersoonsgegevens, organisatie));
await writeFile(new URL('resultaten.html', doel), html);

const slug = traject.slug;
await writeFile(new URL(`${slug}.gpkg`, exportMap), await bouwGeopackage(zonderPersoonsgegevens));
await writeFile(new URL(`${slug}-bijdragen.geojson`, exportMap), JSON.stringify(bijdragenGeojson(zonderPersoonsgegevens)));
await writeFile(new URL(`${slug}-bijdragen.csv`, exportMap), bijdragenCsv(zonderPersoonsgegevens));
// De antwoorden met e-mailadressen; in de demo zijn dat verzonnen adressen op voorbeeld.example.
await writeFile(new URL(`${slug}-inzendingen.csv`, exportMap), inzendingenCsv({ traject, ...gegevens }));

console.log(`Demo-bestanden geschreven naar ${doel.pathname} (rapport: ${Math.round(html.length / 1024)} kB).`);
