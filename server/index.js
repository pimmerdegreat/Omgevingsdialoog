// Dialoogkaart: de server. Levert de website, de API voor deelnemers en de API voor beheer.
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config } from './config.js';
import * as data from './data.js';
import { initDatabase } from './db.js';
import { bijdragenCsv, inzendingenCsv } from './export/csv.js';
import { bijdragenGeojson } from './export/geojson.js';
import { bouwGeopackage } from './export/gpkg.js';
import { bouwRapport } from './rapport/bouw.js';
import { rapportGegevens } from './rapport/gegevens.js';
import { bestandIds, vervangBestandIds } from '../gedeeld/media.js';
import { legeDefinitie } from './sjabloon.js';
import { Invoerfout, valideerInzending, valideerTraject } from './validatie.js';

const SESSIE_COOKIE = 'dk_sessie';
const SESSIE_DUUR_MS = 12 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const database = await initDatabase();

const app = Fastify({ logger: { level: config.productie ? 'info' : 'warn' }, trustProxy: config.achterProxy, bodyLimit: 2 * 1024 * 1024 });

app.decorateReply('rapport', false);

await app.register(cookie, { secret: config.sessieGeheim });
await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
await app.register(rateLimit, { global: false });
await app.register(cors, {
	origin: config.toegestaneHerkomst.length ? config.toegestaneHerkomst : false,
	methods: ['GET', 'POST'],
});

// Beveiligingskoppen. Het rapport bevat zijn eigen script en stijl en krijgt daarom een ruimere regel.
app.addHook('onSend', async (request, reply) => {
	reply.header('X-Content-Type-Options', 'nosniff');
	reply.header('Referrer-Policy', 'same-origin');
	const script = reply.rapport ? "'unsafe-inline'" : "'self'";
	const insluiten = ['\'self\'', ...config.insluitenOp].join(' ');
	reply.header(
		'Content-Security-Policy',
		`default-src 'self'; script-src ${script}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-src 'self' https://www.youtube-nocookie.com; frame-ancestors ${insluiten}; base-uri 'self'; form-action 'self'`,
	);
});

app.setErrorHandler((fout, request, reply) => {
	if (fout instanceof Invoerfout) return reply.code(400).send({ fout: fout.message });
	if (fout.statusCode === 429) return reply.code(429).send({ fout: 'Te veel verzoeken achter elkaar. Probeer het over een paar minuten opnieuw.' });
	if (fout.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ fout: 'Het bestand is groter dan 15 MB.' });
	if (fout.statusCode && fout.statusCode < 500) return reply.code(fout.statusCode).send({ fout: fout.message });
	request.log.error(fout);
	return reply.code(500).send({ fout: 'Er ging iets mis op de server.' });
});

function nietGevonden(reply, wat = 'Dit traject') {
	return reply.code(404).send({ fout: `${wat} bestaat niet.` });
}

// ---- Sessie voor beheer ----

function isIngelogd(request) {
	const ruw = request.cookies[SESSIE_COOKIE];
	if (!ruw) return false;
	const { valid, value } = request.unsignCookie(ruw);
	return valid && Number(value) > Date.now();
}

function wachtwoordKlopt(invoer) {
	const hash = (tekst) => createHash('sha256').update(String(tekst)).digest();
	return timingSafeEqual(hash(invoer), hash(config.beheerWachtwoord));
}

async function vereisBeheer(request, reply) {
	if (!isIngelogd(request)) return reply.code(401).send({ fout: 'Log eerst in.' });
	// Wijzigingen moeten van de eigen website komen: een andere site kan deze kop niet meesturen.
	if (request.method !== 'GET' && request.headers['x-dialoogkaart'] !== '1') {
		return reply.code(403).send({ fout: 'Dit verzoek is geweigerd.' });
	}
}

