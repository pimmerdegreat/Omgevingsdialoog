// Export als GeoPackage in RD New (EPSG:28992), met kaartstijl per categorie zodat QGIS de lagen direct gekleurd toont.
// Een GeoPackage is een SQLite-bestand met vaste tabellen. We schrijven het zelf, zonder GDAL en zonder database:
// de omrekening naar RD New gebeurt met proj4. Zo werkt dezelfde export op de server en in de demo zonder server.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RD_WKT, wgsNaarRd } from '../../gedeeld/rd.js';
import { categorieIndex, leeftijdLabel } from './geojson.js';

const SRS = 28992;

const SOORTEN = [
	{ vorm: 'punten', type: 'POINT', geojson: 'Point', categorievorm: 'punt' },
	{ vorm: 'lijnen', type: 'LINESTRING', geojson: 'LineString', categorievorm: 'lijn' },
	{ vorm: 'vlakken', type: 'POLYGON', geojson: 'Polygon', categorievorm: 'vlak' },
];

// ---- Geometrie: van GeoJSON in graden naar WKB in RD New ----

function naarRd(geometrie) {
	const omreken = (c) => wgsNaarRd(c[0], c[1]);
	if (geometrie.type === 'Point') return { type: 'Point', coordinates: omreken(geometrie.coordinates) };
	if (geometrie.type === 'LineString') return { type: 'LineString', coordinates: geometrie.coordinates.map(omreken) };
	return { type: 'Polygon', coordinates: geometrie.coordinates.map((ring) => ring.map(omreken)) };
}

function alleCoordinaten(g) {
	if (g.type === 'Point') return [g.coordinates];
	if (g.type === 'LineString') return g.coordinates;
	return g.coordinates.flat();
}

/** Well-known binary, little-endian, alleen x en y. */
function wkb(g) {
	const delen = [];
	const kop = Buffer.alloc(5);
	kop[0] = 1;
	kop.writeUInt32LE({ Point: 1, LineString: 2, Polygon: 3 }[g.type], 1);
	delen.push(kop);
	const punten = (lijst) => {
		const b = Buffer.alloc(4 + lijst.length * 16);
		b.writeUInt32LE(lijst.length, 0);
		lijst.forEach(([x, y], i) => {
			b.writeDoubleLE(x, 4 + i * 16);
			b.writeDoubleLE(y, 12 + i * 16);
		});
		return b;
	};
	if (g.type === 'Point') {
		const b = Buffer.alloc(16);
		b.writeDoubleLE(g.coordinates[0], 0);
		b.writeDoubleLE(g.coordinates[1], 8);
		delen.push(b);
	} else if (g.type === 'LineString') {
		delen.push(punten(g.coordinates));
	} else {
		const aantal = Buffer.alloc(4);
		aantal.writeUInt32LE(g.coordinates.length, 0);
		delen.push(aantal, ...g.coordinates.map(punten));
	}
	return Buffer.concat(delen);
}

/** Geometrie in het formaat van GeoPackage: een kop met de omhullende, daarna de WKB. */
function gpkgGeometrie(geometrieInGraden) {
	const g = naarRd(geometrieInGraden);
	const c = alleCoordinaten(g);
	const omhullende = {
		minx: Math.min(...c.map((p) => p[0])),
		maxx: Math.max(...c.map((p) => p[0])),
		miny: Math.min(...c.map((p) => p[1])),
		maxy: Math.max(...c.map((p) => p[1])),
	};
	const kop = Buffer.alloc(40);
	kop.write('GP', 0, 'ascii');
	kop[2] = 0; // versie
	kop[3] = 0b00000011; // little-endian, omhullende met x en y
	kop.writeInt32LE(SRS, 4);
	kop.writeDoubleLE(omhullende.minx, 8);
	kop.writeDoubleLE(omhullende.maxx, 16);
	kop.writeDoubleLE(omhullende.miny, 24);
	kop.writeDoubleLE(omhullende.maxy, 32);
	return { blob: Buffer.concat([kop, wkb(g)]), omhullende };
}

