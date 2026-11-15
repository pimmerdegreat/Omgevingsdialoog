// Export als CSV voor Excel: puntkomma als scheidingsteken en een BOM, zodat Nederlandse Excel het bestand direct goed opent.
import { OORDELEN } from '../../gedeeld/constanten.js';
import { categorieIndex, leeftijdLabel } from './geojson.js';

function cel(waarde) {
	if (waarde === null || waarde === undefined) return '';
	let tekst = Array.isArray(waarde) ? waarde.join(', ') : String(waarde);
	// Voorkomt dat Excel een antwoord als formule uitvoert.
	if (/^[=+\-@\t\r]/.test(tekst)) tekst = `'${tekst}`;
	return /[";\n\r]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

function csv(kop, rijen) {
	return '﻿' + [kop, ...rijen].map((rij) => rij.map(cel).join(';')).join('\r\n') + '\r\n';
}

function datum(iso) {
	return iso ? iso.replace('T', ' ').slice(0, 16) : '';
}

function zwaartepunt(geometrie) {
	const punten = geometrie.type === 'Point' ? [geometrie.coordinates] : geometrie.type === 'LineString' ? geometrie.coordinates : geometrie.coordinates[0];
	const som = punten.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
	return [som[0] / punten.length, som[1] / punten.length];
}

/** Eén rij per deelnemer, met alle antwoorden. Bevat e-mailadressen als de gegevens met persoonsgegevens zijn opgehaald. */
export function inzendingenCsv({ traject, inzendingen, bijdragen, reacties }) {
	const vragen = traject.definitie.stappen.filter((s) => s.type === 'vragen').flatMap((s) => s.vragen);
	const onderdelen = traject.definitie.stappen.filter((s) => s.type === 'reageren').flatMap((s) => s.onderdelen.map((o) => ({ stap: s.id, ...o })));
	const kop = [
		'Inzending',
		'Ingediend',
		'Postcode',
		'Leeftijd',
		'E-mailadres',
		'Op de hoogte houden',
		'Aantal kaartbijdragen',
		...vragen.map((v) => v.label),
		...onderdelen.flatMap((o) => [`Oordeel: ${o.titel}`, `Toelichting: ${o.titel}`]),
	];
	const rijen = inzendingen.map((i) => {
		const eigenReacties = reacties.filter((r) => r.inzending_id === i.id);
		return [
			i.id,
			datum(i.ingediend),
			i.postcode,
			leeftijdLabel(i.leeftijd),
			i.email,
			i.email ? (i.op_de_hoogte ? 'ja' : 'nee') : '',
			bijdragen.filter((b) => b.inzending_id === i.id).length,
			...vragen.map((v) => i.antwoorden[v.id]),
			...onderdelen.flatMap((o) => {
				const r = eigenReacties.find((x) => x.stap_id === o.stap && x.onderdeel_id === o.id);
				return [r ? OORDELEN.find((x) => x.id === r.oordeel)?.label : '', r?.toelichting];
			}),
		];
	});
	return csv(kop, rijen);
}

/** Eén rij per kaartbijdrage, met het zwaartepunt in graden. */
export function bijdragenCsv({ traject, inzendingen, bijdragen }) {
	const categorieen = categorieIndex(traject.definitie);
	const perInzending = new Map(inzendingen.map((i) => [i.id, i]));
	const kop = ['Bijdrage', 'Inzending', 'Ingediend', 'Categorie', 'Vorm', 'Toelichting', 'Lengtegraad', 'Breedtegraad'];
	const vormen = { Point: 'punt', LineString: 'lijn', Polygon: 'vlak' };
	const rijen = bijdragen.map((b) => {
		const [lng, lat] = zwaartepunt(b.geometrie);
		return [
			b.id,
			b.inzending_id,
			datum(perInzending.get(b.inzending_id)?.ingediend),
			categorieen.get(`${b.stap_id}/${b.categorie_id}`)?.label || b.categorie_id,
			vormen[b.geometrie.type],
			b.toelichting,
			lng.toFixed(6).replace('.', ','),
			lat.toFixed(6).replace('.', ','),
		];
	});
	return csv(kop, rijen);
}
