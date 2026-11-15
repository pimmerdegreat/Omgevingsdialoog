// Controle van alles wat van buiten komt: de opzet van een traject (beheer) en een inzending (deelnemer).
import { z } from 'zod';
import { BASISKAART_IDS } from '../gedeeld/basiskaarten.js';
import { LEEFTIJDEN, OORDELEN, VORMEN } from '../gedeeld/constanten.js';

// Foutmeldingen van de controle in het Nederlands.
z.config(z.locales.nl());

export class Invoerfout extends Error {
	constructor(bericht) {
		super(bericht);
		this.statusCode = 400;
	}
}

const sleutel = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, 'Ongeldige sleutel');
const kleur = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ongeldige kleur');
const coordinaat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const geometrieSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('Point'), coordinates: coordinaat }),
	z.object({ type: z.literal('LineString'), coordinates: z.array(coordinaat).min(2).max(2000) }),
	z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(coordinaat).min(4).max(2000)).min(1).max(20) }),
]);

const categorieSchema = z.object({
	id: sleutel,
	label: z.string().trim().min(1).max(80),
	kleur,
	vorm: z.enum(['punt', 'lijn', 'vlak']),
	uitleg: z.string().max(300).default(''),
});

const onderdeelSchema = z.object({
	id: sleutel,
	titel: z.string().trim().min(1).max(120),
	tekst: z.string().max(1500).default(''),
	kleur,
	geometrie: geometrieSchema,
});

const vraagSchema = z
	.object({
		id: sleutel,
		type: z.enum(['keuze', 'meerkeuze', 'schaal', 'tekst', 'getal']),
		label: z.string().trim().min(1).max(300),
		verplicht: z.boolean().default(false),
		opties: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
		min: z.number().int().min(0).max(10).default(1),
		max: z.number().int().min(1).max(10).default(5),
		minLabel: z.string().max(60).default(''),
		maxLabel: z.string().max(60).default(''),
	})
	.refine((v) => !['keuze', 'meerkeuze'].includes(v.type) || v.opties.length >= 2, {
		message: 'Een keuzevraag heeft minstens twee antwoordopties nodig',
	})
	.refine((v) => v.type !== 'schaal' || v.min < v.max, { message: 'De schaal loopt van laag naar hoog' });

const stapBasis = {
	id: sleutel,
	titel: z.string().trim().min(1).max(120),
	tekst: z.string().max(3000).default(''),
};

const stapSchema = z.discriminatedUnion('type', [
	z.object({ ...stapBasis, type: z.literal('tekenen'), categorieen: z.array(categorieSchema).min(1).max(12) }),
	z.object({ ...stapBasis, type: z.literal('reageren'), onderdelen: z.array(onderdeelSchema).min(1).max(40) }),
	z.object({ ...stapBasis, type: z.literal('vragen'), vragen: z.array(vraagSchema).min(1).max(30) }),
]);

const laagSchema = z.object({
	id: sleutel,
	titel: z.string().trim().min(1).max(80),
	type: z.enum(['geojson', 'afbeelding']),
	bestand_id: z.uuid(),
	kleur: kleur.default('#224362'),
	dekking: z.number().min(0.1).max(1).default(0.8),
	// Alleen bij een afbeelding: [[zuid, west], [noord, oost]] in graden (WGS84).
	grenzen: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]).optional(),
});