// ---- Kaartstijl voor QGIS ----

function rgba(hex, alfa = 255) {
	const n = parseInt(hex.slice(1), 16);
	return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa}`;
}

function xml(tekst) {
	return String(tekst).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function optie(naam, waarde) {
	return `<Option type="QString" name="${naam}" value="${xml(waarde)}"/>`;
}

function symbool(vorm, naam, kleur) {
	if (vorm === 'punten') {
		return `<symbol type="marker" name="${naam}" alpha="1" clip_to_extent="1" force_rhr="0"><layer class="SimpleMarker" enabled="1" locked="0" pass="0"><Option type="Map">${optie('color', rgba(kleur))}${optie('name', 'circle')}${optie('outline_color', '255,255,255,255')}${optie('outline_width', '0.5')}${optie('size', '3.4')}</Option></layer></symbol>`;
	}
	if (vorm === 'lijnen') {
		return `<symbol type="line" name="${naam}" alpha="0.85" clip_to_extent="1" force_rhr="0"><layer class="SimpleLine" enabled="1" locked="0" pass="0"><Option type="Map">${optie('line_color', rgba(kleur))}${optie('line_width', '0.9')}${optie('capstyle', 'round')}${optie('joinstyle', 'round')}</Option></layer></symbol>`;
	}
	return `<symbol type="fill" name="${naam}" alpha="1" clip_to_extent="1" force_rhr="0"><layer class="SimpleFill" enabled="1" locked="0" pass="0"><Option type="Map">${optie('color', rgba(kleur, 70))}${optie('style', 'solid')}${optie('outline_color', rgba(kleur))}${optie('outline_width', '0.5')}</Option></layer></symbol>`;
}

/** QGIS-stijl (QML) die de laag indeelt op de kolom categorie, in de kleuren van het traject. */
function categorieStijl(vorm, categorieen) {
	const regels = categorieen.map((c, i) => `<category value="${xml(c.label)}" label="${xml(c.label)}" symbol="${i}" render="true"/>`).join('');
	const symbolen = categorieen.map((c, i) => symbool(vorm, String(i), c.kleur)).join('');
	return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'><qgis version="3.34.0" styleCategories="Symbology"><renderer-v2 type="categorizedSymbol" attr="categorie" symbollevels="0" enableorderby="0" forceraster="0" referencescale="-1"><categories>${regels}</categories><symbols>${symbolen}</symbols></renderer-v2><blendMode>0</blendMode><featureBlendMode>0</featureBlendMode></qgis>`;
}

function kolomnaam(tekst, bezet) {
	let naam =
		tekst
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 48) || 'vraag';
	if (/^[0-9]/.test(naam)) naam = `v_${naam}`;
	let uniek = naam;
	for (let i = 2; bezet.has(uniek); i++) uniek = `${naam}_${i}`;
	bezet.add(uniek);
	return uniek;
}

/**
 * Bouwt het GeoPackage voor één traject en geeft de inhoud als Buffer terug.
 * Verwacht de gegevens zoals trajectGegevens ze levert, zonder persoonsgegevens: e-mailadressen gaan er nooit in.
 */
