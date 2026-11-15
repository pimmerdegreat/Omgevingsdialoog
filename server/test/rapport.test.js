// Tests voor het resultatenrapport en de exports. Draaien zonder database: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bijdragenCsv, inzendingenCsv } from '../export/csv.js';
import { bijdragenGeojson } from '../export/geojson.js';
import { bouwRapport } from '../rapport/bouw.js';
import { rapportGegevens } from '../rapport/gegevens.js';
import { voorbeeldGegevens, voorbeeldTraject } from '../seed/voorbeeld.js';

const organisatie = { naam: 'Buro SRO', website: 'https://www.burosro.nl', email: 'utrecht@buro-sro.nl' };
const traject = voorbeeldTraject();
const bron = { traject, ...voorbeeldGegevens() };

test('de voorbeelddata is herhaalbaar', () => {
	assert.deepEqual(voorbeeldGegevens(), voorbeeldGegevens());
});

test('de totalen in het rapport zijn uit de rijen geteld', () => {
	const g = rapportGegevens(bron, organisatie);
	assert.equal(g.totalen.deelnemers, bron.inzendingen.length);
	assert.equal(g.totalen.bijdragen, bron.bijdragen.length);
	assert.equal(g.totalen.reacties, bron.reacties.length);
	assert.equal(g.categorieen.reduce((s, c) => s + c.aantal, 0), bron.bijdragen.length);
	for (const o of g.onderdelen) assert.equal(o.goed + o.twijfel + o.niet, o.totaal);
	assert.equal(g.onderdelen.reduce((s, o) => s + o.totaal, 0), bron.reacties.length);
	const cijfer = g.vragen.find((v) => v.type === 'schaal');
	assert.equal(cijfer.opties.reduce((s, o) => s + o.aantal, 0), cijfer.aantal);
	assert.equal(g.deelnemers.leeftijd.reduce((s, l) => s + l.aantal, 0), g.deelnemers.leeftijdBekend);
});

test('een bijdrage bij een verwijderde categorie telt niet mee', () => {
	const g = rapportGegevens({ ...bron, bijdragen: [...bron.bijdragen, { ...bron.bijdragen[0], categorie_id: 'verdwenen' }] }, organisatie);
	assert.equal(g.totalen.bijdragen, bron.bijdragen.length);
});

test('het rapport is één document zonder e-mailadressen en zonder losse verwijzingen', async () => {
	const zonder = { ...bron, inzendingen: bron.inzendingen.map((i) => ({ ...i, email: null })) };
	const html = await bouwRapport(rapportGegevens(zonder, organisatie));
	assert.match(html, /^<!DOCTYPE html>/);
	assert.ok(html.includes('Voorbeelddata'));
	assert.ok(!html.includes('@voorbeeld.example'));
	assert.ok(!/<link[^>]+href=/.test(html), 'geen losse stijlbestanden');
	assert.ok(!/<script[^>]+src=/.test(html), 'geen losse scripts');
});

test('tekst van deelnemers kan het rapport niet breken', async () => {
	const kwaad = '</script><script>alert(1)</script><img src=x onerror=alert(2)>';
	const metKwaad = {
		...bron,
		bijdragen: [{ ...bron.bijdragen[0], toelichting: kwaad }],
		reacties: [{ ...bron.reacties[0], toelichting: kwaad }],
		inzendingen: [{ ...bron.inzendingen[0], antwoorden: { behouden: kwaad } }],
	};
	const html = await bouwRapport(rapportGegevens(metKwaad, organisatie));
	assert.ok(!html.includes('<script>alert(1)'));
	assert.ok(!html.includes('<img src=x'));
	assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt;'));
});

test('een traject zonder inzendingen geeft een leeg rapport', async () => {
	const html = await bouwRapport(rapportGegevens({ traject, inzendingen: [], bijdragen: [], reacties: [] }, organisatie));
	assert.ok(html.includes('Nog geen resultaten'));
});

test('exports: GeoJSON en CSV', () => {
	const geojson = bijdragenGeojson(bron);
	assert.equal(geojson.features.length, bron.bijdragen.length);
	assert.equal(geojson.features[0].properties.categorie.length > 0, true);
	assert.equal('email' in geojson.features[0].properties, false);

	const csv = bijdragenCsv(bron);
	assert.equal(csv.charCodeAt(0), 0xfeff);
	assert.equal(csv.trim().split('\r\n').length, bron.bijdragen.length + 1);

	// Een antwoord dat op een formule lijkt mag in Excel niet worden uitgevoerd.
	const formule = { ...bron, inzendingen: [{ ...bron.inzendingen[0], antwoorden: { behouden: '=HYPERLINK("http://kwaad.example")' } }] };
	assert.ok(inzendingenCsv(formule).includes(`"'=HYPERLINK(""http://kwaad.example"")"`));
});
