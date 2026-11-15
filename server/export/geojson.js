// Export van kaartbijdragen als GeoJSON (WGS84), direct te openen in QGIS.
import { LEEFTIJDEN } from '../../gedeeld/constanten.js';

export function categorieIndex(definitie) {
	const index = new Map();
	for (const stap of definitie.stappen) {
		if (stap.type !== 'tekenen') continue;
		for (const c of stap.categorieen) index.set(`${stap.id}/${c.id}`, c);
	}
	return index;
}

export function leeftijdLabel(id) {
	return LEEFTIJDEN.find((l) => l.id === id)?.label || '';
}

export function bijdragenGeojson({ traject, inzendingen, bijdragen }) {
	const categorieen = categorieIndex(traject.definitie);
	const perInzending = new Map(inzendingen.map((i) => [i.id, i]));
	return {
		type: 'FeatureCollection',
		name: `${traject.slug}-bijdragen`,
		features: bijdragen.map((b) => {
			const inzending = perInzending.get(b.inzending_id);
			return {
				type: 'Feature',
				id: b.id,
				geometry: b.geometrie,
				properties: {
					categorie: categorieen.get(`${b.stap_id}/${b.categorie_id}`)?.label || b.categorie_id,
					toelichting: b.toelichting,
					ingediend: inzending?.ingediend || null,
					leeftijd: leeftijdLabel(inzending?.leeftijd),
					postcode4: inzending?.postcode?.slice(0, 4) || null,
					inzending_id: b.inzending_id,
				},
			};
		}),
	};
}
