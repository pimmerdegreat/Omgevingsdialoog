// Alle verzoeken aan de server. In de demo zonder server (GitHub Pages) gaan ze naar demo.ts,
// dat de server in de browser nabootst. Dat bestand wordt alleen in de demo geladen.
import type { Inzending, InzendingRegel, PubliekTraject, Traject, TrajectRegel } from './types';

export const DEMO = import.meta.env.VITE_DEMO === '1';

/** Vaste sleutel van het voorbeeldtraject in de demo (zie server/seed/demo.js). */
export const DEMO_TRAJECT_ID = '00000000-0000-4000-a000-000000000001';

const demo = () => import('./demo');

/** Kaartlagen die in de demo in deze browser zijn geüpload. */
const demoBestanden = new Map<string, string>();

export class ApiFout extends Error {
	status: number;
	constructor(bericht: string, status: number) {
		super(bericht);
		this.status = status;
	}
}

async function verzoek<T>(pad: string, opties: RequestInit = {}): Promise<T> {
	let antwoord: Response;
	try {
		antwoord = await fetch(`api/${pad}`, {
			...opties,
			headers: { 'x-dialoogkaart': '1', ...(opties.body && !(opties.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...opties.headers },
			credentials: 'same-origin',
		});
	} catch {
		throw new ApiFout('De server is niet bereikbaar. Controleer je internetverbinding en probeer het opnieuw.', 0);
	}
	const inhoud = await antwoord.json().catch(() => null);
	if (!antwoord.ok) throw new ApiFout(inhoud?.fout || 'Er ging iets mis. Probeer het opnieuw.', antwoord.status);
	return inhoud as T;
}

const json = (methode: string, lichaam?: unknown): RequestInit => ({ method: methode, body: lichaam === undefined ? undefined : JSON.stringify(lichaam) });

// ---- Deelnemers ----

export async function haalTraject(slug: string): Promise<PubliekTraject> {
	if (DEMO) return (await demo()).haalTraject(slug);
	return verzoek<PubliekTraject>(`trajecten/${encodeURIComponent(slug)}`);
}

export async function verstuurInzending(slug: string, inzending: Inzending): Promise<void> {
	if (DEMO) return (await demo()).verstuurInzending(slug, inzending);
	await verzoek(`trajecten/${encodeURIComponent(slug)}/inzendingen`, json('POST', inzending));
}

export function bestandUrl(id: string): string {
	if (DEMO) return demoBestanden.get(id) || localStorage.getItem(`dialoogkaart:demo:bestand:${id}`) || '';
	return `api/bestanden/${id}`;
}

// ---- Beheer ----

const EXPORTNAMEN: Record<string, string> = {
	geopackage: 'voorbeeld-goylaan.gpkg',
	geojson: 'voorbeeld-goylaan-bijdragen.geojson',
	'bijdragen.csv': 'voorbeeld-goylaan-bijdragen.csv',
	'inzendingen.csv': 'voorbeeld-goylaan-inzendingen.csv',
};

export const beheer = {
	ik: async () => (DEMO ? (await demo()).ik() : verzoek<{ ingelogd: boolean; organisatie: { naam: string } }>('beheer/ik')),
	inloggen: async (wachtwoord: string) => (DEMO ? (await demo()).inloggen(wachtwoord) : verzoek('beheer/inloggen', json('POST', { wachtwoord }))),
	uitloggen: async () => (DEMO ? (await demo()).uitloggen() : verzoek('beheer/uitloggen', json('POST', {}))),
	trajecten: async () => (DEMO ? (await demo()).trajecten() : verzoek<TrajectRegel[]>('beheer/trajecten')),
	maak: async (invoer: { titel: string; slug: string; kopie_van?: string }) => (DEMO ? (await demo()).maak(invoer) : verzoek<Traject>('beheer/trajecten', json('POST', invoer))),
	traject: async (id: string) => (DEMO ? (await demo()).traject(id) : verzoek<Traject>(`beheer/trajecten/${id}`)),
	bewaar: async (t: Pick<Traject, 'id' | 'titel' | 'slug' | 'status' | 'definitie'>) =>
		DEMO
			? (await demo()).bewaarTraject(t)
			: verzoek<Traject>(`beheer/trajecten/${t.id}`, json('PUT', { titel: t.titel, slug: t.slug, status: t.status, definitie: t.definitie })),
	verwijder: async (id: string) => (DEMO ? (await demo()).verwijder(id) : verzoek(`beheer/trajecten/${id}`, json('DELETE'))),
	inzendingen: async (id: string) => (DEMO ? (await demo()).inzendingen(id) : verzoek<InzendingRegel[]>(`beheer/trajecten/${id}/inzendingen`)),
	verwijderInzending: async (id: string, inzendingId: string) =>
		DEMO ? (await demo()).verwijderInzending(id, inzendingId) : verzoek(`beheer/trajecten/${id}/inzendingen/${inzendingId}`, json('DELETE')),
	uploadBestand: async (id: string, bestand: Blob, naam: string) => {
		if (DEMO) return (await demo()).uploadBestand(id, bestand, naam, demoBestanden);
		const formulier = new FormData();
		formulier.append('bestand', bestand, naam);
		return verzoek<{ id: string; naam: string; mime: string }>(`beheer/trajecten/${id}/bestanden`, { method: 'POST', body: formulier });
	},
	qgis: async () =>
		DEMO ? (await demo()).qgis() : verzoek<{ ingesteld: boolean; database: string; poort: number; gebruiker: string; schema: string; lagen: string[] }>('beheer/qgis'),
	/** Zet de demo terug naar de beginstand. Doet niets buiten de demo. */
	demoOpnieuw: async () => {
		if (DEMO) (await demo()).begin();
	},
	/** Adres van het rapport. In de demo is er alleen een rapport van het voorbeeldtraject; anders een lege tekst. */
	rapportUrl: (id: string, download = false) => {
		if (DEMO) return id === DEMO_TRAJECT_ID ? 'demo/resultaten.html' : '';
		return `api/beheer/trajecten/${id}/rapport${download ? '?download=1' : ''}`;
	},
	/** Adres van een export. In de demo zijn er alleen exports van het voorbeeldtraject; anders een lege tekst. */
	exportUrl: (id: string, soort: string) => {
		if (DEMO) return id === DEMO_TRAJECT_ID && EXPORTNAMEN[soort] ? `demo/export/${EXPORTNAMEN[soort]}` : '';
		return `api/beheer/trajecten/${id}/export/${soort}`;
	},
};
