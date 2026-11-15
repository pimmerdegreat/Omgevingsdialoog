// Lezen en schrijven van trajecten, inzendingen en bestanden.
import { readFile } from 'node:fs/promises';
import { bestandIds } from '../gedeeld/media.js';
import { query, transactie } from './db.js';
import { VOORBEELD_BEELDEN, voorbeeldGegevens, voorbeeldTraject } from './seed/voorbeeld.js';

const TRAJECT_VELDEN = 'id, slug, titel, status, definitie, voorbeeld, aangemaakt, gewijzigd, gesloten_op, geanonimiseerd_op';

export async function lijstTrajecten() {
	const { rows } = await query(
		`select t.id, t.slug, t.titel, t.status, t.voorbeeld, t.aangemaakt, t.gewijzigd,
			(select count(*) from inzending i where i.traject_id = t.id)::int as inzendingen,
			(select count(*) from bijdrage b where b.traject_id = t.id)::int as bijdragen,
			(select max(i.ingediend) from inzending i where i.traject_id = t.id) as laatste_inzending
		from traject t
		order by t.aangemaakt desc`,
	);
	return rows;
}

export async function trajectOpId(id) {
	const { rows } = await query(`select ${TRAJECT_VELDEN} from traject where id = $1`, [id]);
	return rows[0] || null;
}

export async function trajectOpSlug(slug) {
	const { rows } = await query(`select ${TRAJECT_VELDEN} from traject where slug = $1`, [slug]);
	return rows[0] || null;
}

export async function maakTraject({ slug, titel, status, definitie, voorbeeld = false }) {
	const { rows } = await query(
		`insert into traject (slug, titel, status, definitie, voorbeeld, gesloten_op)
		values ($1, $2, $3, $4, $5, case when $3 = 'gesloten' then now() end)
		returning ${TRAJECT_VELDEN}`,
		[slug, titel, status, JSON.stringify(definitie), voorbeeld],
	);
	return rows[0];
}

export async function wijzigTraject(id, { slug, titel, status, definitie }) {
	const { rows } = await query(
		`update traject set slug = $2, titel = $3, status = $4, definitie = $5, gewijzigd = now(),
			gesloten_op = case when $4 = 'gesloten' then coalesce(gesloten_op, now()) else null end
		where id = $1
		returning ${TRAJECT_VELDEN}`,
		[id, slug, titel, status, JSON.stringify(definitie)],
	);
	return rows[0] || null;
}

export async function verwijderTraject(id) {
	const { rowCount } = await query('delete from traject where id = $1', [id]);
	return rowCount > 0;
}

/** Slaat een gecontroleerde inzending met alle bijdragen en reacties in één keer op. */
export function bewaarInzending(trajectId, inzending, client) {
	const bewaar = async (c) => {
		const { rows } = await c.query(
			`insert into inzending (id, traject_id, ingediend, antwoorden, postcode, leeftijd, email, op_de_hoogte, mobiel)
			values (coalesce($1, gen_random_uuid()), $2, coalesce($3, now()), $4, $5, $6, $7, $8, $9)
			returning id`,
			[
				inzending.id || null,
				trajectId,
				inzending.ingediend || null,
				JSON.stringify(inzending.antwoorden || {}),
				inzending.postcode,
				inzending.leeftijd,
				inzending.email,
				inzending.op_de_hoogte,
				inzending.mobiel ?? null,
			],
		);
		const inzendingId = rows[0].id;
		for (const b of inzending.bijdragen || []) {
			await c.query(
				`insert into bijdrage (inzending_id, traject_id, stap_id, categorie_id, toelichting, geom)
				values ($1, $2, $3, $4, $5, st_setsrid(st_geomfromgeojson($6), 4326))`,
				[inzendingId, trajectId, b.stap_id, b.categorie_id, b.toelichting || '', JSON.stringify(b.geometrie)],
			);
		}
		for (const r of inzending.reacties || []) {
			await c.query(
				`insert into reactie (inzending_id, traject_id, stap_id, onderdeel_id, oordeel, toelichting)
				values ($1, $2, $3, $4, $5, $6)`,
				[inzendingId, trajectId, r.stap_id, r.onderdeel_id, r.oordeel, r.toelichting || ''],
			);
		}
		return inzendingId;
	};
	return client ? bewaar(client) : transactie(bewaar);
}

export async function verwijderInzending(trajectId, inzendingId) {
	const { rowCount } = await query('delete from inzending where id = $1 and traject_id = $2', [inzendingId, trajectId]);
	return rowCount > 0;
}

/**
 * Haalt alles op wat nodig is voor rapport en export.
 * Met persoonsgegevens = false blijven e-mailadres en de letters van de postcode achterwege.
 */
