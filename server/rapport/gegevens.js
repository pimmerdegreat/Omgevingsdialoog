// Rekent de ruwe inzendingen om naar de cijfers van het rapport. Alle totalen worden hier uit de rijen geteld.
import { basiskaart } from '../../gedeeld/basiskaarten.js';
import { LEEFTIJDEN, OORDELEN } from '../../gedeeld/constanten.js';

function tel(lijst, sleutelVan) {
	const telling = new Map();
	for (const item of lijst) {
		const sleutel = sleutelVan(item);
		if (sleutel === null || sleutel === undefined || sleutel === '') continue;
		telling.set(sleutel, (telling.get(sleutel) || 0) + 1);
	}
	return telling;
}

function weekStart(iso) {
	const d = new Date(iso);
	const dag = (d.getUTCDay() + 6) % 7; // maandag = 0
	d.setUTCDate(d.getUTCDate() - dag);
	return d.toISOString().slice(0, 10);
}

/**
 * @param {{traject: object, inzendingen: object[], bijdragen: object[], reacties: object[]}} bron
 * @param {{naam: string, website: string, email: string}} organisatie
 */
export function rapportGegevens({ traject, inzendingen, bijdragen, reacties }, organisatie, nu = new Date(), beelden = {}) {
	const def = traject.definitie;

	// Categorieën in de volgorde van het traject, met hun bijdragen.
	const categorieen = [];
	for (const stap of def.stappen) {
		if (stap.type !== 'tekenen') continue;
		for (const c of stap.categorieen) {
			categorieen.push({ sleutel: `${stap.id}/${c.id}`, label: c.label, kleur: c.kleur, vorm: c.vorm, aantal: 0 });
		}
	}
	const categorieNr = new Map(categorieen.map((c, i) => [c.sleutel, i]));
	const kaartBijdragen = [];
	for (const b of bijdragen) {
		const nr = categorieNr.get(`${b.stap_id}/${b.categorie_id}`);
		if (nr === undefined) continue; // categorie is na de inzending uit het traject gehaald
		categorieen[nr].aantal++;
		kaartBijdragen.push({ c: nr, t: b.toelichting || '', g: b.geometrie });
	}

	const onderdelen = [];
	for (const stap of def.stappen) {
		if (stap.type !== 'reageren') continue;
		for (const o of stap.onderdelen) {
			const eigen = reacties.filter((r) => r.stap_id === stap.id && r.onderdeel_id === o.id);
			const telling = Object.fromEntries(OORDELEN.map((oordeel) => [oordeel.id, eigen.filter((r) => r.oordeel === oordeel.id).length]));
			onderdelen.push({
				titel: o.titel,
				tekst: o.tekst,
				kleur: o.kleur,
				geometrie: o.geometrie,
				...telling,
				totaal: eigen.length,
				toelichtingen: eigen.filter((r) => r.toelichting).map((r) => ({ o: r.oordeel, t: r.toelichting })),
			});
		}
	}

	const vragen = [];
	for (const stap of def.stappen) {
		if (stap.type !== 'vragen') continue;
		for (const v of stap.vragen) {
			const waarden = inzendingen.map((i) => i.antwoorden?.[v.id]).filter((w) => w !== undefined && w !== null && w !== '');
			const vraag = { label: v.label, type: v.type, aantal: waarden.length };
			if (v.type === 'keuze' || v.type === 'meerkeuze') {
				const telling = tel(waarden.flat(), (w) => w);
				// Een afbeelding per antwoord (bijvoorbeeld een ontwerpmodel) gaat als data-adres mee in het rapport.
				vraag.opties = v.opties.map((label) => ({ label, aantal: telling.get(label) || 0, beeld: beelden[v.optieBeelden?.[label]] || null }));
			} else if (v.type === 'schaal') {
				const telling = tel(waarden, (w) => Number(w));
				vraag.opties = [];
				for (let n = v.min; n <= v.max; n++) vraag.opties.push({ label: String(n), aantal: telling.get(n) || 0 });
				vraag.gemiddelde = waarden.length ? waarden.reduce((s, w) => s + Number(w), 0) / waarden.length : null;
				vraag.minLabel = v.minLabel;
				vraag.maxLabel = v.maxLabel;
			} else if (v.type === 'getal') {
				const getallen = waarden.map(Number).filter(Number.isFinite);
				vraag.gemiddelde = getallen.length ? getallen.reduce((s, w) => s + w, 0) / getallen.length : null;
				vraag.laagste = getallen.length ? Math.min(...getallen) : null;
				vraag.hoogste = getallen.length ? Math.max(...getallen) : null;
			} else {
				vraag.antwoorden = waarden.map(String);
			}
			vragen.push(vraag);
		}
	}

	const leeftijdTelling = tel(inzendingen, (i) => i.leeftijd);
	const postcodeTelling = tel(inzendingen, (i) => (i.postcode ? i.postcode.slice(0, 4) : null));
	const weekTelling = tel(inzendingen, (i) => weekStart(i.ingediend));
	const momenten = inzendingen.map((i) => i.ingediend).sort();

	const ondergronden = [...new Set(['brt-grijs', ...def.kaart.basiskaarten])].map((id) => {
		const k = basiskaart(id);
		return { id: k.id, naam: k.naam, url: k.url, maxZoom: k.maxZoom, bron: k.bron };
	});

	const openAntwoorden = vragen.filter((v) => v.type === 'tekst').reduce((s, v) => s + v.aantal, 0);
	const toelichtingen = kaartBijdragen.filter((b) => b.t).length + reacties.filter((r) => r.toelichting).length + openAntwoorden;

	return {
		titel: traject.titel,
		slug: traject.slug,
		voorbeeld: Boolean(traject.voorbeeld),
		status: traject.status,
		organisatie,
		gemaakt: nu.toISOString(),
		periode: momenten.length ? { van: momenten[0], tot: momenten[momenten.length - 1] } : null,
		kaart: { centrum: def.kaart.centrum, zoom: def.kaart.zoom, ondergronden },
		totalen: {
			deelnemers: inzendingen.length,
			bijdragen: kaartBijdragen.length,
			reacties: reacties.length,
			toelichtingen,
		},
		categorieen,
		bijdragen: kaartBijdragen,
		onderdelen,
		vragen,
		deelnemers: {
			leeftijd: LEEFTIJDEN.map((l) => ({ label: l.label, aantal: leeftijdTelling.get(l.id) || 0 })),
			leeftijdBekend: [...leeftijdTelling.values()].reduce((s, n) => s + n, 0),
			postcodes: [...postcodeTelling.entries()].map(([label, aantal]) => ({ label, aantal })).sort((a, b) => b.aantal - a.aantal || a.label.localeCompare(b.label)),
			postcodeBekend: [...postcodeTelling.values()].reduce((s, n) => s + n, 0),
			weken: [...weekTelling.entries()].map(([week, aantal]) => ({ week, aantal })).sort((a, b) => a.week.localeCompare(b.week)),
		},
	};
}
