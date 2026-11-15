// Beelden en video's in een traject: YouTube-links herkennen en bijhouden welke bestanden een traject gebruikt.
// Gedeeld door de server, beheer en de demo zonder server.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Haalt de video-code uit een YouTube-link. Werkt met youtube.com/watch?v=, youtu.be/, /shorts/, /embed/ en /live/,
 * en met een losse code van elf tekens. Geeft null als het geen YouTube-link is.
 */
export function youtubeId(invoer) {
	const tekst = String(invoer || '').trim();
	if (YOUTUBE_ID.test(tekst)) return tekst;
	let adres;
	try {
		adres = new URL(/^https?:\/\//i.test(tekst) ? tekst : `https://${tekst}`);
	} catch {
		return null;
	}
	const host = adres.hostname.replace(/^(www\.|m\.|music\.)/, '');
	let id = null;
	if (host === 'youtu.be') id = adres.pathname.split('/')[1];
	else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
		if (adres.pathname === '/watch') id = adres.searchParams.get('v');
		else {
			const [, soort, code] = adres.pathname.split('/');
			if (['shorts', 'embed', 'live', 'v'].includes(soort)) id = code;
		}
	}
	return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Adres om een YouTube-video in te sluiten, via het privacyvriendelijke domein zonder cookies. */
export function youtubeInsluiten(id) {
	return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

/** Alle bestanden waar de opzet van een traject naar verwijst: kaartlagen, beelden per stap en beelden per antwoord. */
export function bestandIds(definitie) {
	const ids = new Set();
	for (const laag of definitie?.kaart?.lagen || []) ids.add(laag.bestand_id);
	for (const stap of definitie?.stappen || []) {
		for (const m of stap.media || []) if (m.type === 'afbeelding') ids.add(m.bestand_id);
		for (const vraag of stap.vragen || []) {
			for (const id of Object.values(vraag.optieBeelden || {})) ids.add(id);
			for (const m of vraag.media || []) if (m.type === 'afbeelding') ids.add(m.bestand_id);
		}
	}
	return [...ids];
}

/**
 * Geeft een kopie van de opzet waarin elke bestandsverwijzing via de tabel is vervangen.
 * Verwijzingen die niet in de tabel staan, vallen weg.
 */
export function vervangBestandIds(definitie, tabel) {
	const nieuw = structuredClone(definitie);
	const map = tabel instanceof Map ? tabel : new Map(Object.entries(tabel));
	nieuw.kaart.lagen = (nieuw.kaart.lagen || []).filter((l) => map.has(l.bestand_id)).map((l) => ({ ...l, bestand_id: map.get(l.bestand_id) }));
	const vervangMedia = (lijst) =>
		lijst.filter((m) => m.type !== 'afbeelding' || map.has(m.bestand_id)).map((m) => (m.type === 'afbeelding' ? { ...m, bestand_id: map.get(m.bestand_id) } : m));
	for (const stap of nieuw.stappen) {
		if (stap.media) stap.media = vervangMedia(stap.media);
		for (const vraag of stap.vragen || []) {
			if (vraag.media) vraag.media = vervangMedia(vraag.media);
			if (!vraag.optieBeelden) continue;
			vraag.optieBeelden = Object.fromEntries(
				Object.entries(vraag.optieBeelden)
					.filter(([, id]) => map.has(id))
					.map(([optie, id]) => [optie, map.get(id)]),
			);
		}
	}
	return nieuw;
}