async function trajectVanVerzoek(request, reply) {
	if (!UUID.test(request.params.id)) return nietGevonden(reply);
	const traject = await data.trajectOpId(request.params.id);
	if (!traject) return nietGevonden(reply);
	request.traject = traject;
}

// ---- Deelnemers ----

app.get('/api/gezondheid', async () => ({ ok: true }));

app.get('/api/trajecten/:slug', async (request, reply) => {
	const traject = await data.trajectOpSlug(request.params.slug);
	// Een concept is alleen te zien voor wie in beheer is ingelogd (voorvertoning).
	if (!traject || (traject.status === 'concept' && !isIngelogd(request))) return nietGevonden(reply);
	return {
		slug: traject.slug,
		titel: traject.titel,
		status: traject.status,
		voorbeeld: traject.voorbeeld,
		definitie: traject.definitie,
		organisatie: config.organisatie,
	};
});

app.post(
	'/api/trajecten/:slug/inzendingen',
	// Ruim genoeg voor een inloopavond waar veel deelnemers hetzelfde netwerk delen; het lokveld houdt scripts tegen.
	{ config: { rateLimit: { max: 120, timeWindow: '1 hour' } } },
	async (request, reply) => {
		const traject = await data.trajectOpSlug(request.params.slug);
		if (!traject || traject.status === 'concept') return nietGevonden(reply);
		if (traject.status !== 'open') return reply.code(409).send({ fout: 'Dit traject is gesloten. Inzenden kan niet meer.' });
		const inzending = valideerInzending(traject.definitie, request.body);
		await data.bewaarInzending(traject.id, inzending);
		return reply.code(201).send({ ok: true });
	},
);

app.get('/api/bestanden/:id', async (request, reply) => {
	if (!UUID.test(request.params.id)) return nietGevonden(reply, 'Dit bestand');
	const bestand = await data.bestandOpId(request.params.id);
	if (!bestand) return nietGevonden(reply, 'Dit bestand');
	return reply.header('Content-Type', bestand.mime).header('Cache-Control', 'public, max-age=86400').send(bestand.inhoud);
});

// ---- Beheer: inloggen ----

app.post('/api/beheer/inloggen', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
	if (!wachtwoordKlopt(request.body?.wachtwoord ?? '')) return reply.code(401).send({ fout: 'Het wachtwoord klopt niet.' });
	reply.setCookie(SESSIE_COOKIE, String(Date.now() + SESSIE_DUUR_MS), {
		signed: true,
		httpOnly: true,
		sameSite: 'strict',
		secure: config.httpsAltijd || request.protocol === 'https',
		path: '/',
		maxAge: SESSIE_DUUR_MS / 1000,
	});
	return { ok: true };
});

app.post('/api/beheer/uitloggen', async (request, reply) => {
	reply.clearCookie(SESSIE_COOKIE, { path: '/' });
	return { ok: true };
});

app.get('/api/beheer/ik', async (request) => ({ ingelogd: isIngelogd(request), organisatie: config.organisatie }));

// ---- Beheer: trajecten ----

