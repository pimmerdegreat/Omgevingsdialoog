// De demo zonder server (GitHub Pages): beheer en meedoen werken volledig, maar alles blijft in deze browser.
// Dit bestand bootst de server na. Het gebruikt dezelfde controle van invoer als de echte server.
// De beginstand (het voorbeeldtraject met 148 verzonnen deelnemers) komt uit demo/beheer.json.
import { legeDefinitie } from '../../gedeeld/sjabloon.js';
import { valideerInzending, valideerTraject } from '../../server/validatie.js';
import { ApiFout, DEMO_TRAJECT_ID, registreerDemoBestand } from './api';
import type { Definitie, Inzending, InzendingRegel, Organisatie, PubliekTraject, Traject, TrajectRegel } from './types';

const OPSLAG = 'dialoogkaart:demo:beheer:v1';
export const BESTAND_VOORVOEGSEL = 'dialoogkaart:demo:bestand:';
export const DEMO_WACHTWOORD = 'demo';

interface Beginstand {
	organisatie: Organisatie;
	traject: Traject;
	inzendingen: InzendingRegel[];
	/** Bestanden van het voorbeeldtraject: sleutel naar adres op de site. */
	bestanden: Record<string, string>;
}

type EigenInzending = InzendingRegel & { traject_id: string };

interface Opslag {
	ingelogd: boolean;
	trajecten: Traject[];
	/** Inzendingen die in deze browser via de demo zijn gedaan. */
	eigen: EigenInzending[];
	/** Verwijderde inzendingen uit de beginstand. */
	verwijderd: string[];
}

let beginstand: Beginstand | null = null;
let opslag: Opslag | null = null;

async function laad(): Promise<{ begin: Beginstand; o: Opslag }> {
	if (!beginstand) {
		const antwoord = await fetch('demo/beheer.json');
		if (!antwoord.ok) throw new ApiFout('De demo kon niet worden geladen.', 500);
		beginstand = (await antwoord.json()) as Beginstand;
		for (const [id, adres] of Object.entries(beginstand.bestanden || {})) registreerDemoBestand(id, adres);
	}
	if (!opslag) {
		try {
			opslag = JSON.parse(localStorage.getItem(OPSLAG) || 'null');
		} catch {
			opslag = null;
		}
		if (!opslag) opslag = { ingelogd: false, trajecten: [structuredClone(beginstand.traject)], eigen: [], verwijderd: [] };
	}
	return { begin: beginstand, o: opslag };
}

function bewaar() {
	try {
		localStorage.setItem(OPSLAG, JSON.stringify(opslag));
	} catch {
		// Geen opslag beschikbaar (privévenster): de demo werkt tot de pagina sluit.
	}
}

/** Zet de demo terug naar de beginstand, inclusief geüploade kaartlagen. */
export function begin() {
	for (const sleutel of Object.keys(localStorage)) {
		if (sleutel.startsWith('dialoogkaart:demo')) localStorage.removeItem(sleutel);
	}
	opslag = null;
}

function controleer<T>(fn: () => T): T {
	try {
		return fn();
	} catch (fout) {
		throw new ApiFout((fout as Error).message, 400);
	}
}

function inzendingenVan(begin: Beginstand, o: Opslag, trajectId: string): InzendingRegel[] {
	const uitBegin = trajectId === DEMO_TRAJECT_ID ? begin.inzendingen.filter((i) => !o.verwijderd.includes(i.id)) : [];
	const eigen = o.eigen.filter((i) => i.traject_id === trajectId).map(({ traject_id: _t, ...rest }) => rest);
	return [...uitBegin, ...eigen].sort((a, b) => a.ingediend.localeCompare(b.ingediend));
}

function vind(o: Opslag, id: string): Traject {
	const traject = o.trajecten.find((t) => t.id === id);
	if (!traject) throw new ApiFout('Dit traject bestaat niet.', 404);
	return traject;
}

function vereisInlog(o: Opslag) {
	if (!o.ingelogd) throw new ApiFout('Log eerst in.', 401);
}

// ---- Deelnemers ----

export async function haalTraject(slug: string): Promise<PubliekTraject> {
	const { begin, o } = await laad();
	const t = o.trajecten.find((x) => x.slug === slug);
	if (!t || (t.status === 'concept' && !o.ingelogd)) throw new ApiFout('Dit traject bestaat niet.', 404);
	return { slug: t.slug, titel: t.titel, status: t.status, voorbeeld: t.voorbeeld, definitie: t.definitie, organisatie: begin.organisatie };
}

export async function verstuurInzending(slug: string, invoer: Inzending) {
	const { o } = await laad();
	const t = o.trajecten.find((x) => x.slug === slug);
	if (!t || t.status === 'concept') throw new ApiFout('Dit traject bestaat niet.', 404);
	if (t.status !== 'open') throw new ApiFout('Dit traject is gesloten. Inzenden kan niet meer.', 409);
	const schoon = controleer(() => valideerInzending(t.definitie, invoer));
	o.eigen.push({
		id: crypto.randomUUID(),
		traject_id: t.id,
		ingediend: new Date().toISOString(),
		postcode: schoon.postcode,
		leeftijd: schoon.leeftijd,
		email: schoon.email,
		op_de_hoogte: schoon.op_de_hoogte,
		bijdragen: schoon.bijdragen.length,
		reacties: schoon.reacties.length,
	});
	bewaar();
}

// ---- Beheer ----

export async function ik() {
	const { begin, o } = await laad();
	return { ingelogd: o.ingelogd, organisatie: begin.organisatie };
}

export async function inloggen(wachtwoord: string) {
	const { o } = await laad();
	if (wachtwoord !== DEMO_WACHTWOORD) throw new ApiFout(`Het wachtwoord klopt niet. In de demo is het wachtwoord: ${DEMO_WACHTWOORD}`, 401);
	o.ingelogd = true;
	bewaar();
	return { ok: true };
}

