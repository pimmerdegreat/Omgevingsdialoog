// Alle verzoeken aan de server. In de demo (zonder server, bijvoorbeeld op GitHub Pages) komt het
// voorbeeldtraject uit een bestand en blijft een inzending in de browser staan.
import type { Inzending, InzendingRegel, PubliekTraject, Traject, TrajectRegel } from './types';

export const DEMO = import.meta.env.VITE_DEMO === '1';

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
	if (DEMO) {
		const antwoord = await fetch('demo/traject.json');
		const traject = (await antwoord.json()) as PubliekTraject;
		if (traject.slug !== slug) throw new ApiFout('Dit traject bestaat niet.', 404);
		return traject;
	}
	return verzoek<PubliekTraject>(`trajecten/${encodeURIComponent(slug)}`);
}

export async function verstuurInzending(slug: string, inzending: Inzending): Promise<void> {
	if (DEMO) {
		localStorage.setItem(`dialoogkaart:demo-inzending:${slug}`, JSON.stringify(inzending));
		return;
	}
	await verzoek(`trajecten/${encodeURIComponent(slug)}/inzendingen`, json('POST', inzending));
}

export function bestandUrl(id: string): string {
	return `api/bestanden/${id}`;
}

// ---- Beheer ----

export const beheer = {
	ik: () => verzoek<{ ingelogd: boolean; organisatie: { naam: string } }>('beheer/ik'),
	inloggen: (wachtwoord: string) => verzoek('beheer/inloggen', json('POST', { wachtwoord })),
	uitloggen: () => verzoek('beheer/uitloggen', json('POST', {})),
	trajecten: () => verzoek<TrajectRegel[]>('beheer/trajecten'),
	maak: (invoer: { titel: string; slug: string; kopie_van?: string }) => verzoek<Traject>('beheer/trajecten', json('POST', invoer)),
	traject: (id: string) => verzoek<Traject>(`beheer/trajecten/${id}`),
	bewaar: (t: Pick<Traject, 'id' | 'titel' | 'slug' | 'status' | 'definitie'>) =>
		verzoek<Traject>(`beheer/trajecten/${t.id}`, json('PUT', { titel: t.titel, slug: t.slug, status: t.status, definitie: t.definitie })),
	verwijder: (id: string) => verzoek(`beheer/trajecten/${id}`, json('DELETE')),
	inzendingen: (id: string) => verzoek<InzendingRegel[]>(`beheer/trajecten/${id}/inzendingen`),
	verwijderInzending: (id: string, inzendingId: string) => verzoek(`beheer/trajecten/${id}/inzendingen/${inzendingId}`, json('DELETE')),
	uploadBestand: (id: string, bestand: Blob, naam: string) => {
		const formulier = new FormData();
		formulier.append('bestand', bestand, naam);
		return verzoek<{ id: string; naam: string; mime: string }>(`beheer/trajecten/${id}/bestanden`, { method: 'POST', body: formulier });
	},
	qgis: () => verzoek<{ ingesteld: boolean; database: string; poort: number; gebruiker: string; schema: string; lagen: string[] }>('beheer/qgis'),
	rapportUrl: (id: string, download = false) => `api/beheer/trajecten/${id}/rapport${download ? '?download=1' : ''}`,
	exportUrl: (id: string, soort: string) => `api/beheer/trajecten/${id}/export/${soort}`,
};
