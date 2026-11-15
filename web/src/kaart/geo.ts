// Hulpfuncties voor geometrie: zwaartepunt en het inlezen van GeoJSON uit QGIS.
import type { Coordinaat, Geometrie } from '../types';

const rond = (n: number) => Math.round(n * 1e6) / 1e6;

export function punten(g: Geometrie): Coordinaat[] {
	if (g.type === 'Point') return [g.coordinates];
	if (g.type === 'LineString') return g.coordinates;
	return g.coordinates[0];
}

/** Midden van een geometrie als [breedtegraad, lengtegraad], de volgorde die Leaflet gebruikt. */
export function midden(g: Geometrie): [number, number] {
	const p = punten(g);
	const som = p.reduce((s, c) => [s[0] + c[0], s[1] + c[1]], [0, 0]);
	return [som[1] / p.length, som[0] / p.length];
}

type Ruw = { type?: string; coordinates?: unknown; geometries?: unknown[] };

/**
 * Haalt punten, lijnen en vlakken uit een GeoJSON-bestand. Samengestelde vormen worden gesplitst,
 * hoogtes vervallen en coördinaten in RD New worden omgerekend naar graden.
 */
export function leesGeojson(
	tekst: string,
	rdNaarWgs: (x: number, y: number) => Coordinaat,
): { geometrie: Geometrie; eigenschappen: Record<string, unknown> }[] {
	const json = JSON.parse(tekst);
	const features: { geometry?: Ruw | null; properties?: Record<string, unknown> | null }[] =
		json.type === 'FeatureCollection' ? json.features : json.type === 'Feature' ? [json] : [{ geometry: json, properties: {} }];

	// RD-coördinaten zijn meters (tienduizenden tot honderdduizenden), graden blijven onder de 180.
	let isRd = false;
	const eerste = JSON.stringify(features[0]?.geometry?.coordinates ?? '').match(/-?\d+(\.\d+)?/);
	if (eerste && Math.abs(Number(eerste[0])) > 180) isRd = true;

	const coord = (c: unknown): Coordinaat => {
		const [x, y] = c as number[];
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Ongeldige coördinaat in het bestand.');
		return isRd ? rdNaarWgs(x, y) : [rond(x), rond(y)];
	};

	const uit: { geometrie: Geometrie; eigenschappen: Record<string, unknown> }[] = [];
	const voegToe = (g: Ruw | null | undefined, eigenschappen: Record<string, unknown>) => {
		if (!g || !g.type) return;
		const c = g.coordinates as unknown[];
		switch (g.type) {
			case 'Point':
				uit.push({ geometrie: { type: 'Point', coordinates: coord(c) }, eigenschappen });
				break;
			case 'LineString':
				uit.push({ geometrie: { type: 'LineString', coordinates: c.map(coord) }, eigenschappen });
				break;
			case 'Polygon':
				uit.push({ geometrie: { type: 'Polygon', coordinates: (c as unknown[][]).map((ring) => ring.map(coord)) }, eigenschappen });
				break;
			case 'MultiPoint':
				c.forEach((deel) => voegToe({ type: 'Point', coordinates: deel }, eigenschappen));
				break;
			case 'MultiLineString':
				c.forEach((deel) => voegToe({ type: 'LineString', coordinates: deel }, eigenschappen));
				break;
			case 'MultiPolygon':
				c.forEach((deel) => voegToe({ type: 'Polygon', coordinates: deel }, eigenschappen));
				break;
			case 'GeometryCollection':
				(g.geometries || []).forEach((deel) => voegToe(deel as Ruw, eigenschappen));
				break;
		}
	};
	for (const f of features) voegToe(f.geometry, f.properties || {});
	return uit;
}

/** Zoekt in de eigenschappen van een GeoJSON-object naar een bruikbare naam. */
export function naamUit(eigenschappen: Record<string, unknown>): string {
	for (const sleutel of ['naam', 'titel', 'name', 'title', 'label', 'omschrijving']) {
		const gevonden = Object.keys(eigenschappen).find((k) => k.toLowerCase() === sleutel);
		if (gevonden && typeof eigenschappen[gevonden] === 'string' && eigenschappen[gevonden]) return String(eigenschappen[gevonden]).slice(0, 120);
	}
	return '';
}