export async function bouwGeopackage({ traject, inzendingen, bijdragen, reacties }) {
	const map = await mkdtemp(join(tmpdir(), 'dialoogkaart-'));
	const pad = join(map, 'export.gpkg');
	const db = new DatabaseSync(pad);
	try {
		db.exec(`
			pragma application_id = 1196444487;
			pragma user_version = 10300;
			create table gpkg_spatial_ref_sys (
				srs_name text not null, srs_id integer primary key, organization text not null,
				organization_coordsys_id integer not null, definition text not null, description text);
			create table gpkg_contents (
				table_name text not null primary key, data_type text not null, identifier text unique, description text default '',
				last_change datetime not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
				min_x double, min_y double, max_x double, max_y double, srs_id integer,
				constraint fk_gc_r_srs_id foreign key (srs_id) references gpkg_spatial_ref_sys(srs_id));
			create table gpkg_geometry_columns (
				table_name text not null, column_name text not null, geometry_type_name text not null,
				srs_id integer not null, z tinyint not null, m tinyint not null,
				constraint pk_geom_cols primary key (table_name, column_name),
				constraint fk_gc_tn foreign key (table_name) references gpkg_contents(table_name),
				constraint fk_gc_srs foreign key (srs_id) references gpkg_spatial_ref_sys(srs_id));
			create table layer_styles (
				id integer primary key autoincrement, f_table_catalog text(256), f_table_schema text(256), f_table_name text(256),
				f_geometry_column text(256), styleName text(30), styleQML text, styleSLD text, useAsDefault boolean,
				description text, owner text(30), ui text(30), update_time datetime default (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
		`);
		const srs = db.prepare('insert into gpkg_spatial_ref_sys values (?, ?, ?, ?, ?, ?)');
		srs.run('Undefined Cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined Cartesian coordinate reference system');
		srs.run('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system');
		srs.run(
			'WGS 84 geodetic',
			4326,
			'EPSG',
			4326,
			'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]',
			'longitude/latitude coordinates in decimal degrees on the WGS 84 spheroid',
		);
		srs.run('Amersfoort / RD New', SRS, 'EPSG', SRS, RD_WKT, 'Rijksdriehoeksstelsel');

		const inhoud = db.prepare('insert into gpkg_contents (table_name, data_type, identifier, description, min_x, min_y, max_x, max_y, srs_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)');
		const geomKolom = db.prepare('insert into gpkg_geometry_columns values (?, ?, ?, ?, 0, 0)');
		const stijl = db.prepare("insert into layer_styles (f_table_catalog, f_table_schema, f_table_name, f_geometry_column, styleName, styleQML, styleSLD, useAsDefault, description) values ('', '', ?, 'geom', ?, ?, '', 1, ?)");
		inhoud.run('layer_styles', 'attributes', 'layer_styles', 'Kaartstijlen voor QGIS', null, null, null, null, null);

		const totaleOmhullende = (lijst) => [
			Math.min(...lijst.map((o) => o.minx)),
			Math.min(...lijst.map((o) => o.miny)),
			Math.max(...lijst.map((o) => o.maxx)),
			Math.max(...lijst.map((o) => o.maxy)),
		];
		const def = traject.definitie;
		const categorieen = categorieIndex(def);
		const perInzending = new Map(inzendingen.map((i) => [i.id, i]));

		db.exec('begin');

		// Bijdragen van deelnemers, één laag per vorm.
		for (const soort of SOORTEN) {
			const rijen = bijdragen.filter((b) => b.geometrie.type === soort.geojson);
			if (!rijen.length) continue;
			const tabel = `bijdragen_${soort.vorm}`;
			db.exec(`create table ${tabel} (fid integer primary key autoincrement, geom ${soort.type}, id text, categorie text, toelichting text, ingediend datetime, leeftijd text, postcode4 text, inzending_id text)`);
			const voegToe = db.prepare(`insert into ${tabel} (geom, id, categorie, toelichting, ingediend, leeftijd, postcode4, inzending_id) values (?, ?, ?, ?, ?, ?, ?, ?)`);
			const omhullenden = [];
			for (const b of rijen) {
				const { blob, omhullende } = gpkgGeometrie(b.geometrie);
				omhullenden.push(omhullende);
				const i = perInzending.get(b.inzending_id);
				const label = categorieen.get(`${b.stap_id}/${b.categorie_id}`)?.label || b.categorie_id;
				voegToe.run(blob, b.id, label, b.toelichting || '', i?.ingediend || null, leeftijdLabel(i?.leeftijd), i?.postcode ? i.postcode.slice(0, 4) : null, b.inzending_id);
			}
			inhoud.run(tabel, 'features', tabel, `Bijdragen van deelnemers (${soort.vorm})`, ...totaleOmhullende(omhullenden), SRS);
			geomKolom.run(tabel, 'geom', soort.type, SRS);
			const vanDezeVorm = def.stappen.filter((s) => s.type === 'tekenen').flatMap((s) => s.categorieen).filter((c) => c.vorm === soort.categorievorm);
			if (vanDezeVorm.length) stijl.run(tabel, 'Dialoogkaart', categorieStijl(soort.vorm, vanDezeVorm), 'Kleur per categorie');
		}

		// Planonderdelen met de telling van de oordelen.
		const onderdelen = def.stappen
			.filter((s) => s.type === 'reageren')
			.flatMap((s) =>
				s.onderdelen.map((o) => {
					const eigen = reacties.filter((r) => r.stap_id === s.id && r.onderdeel_id === o.id);
					const tel = (oordeel) => eigen.filter((r) => r.oordeel === oordeel).length;
					return { id: `${traject.slug}:${s.id}:${o.id}`, titel: o.titel, omschrijving: o.tekst || '', goed: tel('goed'), twijfel: tel('twijfel'), niet: tel('niet'), geometrie: o.geometrie };
				}),
			);
		for (const soort of SOORTEN) {
			const rijen = onderdelen.filter((o) => o.geometrie.type === soort.geojson);
			if (!rijen.length) continue;
			const tabel = `planonderdelen_${soort.vorm}`;
			db.exec(`create table ${tabel} (fid integer primary key autoincrement, geom ${soort.type}, id text, titel text, omschrijving text, goed integer, twijfel integer, niet integer)`);
			const voegToe = db.prepare(`insert into ${tabel} (geom, id, titel, omschrijving, goed, twijfel, niet) values (?, ?, ?, ?, ?, ?, ?)`);
			const omhullenden = [];
			for (const o of rijen) {
				const { blob, omhullende } = gpkgGeometrie(o.geometrie);
				omhullenden.push(omhullende);
				voegToe.run(blob, o.id, o.titel, o.omschrijving, o.goed, o.twijfel, o.niet);
			}
			inhoud.run(tabel, 'features', tabel, `Planonderdelen met oordelen (${soort.vorm})`, ...totaleOmhullende(omhullenden), SRS);
			geomKolom.run(tabel, 'geom', soort.type, SRS);
		}

		// Antwoorden per deelnemer als tabel zonder geometrie, te koppelen via inzending_id. Zonder e-mailadres.
		const vragen = def.stappen.filter((s) => s.type === 'vragen').flatMap((s) => s.vragen);
		const bezet = new Set(['fid', 'inzending_id', 'ingediend', 'leeftijd', 'postcode4']);
		const kolommen = vragen.map((v) => ({ vraag: v, naam: kolomnaam(v.label, bezet), soort: ['schaal', 'getal'].includes(v.type) ? 'real' : 'text' }));
		if (inzendingen.length) {
			db.exec(`create table inzendingen (fid integer primary key autoincrement, inzending_id text, ingediend datetime, leeftijd text, postcode4 text${kolommen.map((k) => `, "${k.naam}" ${k.soort}`).join('')})`);
			inhoud.run('inzendingen', 'attributes', 'inzendingen', 'Antwoorden per deelnemer', null, null, null, null, null);
			const voegToe = db.prepare(`insert into inzendingen (inzending_id, ingediend, leeftijd, postcode4${kolommen.map((k) => `, "${k.naam}"`).join('')}) values (?, ?, ?, ?${kolommen.map(() => ', ?').join('')})`);
			for (const i of inzendingen) {
				const waarden = kolommen.map((k) => {
					const w = i.antwoorden?.[k.vraag.id];
					if (w === undefined || w === null) return null;
					return Array.isArray(w) ? w.join('; ') : w;
				});
				voegToe.run(i.id, i.ingediend, leeftijdLabel(i.leeftijd), i.postcode ? i.postcode.slice(0, 4) : null, ...waarden);
			}
		}

		db.exec('commit');
		db.close();
		return await readFile(pad);
	} catch (fout) {
		try {
			db.close();
		} catch {
			// De database was al gesloten.
		}
		throw fout;
	} finally {
		await rm(map, { recursive: true, force: true });
	}
}