app.register(async (beheer) => {
	beheer.addHook('preHandler', vereisBeheer);

	beheer.get('/trajecten', async () => data.lijstTrajecten());

	beheer.post('/trajecten', async (request, reply) => {
		const { titel, slug, kopie_van: kopieVan } = request.body || {};
		let definitie = legeDefinitie();
		let bron = null;
		if (kopieVan) {
			if (!UUID.test(kopieVan)) return nietGevonden(reply);
			bron = await data.trajectOpId(kopieVan);
			if (!bron) return nietGevonden(reply);
			definitie = bron.definitie;
		}
		const invoer = valideerTraject({ titel, slug, status: 'concept', definitie });
		if (await data.trajectOpSlug(invoer.slug)) return reply.code(409).send({ fout: 'Dit webadres is al in gebruik bij een ander traject.' });
		let traject = await data.maakTraject(invoer);
		if (bron) {
			// Kaartlagen en beelden horen bij het oorspronkelijke traject: de kopie krijgt eigen exemplaren.
			const tabel = await data.kopieerBestanden(bestandIds(invoer.definitie), traject.id);
			traject = await data.wijzigTraject(traject.id, { ...invoer, definitie: vervangBestandIds(invoer.definitie, tabel) });
		}
		return reply.code(201).send(traject);
	});

	beheer.register(async (metTraject) => {
		metTraject.addHook('preHandler', trajectVanVerzoek);

		metTraject.get('/trajecten/:id', async (request) => request.traject);

		metTraject.put('/trajecten/:id', async (request, reply) => {
			const invoer = valideerTraject(request.body);
			const bestaand = await data.trajectOpSlug(invoer.slug);
			if (bestaand && bestaand.id !== request.traject.id) return reply.code(409).send({ fout: 'Dit webadres is al in gebruik bij een ander traject.' });
			const traject = await data.wijzigTraject(request.traject.id, invoer);
			await data.ruimBestandenOp(traject.id, traject.definitie);
			return traject;
		});

		metTraject.delete('/trajecten/:id', async (request) => {
			await data.verwijderTraject(request.traject.id);
			return { ok: true };
		});

		metTraject.post('/trajecten/:id/bestanden', async (request, reply) => {
			const deel = await request.file();
			if (!deel) throw new Invoerfout('Er is geen bestand meegestuurd.');
			const inhoud = await deel.toBuffer();
			const naam = (deel.filename || 'bestand').slice(0, 120);
			let mime = null;
			if (inhoud.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mime = 'image/png';
			else if (inhoud[0] === 0xff && inhoud[1] === 0xd8 && inhoud[2] === 0xff) mime = 'image/jpeg';
			else if (inhoud.subarray(0, 4).toString('ascii') === 'RIFF' && inhoud.subarray(8, 12).toString('ascii') === 'WEBP') mime = 'image/webp';
			else {
				try {
					const json = JSON.parse(inhoud.toString('utf8'));
					if (json?.type === 'FeatureCollection' && Array.isArray(json.features)) mime = 'application/geo+json';
				} catch {
					// Geen JSON: valt hieronder af.
				}
			}
			if (!mime) throw new Invoerfout('Dit bestand is geen PNG, JPG, WebP of GeoJSON.');
			return reply.code(201).send(await data.bewaarBestand(request.traject.id, { naam, mime, inhoud }));
		});

		metTraject.get('/trajecten/:id/inzendingen', async (request) => {
			const { inzendingen, bijdragen, reacties } = await data.trajectGegevens(request.traject, { persoonsgegevens: true });
			const telling = (lijst) => lijst.reduce((m, x) => m.set(x.inzending_id, (m.get(x.inzending_id) || 0) + 1), new Map());
			const perBijdrage = telling(bijdragen);
			const perReactie = telling(reacties);
			return inzendingen.map((i) => ({ ...i, bijdragen: perBijdrage.get(i.id) || 0, reacties: perReactie.get(i.id) || 0 }));
		});

		metTraject.delete('/trajecten/:id/inzendingen/:inzendingId', async (request, reply) => {
			if (!UUID.test(request.params.inzendingId)) return nietGevonden(reply, 'Deze inzending');
			const weg = await data.verwijderInzending(request.traject.id, request.params.inzendingId);
			return weg ? { ok: true } : nietGevonden(reply, 'Deze inzending');
		});

		metTraject.get('/trajecten/:id/rapport', async (request, reply) => {
			const gegevens = await data.trajectGegevens(request.traject);
			const beelden = await data.beeldenAlsDataAdres(bestandIds(request.traject.definitie));
			const html = await bouwRapport(rapportGegevens(gegevens, config.organisatie, new Date(), beelden));
			reply.rapport = true;
			reply.header('Content-Type', 'text/html; charset=utf-8').header('Cache-Control', 'no-store');
			if (request.query.download) reply.header('Content-Disposition', `attachment; filename="resultaten-${request.traject.slug}.html"`);
			return reply.send(html);
		});

		metTraject.get('/trajecten/:id/export/:soort', async (request, reply) => {
			const { soort } = request.params;
			const slug = request.traject.slug;
			const bijlage = (naam, type) => reply.header('Content-Type', type).header('Content-Disposition', `attachment; filename="${naam}"`).header('Cache-Control', 'no-store');
			if (soort === 'geopackage') {
				bijlage(`${slug}.gpkg`, 'application/geopackage+sqlite3');
				return reply.send(await bouwGeopackage(await data.trajectGegevens(request.traject)));
			}
			if (soort === 'geojson') {
				bijlage(`${slug}-bijdragen.geojson`, 'application/geo+json');
				return reply.send(JSON.stringify(bijdragenGeojson(await data.trajectGegevens(request.traject))));
			}
			if (soort === 'bijdragen.csv') {
				bijlage(`${slug}-bijdragen.csv`, 'text/csv; charset=utf-8');
				return reply.send(bijdragenCsv(await data.trajectGegevens(request.traject)));
			}
			if (soort === 'inzendingen.csv') {
				bijlage(`${slug}-inzendingen.csv`, 'text/csv; charset=utf-8');
				return reply.send(inzendingenCsv(await data.trajectGegevens(request.traject, { persoonsgegevens: true })));
			}
			return nietGevonden(reply, 'Deze export');
		});
	});

	beheer.get('/qgis', async () => {
		const adres = new URL(config.databaseUrl);
		return {
			ingesteld: database.qgisLezer,
			database: adres.pathname.slice(1),
			poort: Number(adres.port || 5432),
			gebruiker: 'qgis_lezer',
			schema: 'qgis',
			lagen: ['bijdragen_punten', 'bijdragen_lijnen', 'bijdragen_vlakken', 'planonderdelen_punten', 'planonderdelen_lijnen', 'planonderdelen_vlakken'],
		};
	});
}, { prefix: '/api/beheer' });

// ---- De website ----

// Korte link voor deelnemers: /p/naam-van-traject verwijst door naar de pagina in de website.
// De verwijzing is relatief, zodat ze ook klopt als de site onder een eigen pad achter een proxy staat.
app.get('/p/:slug', async (request, reply) => {
	if (!/^[a-z0-9-]{3,60}$/.test(request.params.slug)) return reply.code(404).send({ fout: 'Niet gevonden.' });
	return reply.redirect(`../#/p/${request.params.slug}`);
});

const webmap = fileURLToPath(new URL('../dist/web', import.meta.url));
if (existsSync(webmap)) {
	await app.register(fastifyStatic, { root: webmap, maxAge: '1h' });
	app.setNotFoundHandler((request, reply) => {
		if (request.method !== 'GET' || request.url.startsWith('/api/')) return reply.code(404).send({ fout: 'Niet gevonden.' });
		return reply.code(404).send({ fout: 'Niet gevonden.' });
	});
} else {
	app.setNotFoundHandler((request, reply) => reply.code(404).send({ fout: 'Niet gevonden. De website is nog niet gebouwd: draai eerst "npm run build".' }));
}

// ---- Starten ----

if (config.voorbeeld && (await data.lijstTrajecten()).length === 0) {
	await data.maakVoorbeeldAan();
	app.log.info('Voorbeeldtraject aangemaakt.');
}

async function bewaartermijnen() {
	try {
		const aantal = await data.anonimiseerVerlopenTrajecten();
		if (aantal) app.log.info(`Persoonsgegevens gewist van ${aantal} gesloten traject(en).`);
	} catch (fout) {
		app.log.error(fout);
	}
}
await bewaartermijnen();
setInterval(bewaartermijnen, 24 * 60 * 60 * 1000).unref();

await app.listen({ port: config.poort, host: config.host });
console.log(`Dialoogkaart draait op poort ${config.poort}.`);