export const definitieSchema = z
	.object({
		intro: z.object({
			kop: z.string().trim().min(1).max(120),
			tekst: z.string().max(3000).default(''),
		}),
		kaart: z.object({
			centrum: coordinaat,
			zoom: z.number().min(3).max(20),
			basiskaarten: z.array(z.enum(BASISKAART_IDS)).min(1),
			standaard: z.enum(BASISKAART_IDS),
			lagen: z.array(laagSchema).max(12).default([]),
		}),
		stappen: z.array(stapSchema).min(1).max(12),
		over_jou: z.object({
			postcode: z.boolean().default(true),
			leeftijd: z.boolean().default(true),
			email: z.boolean().default(true),
		}),
		privacy: z.object({
			tekst: z.string().trim().min(1).max(6000),
			bewaartermijn_maanden: z.number().int().min(1).max(120).default(12),
		}),
		bedankt: z.object({
			kop: z.string().trim().min(1).max(120),
			tekst: z.string().max(2000).default(''),
		}),
	})
	.superRefine((def, ctx) => {
		if (!def.kaart.basiskaarten.includes(def.kaart.standaard)) {
			ctx.addIssue({ code: 'custom', message: 'De standaardkaart moet bij de gekozen ondergronden horen', path: ['kaart', 'standaard'] });
		}
		const dubbel = (lijst, wat, pad) => {
			const gezien = new Set();
			for (const item of lijst) {
				if (gezien.has(item.id)) ctx.addIssue({ code: 'custom', message: `Dubbele sleutel bij ${wat}: ${item.id}`, path: pad });
				gezien.add(item.id);
			}
		};
		dubbel(def.stappen, 'stappen', ['stappen']);
		dubbel(def.kaart.lagen, 'kaartlagen', ['kaart', 'lagen']);
		for (const stap of def.stappen) {
			if (stap.type === 'tekenen') dubbel(stap.categorieen, 'categorieën', ['stappen', stap.id]);
			if (stap.type === 'reageren') dubbel(stap.onderdelen, 'planonderdelen', ['stappen', stap.id]);
			if (stap.type === 'vragen') dubbel(stap.vragen, 'vragen', ['stappen', stap.id]);
		}
		for (const laag of def.kaart.lagen) {
			if (laag.type === 'afbeelding' && !laag.grenzen) {
				ctx.addIssue({ code: 'custom', message: `Kaartlaag "${laag.titel}" mist de hoekpunten van de afbeelding`, path: ['kaart', 'lagen'] });
			}
		}
	});

export const trajectSchema = z.object({
	titel: z.string().trim().min(1).max(120),
	slug: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/, 'Het webadres mag alleen kleine letters, cijfers en streepjes bevatten (3 tot 60 tekens)'),
	status: z.enum(['concept', 'open', 'gesloten']),
	definitie: definitieSchema,
});

function leesbareFout(fout) {
	const eerste = fout.issues?.[0];
	if (!eerste) return 'De invoer klopt niet.';
	const pad = eerste.path?.length ? ` (${eerste.path.join(' › ')})` : '';
	return `${eerste.message}${pad}`;
}

export function valideerTraject(invoer) {
	const uitkomst = trajectSchema.safeParse(invoer);
	if (!uitkomst.success) throw new Invoerfout(leesbareFout(uitkomst.error));
	return uitkomst.data;
}

// ---- Inzending van een deelnemer ----

const inzendingSchema = z.object({
	bijdragen: z
		.array(
			z.object({
				stap_id: sleutel,
				categorie_id: sleutel,
				toelichting: z.string().max(2000).default(''),
				geometrie: geometrieSchema,
			}),
		)
		.max(80)
		.default([]),
	reacties: z
		.array(
			z.object({
				stap_id: sleutel,
				onderdeel_id: sleutel,
				oordeel: z.enum(OORDELEN.map((o) => o.id)),
				toelichting: z.string().max(2000).default(''),
			}),
		)
		.max(80)
		.default([]),
	antwoorden: z.record(z.string(), z.unknown()).default({}),
	postcode: z.string().max(10).default(''),
	leeftijd: z.string().max(10).default(''),
	email: z.string().max(254).default(''),
	op_de_hoogte: z.boolean().default(false),
	akkoord: z.boolean().default(false),
	mobiel: z.boolean().optional(),
	// Lokveld: mensen zien dit veld niet, scripts vullen het wel in.
	website: z.string().max(200).default(''),
});

function valideerAntwoord(vraag, waarde) {
	const leeg = waarde === undefined || waarde === null || waarde === '' || (Array.isArray(waarde) && !waarde.length);
	if (leeg) {
		if (vraag.verplicht) throw new Invoerfout(`Deze vraag is verplicht: ${vraag.label}`);
		return undefined;
	}
	switch (vraag.type) {
		case 'keuze':
			if (typeof waarde !== 'string' || !vraag.opties.includes(waarde)) throw new Invoerfout(`Onbekend antwoord bij: ${vraag.label}`);
			return waarde;
		case 'meerkeuze': {
			if (!Array.isArray(waarde) || waarde.some((w) => typeof w !== 'string' || !vraag.opties.includes(w))) {
				throw new Invoerfout(`Onbekend antwoord bij: ${vraag.label}`);
			}
			return [...new Set(waarde)];
		}
		case 'schaal': {
			const getal = Number(waarde);
			if (!Number.isInteger(getal) || getal < vraag.min || getal > vraag.max) throw new Invoerfout(`Kies een waarde op de schaal bij: ${vraag.label}`);
			return getal;
		}
		case 'getal': {
			const getal = Number(waarde);
			if (!Number.isFinite(getal)) throw new Invoerfout(`Vul een getal in bij: ${vraag.label}`);
			return getal;
		}
		default: {
			if (typeof waarde !== 'string') throw new Invoerfout(`Vul tekst in bij: ${vraag.label}`);
			const tekst = waarde.trim().slice(0, 4000);
			if (!tekst && vraag.verplicht) throw new Invoerfout(`Deze vraag is verplicht: ${vraag.label}`);
			return tekst || undefined;
		}
	}
}