export async function uitloggen() {
	const { o } = await laad();
	o.ingelogd = false;
	bewaar();
	return { ok: true };
}

export async function trajecten(): Promise<TrajectRegel[]> {
	const { begin, o } = await laad();
	vereisInlog(o);
	return [...o.trajecten]
		.sort((a, b) => b.aangemaakt.localeCompare(a.aangemaakt))
		.map((t) => {
			const lijst = inzendingenVan(begin, o, t.id);
			return {
				id: t.id,
				slug: t.slug,
				titel: t.titel,
				status: t.status,
				voorbeeld: t.voorbeeld,
				aangemaakt: t.aangemaakt,
				inzendingen: lijst.length,
				bijdragen: lijst.reduce((s, i) => s + i.bijdragen, 0),
				laatste_inzending: lijst.length ? lijst[lijst.length - 1].ingediend : null,
			};
		});
}

export async function maak(invoer: { titel: string; slug: string; kopie_van?: string }): Promise<Traject> {
	const { begin, o } = await laad();
	vereisInlog(o);
	let definitie = legeDefinitie(begin.organisatie) as unknown as Definitie;
	if (invoer.kopie_van) {
		const bron = vind(o, invoer.kopie_van);
		// In de demo staan bestanden los van een traject; de kopie mag dezelfde bestanden gebruiken.
		definitie = structuredClone(bron.definitie);
	}
	const schoon = controleer(() => valideerTraject({ titel: invoer.titel, slug: invoer.slug, status: 'concept', definitie }));
	if (o.trajecten.some((t) => t.slug === schoon.slug)) throw new ApiFout('Dit webadres is al in gebruik bij een ander traject.', 409);
	const nu = new Date().toISOString();
	const traject: Traject = { id: crypto.randomUUID(), slug: schoon.slug, titel: schoon.titel, status: 'concept', voorbeeld: false, definitie: schoon.definitie as Traject['definitie'], aangemaakt: nu, gewijzigd: nu };
	o.trajecten.push(traject);
	bewaar();
	return structuredClone(traject);
}

export async function traject(id: string): Promise<Traject> {
	const { o } = await laad();
	vereisInlog(o);
	return structuredClone(vind(o, id));
}

export async function bewaarTraject(t: Pick<Traject, 'id' | 'titel' | 'slug' | 'status' | 'definitie'>): Promise<Traject> {
	const { o } = await laad();
	vereisInlog(o);
	const bestaand = vind(o, t.id);
	const schoon = controleer(() => valideerTraject({ titel: t.titel, slug: t.slug, status: t.status, definitie: t.definitie }));
	if (o.trajecten.some((x) => x.slug === schoon.slug && x.id !== t.id)) throw new ApiFout('Dit webadres is al in gebruik bij een ander traject.', 409);
	Object.assign(bestaand, { titel: schoon.titel, slug: schoon.slug, status: schoon.status, definitie: schoon.definitie, gewijzigd: new Date().toISOString() });
	bewaar();
	return structuredClone(bestaand);
}

export async function verwijder(id: string) {
	const { o } = await laad();
	vereisInlog(o);
	vind(o, id);
	o.trajecten = o.trajecten.filter((t) => t.id !== id);
	o.eigen = o.eigen.filter((i) => i.traject_id !== id);
	bewaar();
	return { ok: true };
}

export async function inzendingen(id: string): Promise<InzendingRegel[]> {
	const { begin, o } = await laad();
	vereisInlog(o);
	vind(o, id);
	return inzendingenVan(begin, o, id);
}

export async function verwijderInzending(id: string, inzendingId: string) {
	const { begin, o } = await laad();
	vereisInlog(o);
	if (id === DEMO_TRAJECT_ID && begin.inzendingen.some((i) => i.id === inzendingId)) o.verwijderd.push(inzendingId);
	else o.eigen = o.eigen.filter((i) => i.id !== inzendingId);
	bewaar();
	return { ok: true };
}

/** Bewaart een kaartlaag als data-adres in de browser. Grote afbeeldingen passen niet en worden geweigerd. */
export async function uploadBestand(id: string, bestand: Blob, naam: string, geheugen: Map<string, string>) {
	const { o } = await laad();
	vereisInlog(o);
	vind(o, id);
	const mime = bestand.type || (/\.(geo)?json$/i.test(naam) ? 'application/geo+json' : '');
	if (!/^image\/(png|jpeg|webp)$/.test(mime) && !/json/.test(mime)) throw new ApiFout('Dit bestand is geen PNG, JPG, WebP of GeoJSON.', 400);
	if (bestand.size > 4 * 1024 * 1024) throw new ApiFout('In de demo kan een bestand hoogstens 4 MB zijn. Op de echte server is dat 15 MB.', 413);
	const dataAdres = await new Promise<string>((klaar, mislukt) => {
		const lezer = new FileReader();
		lezer.onload = () => klaar(String(lezer.result));
		lezer.onerror = () => mislukt(new ApiFout('Het bestand kon niet worden gelezen.', 400));
		lezer.readAsDataURL(bestand);
	});
	const bestandId = crypto.randomUUID();
	geheugen.set(bestandId, dataAdres);
	try {
		localStorage.setItem(BESTAND_VOORVOEGSEL + bestandId, dataAdres);
	} catch {
		// Te groot voor de opslag van de browser: blijft beschikbaar tot de pagina sluit.
	}
	return { id: bestandId, naam, mime };
}

export async function qgis() {
	return { ingesteld: false, database: 'dialoogkaart', poort: 5432, gebruiker: 'qgis_lezer', schema: 'qgis', lagen: [] as string[] };
}