export async function trajectGegevens(traject, { persoonsgegevens = false } = {}) {
	const [inz, bij, rea] = await Promise.all([
		query(
			`select id, ingediend, antwoorden, postcode, leeftijd, email, op_de_hoogte, mobiel
			from inzending where traject_id = $1 order by ingediend`,
			[traject.id],
		),
		query(
			`select b.id, b.inzending_id, b.stap_id, b.categorie_id, b.toelichting, st_asgeojson(b.geom, 6)::json as geometrie
			from bijdrage b join inzending i on i.id = b.inzending_id
			where b.traject_id = $1 order by i.ingediend, b.id`,
			[traject.id],
		),
		query(
			`select r.id, r.inzending_id, r.stap_id, r.onderdeel_id, r.oordeel, r.toelichting
			from reactie r join inzending i on i.id = r.inzending_id
			where r.traject_id = $1 order by i.ingediend, r.id`,
			[traject.id],
		),
	]);
	const inzendingen = inz.rows.map((r) => ({
		...r,
		ingediend: r.ingediend.toISOString(),
		postcode: persoonsgegevens ? r.postcode : r.postcode ? r.postcode.slice(0, 4) : null,
		email: persoonsgegevens ? r.email : null,
		op_de_hoogte: persoonsgegevens ? r.op_de_hoogte : false,
	}));
	return { traject, inzendingen, bijdragen: bij.rows, reacties: rea.rows };
}

// ---- Bestanden voor kaartlagen ----

export async function bewaarBestand(trajectId, { naam, mime, inhoud }) {
	const { rows } = await query(
		'insert into bestand (traject_id, naam, mime, inhoud) values ($1, $2, $3, $4) returning id, naam, mime',
		[trajectId, naam, mime, inhoud],
	);
	return rows[0];
}

export async function bestandOpId(id) {
	const { rows } = await query('select id, traject_id, naam, mime, inhoud from bestand where id = $1', [id]);
	return rows[0] || null;
}

/** Verwijdert bestanden die niet meer in de opzet van het traject voorkomen. */
export async function ruimBestandenOp(trajectId, definitie) {
	await query('delete from bestand where traject_id = $1 and not (id = any($2::uuid[]))', [trajectId, bestandIds(definitie)]);
}

/** Kopieert bestanden naar een ander traject en geeft de tabel van oude naar nieuwe sleutel terug. */
export async function kopieerBestanden(ids, naarTrajectId) {
	const tabel = new Map();
	for (const id of ids) {
		const { rows } = await query(
			'insert into bestand (traject_id, naam, mime, inhoud) select $2, naam, mime, inhoud from bestand where id = $1 returning id',
			[id, naarTrajectId],
		);
		if (rows[0]) tabel.set(id, rows[0].id);
	}
	return tabel;
}

/** Afbeeldingen als data-adres, om ze in het losse HTML-rapport op te nemen. */
export async function beeldenAlsDataAdres(ids) {
	if (!ids.length) return {};
	const { rows } = await query("select id, mime, inhoud from bestand where id = any($1::uuid[]) and mime like 'image/%'", [ids]);
	return Object.fromEntries(rows.map((r) => [r.id, `data:${r.mime};base64,${r.inhoud.toString('base64')}`]));
}

// ---- Bewaartermijn ----

/** Wist e-mailadressen en de letters van postcodes van trajecten waarvan de bewaartermijn is verstreken. */
export async function anonimiseerVerlopenTrajecten() {
	const { rows } = await query(
		`select id from traject
		where status = 'gesloten' and gesloten_op is not null and geanonimiseerd_op is null
			and gesloten_op + make_interval(months => coalesce((definitie -> 'privacy' ->> 'bewaartermijn_maanden')::int, 12)) < now()`,
	);
	for (const { id } of rows) {
		await transactie(async (c) => {
			await c.query('update inzending set email = null, op_de_hoogte = false, postcode = left(postcode, 4) where traject_id = $1', [id]);
			await c.query('update traject set geanonimiseerd_op = now() where id = $1', [id]);
		});
	}
	return rows.length;
}

// ---- Voorbeeldtraject ----

export async function maakVoorbeeldAan() {
	const voorbeeld = voorbeeldTraject();
	if (await trajectOpSlug(voorbeeld.slug)) return null;
	const gegevens = voorbeeldGegevens();
	return transactie(async (c) => {
		const { rows } = await c.query(
			`insert into traject (slug, titel, status, definitie, voorbeeld) values ($1, $2, $3, $4, true) returning id`,
			[voorbeeld.slug, voorbeeld.titel, voorbeeld.status, JSON.stringify(voorbeeld.definitie)],
		);
		const trajectId = rows[0].id;
		// De schetsen van het voorbeeld, met vaste sleutels waar de opzet naar verwijst.
		for (const beeld of VOORBEELD_BEELDEN) {
			const inhoud = await readFile(new URL(`./seed/beelden/${beeld.bestand}`, import.meta.url));
			await c.query('insert into bestand (id, traject_id, naam, mime, inhoud) values ($1, $2, $3, $4, $5)', [beeld.id, trajectId, beeld.bestand, 'image/png', inhoud]);
		}
		for (const inzending of gegevens.inzendingen) {
			await bewaarInzending(
				trajectId,
				{
					...inzending,
					bijdragen: gegevens.bijdragen.filter((b) => b.inzending_id === inzending.id),
					reacties: gegevens.reacties.filter((r) => r.inzending_id === inzending.id),
				},
				c,
			);
		}
		return trajectId;
	});
}