/**
 * Toetst een inzending aan de opzet van het traject en geeft een opgeschoonde versie terug.
 * Onbekende stappen, categorieën, planonderdelen en vragen worden geweigerd.
 */
export function valideerInzending(definitie, invoer) {
	const uitkomst = inzendingSchema.safeParse(invoer);
	if (!uitkomst.success) throw new Invoerfout(leesbareFout(uitkomst.error));
	const d = uitkomst.data;

	if (d.website) throw new Invoerfout('De inzending is geweigerd.');
	if (!d.akkoord) throw new Invoerfout('Ga akkoord met de privacyverklaring om in te zenden.');

	const stappen = new Map(definitie.stappen.map((s) => [s.id, s]));

	const bijdragen = d.bijdragen.map((b) => {
		const stap = stappen.get(b.stap_id);
		const categorie = stap?.type === 'tekenen' ? stap.categorieen.find((c) => c.id === b.categorie_id) : null;
		if (!categorie) throw new Invoerfout('Een bijdrage hoort niet bij dit traject.');
		if (VORMEN[categorie.vorm].geometrie !== b.geometrie.type) throw new Invoerfout(`De vorm past niet bij "${categorie.label}".`);
		return { ...b, toelichting: b.toelichting.trim() };
	});

	const gezien = new Set();
	const reacties = d.reacties.map((r) => {
		const stap = stappen.get(r.stap_id);
		const onderdeel = stap?.type === 'reageren' ? stap.onderdelen.find((o) => o.id === r.onderdeel_id) : null;
		if (!onderdeel) throw new Invoerfout('Een reactie hoort niet bij dit traject.');
		const kenmerk = `${r.stap_id}/${r.onderdeel_id}`;
		if (gezien.has(kenmerk)) throw new Invoerfout('Er is twee keer op hetzelfde planonderdeel gereageerd.');
		gezien.add(kenmerk);
		return { ...r, toelichting: r.toelichting.trim() };
	});

	const antwoorden = {};
	for (const stap of definitie.stappen) {
		if (stap.type !== 'vragen') continue;
		for (const vraag of stap.vragen) {
			const waarde = valideerAntwoord(vraag, d.antwoorden[vraag.id]);
			if (waarde !== undefined) antwoorden[vraag.id] = waarde;
		}
	}

	let postcode = null;
	if (definitie.over_jou.postcode && d.postcode.trim()) {
		const m = d.postcode.trim().toUpperCase().match(/^([1-9][0-9]{3})\s?([A-Z]{2})?$/);
		if (!m) throw new Invoerfout('Vul een geldige postcode in, bijvoorbeeld 3525 AA.');
		postcode = m[1] + (m[2] || '');
	}

	let leeftijd = null;
	if (definitie.over_jou.leeftijd && d.leeftijd) {
		if (!LEEFTIJDEN.some((l) => l.id === d.leeftijd)) throw new Invoerfout('Kies een leeftijdsgroep uit de lijst.');
		leeftijd = d.leeftijd;
	}

	let email = null;
	if (definitie.over_jou.email && d.email.trim()) {
		const adres = z.email().safeParse(d.email.trim());
		if (!adres.success) throw new Invoerfout('Vul een geldig e-mailadres in.');
		email = adres.data.toLowerCase();
	}

	if (!bijdragen.length && !reacties.length && !Object.keys(antwoorden).length) {
		throw new Invoerfout('De inzending is nog leeg. Zet iets op de kaart of beantwoord een vraag.');
	}

	return { bijdragen, reacties, antwoorden, postcode, leeftijd, email, op_de_hoogte: Boolean(email && d.op_de_hoogte), mobiel: d.mobiel ?? null };
}
