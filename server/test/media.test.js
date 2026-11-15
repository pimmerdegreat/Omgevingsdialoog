// Tests voor beelden en video's: YouTube-links, bestandsverwijzingen, controle en rapport.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestandIds, vervangBestandIds, youtubeId } from '../../gedeeld/media.js';
import { bouwRapport } from '../rapport/bouw.js';
import { rapportGegevens } from '../rapport/gegevens.js';
import { VOORBEELD_BEELDEN, voorbeeldGegevens, voorbeeldTraject } from '../seed/voorbeeld.js';
import { Invoerfout, valideerTraject } from '../validatie.js';

const CODE = 'dQw4w9WgXcQ';

test('YouTube-links in alle gangbare vormen worden herkend', () => {
	for (const link of [
		`https://www.youtube.com/watch?v=${CODE}&t=42s`,
		`https://youtu.be/${CODE}?si=abc`,
		`youtube.com/shorts/${CODE}`,
		`https://m.youtube.com/watch?v=${CODE}`,
		`https://www.youtube-nocookie.com/embed/${CODE}`,
		CODE,
	]) {
		assert.equal(youtubeId(link), CODE, link);
	}
	for (const geen of ['https://vimeo.com/123456', 'https://www.youtube.com/watch?v=kort', 'geen link', '']) assert.equal(youtubeId(geen), null, geen);
});

test('bestandsverwijzingen van kaartlagen, stappen, vragen en antwoorden worden gevonden en vervangen', () => {
	const def = structuredClone(voorbeeldTraject().definitie);
	const laag = '11111111-1111-4111-a111-111111111111';
	const vraagBeeld = '22222222-2222-4222-a222-222222222222';
	def.kaart.lagen = [{ id: 'plan', titel: 'Plan', type: 'geojson', bestand_id: laag, kleur: '#224362', dekking: 0.8 }];
	def.stappen[2].vragen[0].media = [{ type: 'afbeelding', bestand_id: vraagBeeld, bijschrift: '' }, { type: 'video', youtube: CODE, bijschrift: '' }];
	const ids = bestandIds(def);
	assert.deepEqual(new Set(ids), new Set([laag, vraagBeeld, ...VOORBEELD_BEELDEN.map((b) => b.id)]));

	// Alleen de kaartlaag en het overzicht krijgen een nieuwe sleutel; de rest valt weg.
	const nieuw = vervangBestandIds(def, { [laag]: 'nieuw-1', [VOORBEELD_BEELDEN[0].id]: 'nieuw-2' });
	assert.equal(nieuw.kaart.lagen[0].bestand_id, 'nieuw-1');
	assert.equal(nieuw.stappen[1].media[0].bestand_id, 'nieuw-2');
	assert.deepEqual(nieuw.stappen[2].vragen[0].media, [{ type: 'video', youtube: CODE, bijschrift: '' }]);
	assert.deepEqual(nieuw.stappen[2].vragen.find((v) => v.id === 'plein').optieBeelden, {});
	assert.equal(def.kaart.lagen[0].bestand_id, laag, 'het origineel blijft ongewijzigd');
});

test('beelden en video bij stappen en vragen worden gecontroleerd', () => {
	const t = voorbeeldTraject();
	const metVideo = structuredClone(t.definitie);
	metVideo.stappen[0].media = [{ type: 'video', youtube: CODE, bijschrift: 'Uitleg' }];
	metVideo.stappen[2].vragen[0].media = [{ type: 'video', youtube: CODE }];
	const geldig = valideerTraject({ titel: t.titel, slug: t.slug, status: 'open', definitie: metVideo });
	assert.equal(geldig.definitie.stappen[2].vragen[0].media[0].bijschrift, '');

	const fout = structuredClone(t.definitie);
	fout.stappen[0].media = [{ type: 'video', youtube: 'https://vimeo.com/1' }];
	assert.throws(() => valideerTraject({ titel: t.titel, slug: t.slug, status: 'open', definitie: fout }), Invoerfout);

	const teVeel = structuredClone(t.definitie);
	teVeel.stappen[2].vragen[0].media = Array.from({ length: 5 }, () => ({ type: 'video', youtube: CODE }));
	assert.throws(() => valideerTraject({ titel: t.titel, slug: t.slug, status: 'open', definitie: teVeel }), Invoerfout);

	// Een opzet van vóór de beelden is nog steeds geldig en krijgt lege lijsten.
	const oud = structuredClone(t.definitie);
	for (const stap of oud.stappen) {
		delete stap.media;
		for (const v of stap.vragen || []) {
			delete v.media;
			delete v.optieBeelden;
		}
	}
	const aangevuld = valideerTraject({ titel: t.titel, slug: t.slug, status: 'open', definitie: oud });
	assert.deepEqual(aangevuld.definitie.stappen[0].media, []);
	assert.deepEqual(aangevuld.definitie.stappen[2].vragen[0].optieBeelden, {});
});

test('het rapport toont de afbeelding bij elk model', async () => {
	const beelden = Object.fromEntries(VOORBEELD_BEELDEN.map((b) => [b.id, `data:image/png;base64,${b.bestand}`]));
	const html = await bouwRapport(rapportGegevens({ traject: voorbeeldTraject(), ...voorbeeldGegevens() }, { naam: 'Buro SRO', website: 'https://www.burosro.nl', email: 'a@b.nl' }, new Date(), beelden));
	for (const model of ['model-a.png', 'model-b.png', 'model-c.png']) assert.ok(html.includes(`class="optiebeeld" src="data:image/png;base64,${model}"`), model);
});
