import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 8 });

export function query(tekst, waarden) {
	return pool.query(tekst, waarden);
}

/** Voert de functie uit binnen één transactie en draait alles terug bij een fout. */
export async function transactie(fn) {
	const client = await pool.connect();
	try {
		await client.query('begin');
		const uitkomst = await fn(client);
		await client.query('commit');
		return uitkomst;
	} catch (fout) {
		await client.query('rollback');
		throw fout;
	} finally {
		client.release();
	}
}

async function wachtOpDatabase(pogingen = 30) {
	for (let i = 1; ; i++) {
		try {
			await pool.query('select 1');
			return;
		} catch (fout) {
			if (i >= pogingen) throw fout;
			await new Promise((r) => setTimeout(r, 1000));
		}
	}
}

/**
 * Maakt tabellen en QGIS-lagen aan. Bestaat de alleen-lezen gebruiker qgis_lezer (zie server/installatie.sql),
 * dan krijgt die leesrecht op de QGIS-lagen.
 */
export async function initDatabase() {
	await wachtOpDatabase();
	const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
	await pool.query(schema);
	const { rowCount } = await pool.query("select 1 from pg_roles where rolname = 'qgis_lezer'");
	if (rowCount) {
		await pool.query('grant usage on schema qgis to qgis_lezer');
		await pool.query('grant select on all tables in schema qgis to qgis_lezer');
	}
	return { qgisLezer: rowCount > 0 };
}
