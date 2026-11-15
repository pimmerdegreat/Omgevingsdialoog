// Tests voor de controle van trajecten en inzendingen. Draaien zonder database: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voorbeeldTraject } from '../seed/voorbeeld.js';
import { Invoerfout, valideerInzending, valideerTraject } from '../validatie.js';

const traject = voorbeeldTraject();
const def = traject.definitie;
const punt = { type: 'Point', coordinates: [5.12, 52.067] };
const basis = { akkoord: true, antwoorden: { cijfer: 7 } };

test('het voorbeeldtraject is een geldige opzet', () => {
	const uitkomst = valideerTraject({ titel: traject.titel, slug: traject.slug, status: 'open', definitie: def });
	assert.equal(uitkomst.definitie.stappen.length, 3);
});

test('een opzet met dubbele sleutels of een ongeldig webadres wordt geweigerd', () => {
	const dubbel = structuredClone(def);
	dubbel.stappen[0].categorieen.push({ ...dubbel.stappen[0].categorieen[0] });
	assert.throws(() => valideerTraject({ titel: 'x', slug: 'goed-adres', status: 'concept', definitie: dubbel }), Invoerfout);
	assert.throws(() => valideerTraject({ titel: 'x', slug: 'Fout Adres!', status: 'concept', definitie: def }), Invoerfout);
});

test('een volledige inzending wordt opgeschoond', () => {
	const uit = valideerInzending(def, {
		...basis,
		bijdragen: [{ stap_id: 'plekken', categorie_id: 'fijn', toelichting: '  Mooi hier.  ', geometrie: punt }],
		reacties: [{ stap_id: 'voorstellen', onderdeel_id: 'bomenrij', oordeel: 'goed', toelichting: '' }],
		antwoorden: { cijfer: '8', doel: ['Wonen', 'Wonen'], bezoek: 'Dagelijks', onbekend: 'weg' },
		postcode: '3525 aa',
		leeftijd: '30-44',
		email: 'Iemand@Voorbeeld.example',
		op_de_hoogte: true,
	});
	assert.equal(uit.bijdragen[0].toelichting, 'Mooi hier.');
	assert.deepEqual(uit.antwoorden, { bezoek: 'Dagelijks', doel: ['Wonen'], cijfer: 8 });
	assert.equal(uit.postcode, '3525AA');
	assert.equal(uit.email, 'iemand@voorbeeld.example');
	assert.equal(uit.op_de_hoogte, true);
});

test('zonder akkoord, leeg of met een ingevuld lokveld wordt geweigerd', () => {
	assert.throws(() => valideerInzending(def, { antwoorden: { cijfer: 7 } }), /akkoord/);
	assert.throws(() => valideerInzending(def, { akkoord: true }), /leeg/);
	assert.throws(() => valideerInzending(def, { ...basis, website: 'http://spam.example' }), Invoerfout);
});

test('bijdragen en reacties moeten bij het traject passen', () => {
	const fout = (invoer) => assert.throws(() => valideerInzending(def, { ...basis, ...invoer }), Invoerfout);
	fout({ bijdragen: [{ stap_id: 'plekken', categorie_id: 'bestaat-niet', geometrie: punt }] });
	fout({ bijdragen: [{ stap_id: 'plekken', categorie_id: 'route', geometrie: punt }] }); // route is een lijn
	fout({ bijdragen: [{ stap_id: 'plekken', categorie_id: 'fijn', geometrie: { type: 'Point', coordinates: [500, 52] } }] });
	fout({ reacties: [{ stap_id: 'voorstellen', onderdeel_id: 'bomenrij', oordeel: 'misschien' }] });
	fout({
		reacties: [
			{ stap_id: 'voorstellen', onderdeel_id: 'bomenrij', oordeel: 'goed' },
			{ stap_id: 'voorstellen', onderdeel_id: 'bomenrij', oordeel: 'niet' },
		],
	});
});

test('antwoorden worden getoetst aan de vraag', () => {
	const fout = (antwoorden) => assert.throws(() => valideerInzending(def, { akkoord: true, antwoorden }), Invoerfout);
	fout({ cijfer: 11 });
	fout({ bezoek: 'Nooit van gehoord' });
	fout({ doel: 'Wonen' });
});

test('persoonsgegevens: ongeldige waarden geweigerd, niet-gevraagde velden genegeerd', () => {
	assert.throws(() => valideerInzending(def, { ...basis, postcode: '12' }), /postcode/);
	assert.throws(() => valideerInzending(def, { ...basis, email: 'geen-adres' }), /e-mailadres/);
	assert.throws(() => valideerInzending(def, { ...basis, leeftijd: 'oud' }), /leeftijd/);
	const zonder = structuredClone(def);
	zonder.over_jou = { postcode: false, leeftijd: false, email: false };
	const uit = valideerInzending(zonder, { ...basis, postcode: '3525AA', email: 'a@voorbeeld.example', leeftijd: '30-44', op_de_hoogte: true });
	assert.deepEqual([uit.postcode, uit.email, uit.leeftijd, uit.op_de_hoogte], [null, null, null, false]);
});

test('een verplichte vraag moet beantwoord zijn', () => {
	const streng = structuredClone(def);
	streng.stappen[2].vragen[0].verplicht = true;
	assert.throws(() => valideerInzending(streng, { akkoord: true, antwoorden: { cijfer: 7 } }), /verplicht/);
});
