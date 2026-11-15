// Test voor de omrekening van RD New naar graden, zoals beheer die gebruikt bij bestanden uit QGIS.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rdNaarWgs } from '../../web/src/kaart/rd.ts';

// Referentiepunten: de oorsprong van het RD-stelsel in Amersfoort en vier plekken verspreid over Nederland,
// vergeleken met de omrekening door PostGIS (EPSG:28992 naar EPSG:4326).
const PUNTEN = [
	[155000, 463000, 5.3872035, 52.1551723],
	[136900, 453300, 5.1232324, 52.0676934],
	[121687, 487484, 4.8980099, 52.3742182],
	[233883, 582065, 6.5681957, 53.2193796],
	[176331, 317462, 5.6900598, 50.8466007],
];

test('RD New naar graden klopt tot op een meter', () => {
	for (const [x, y, lengte, breedte] of PUNTEN) {
		const [lng, lat] = rdNaarWgs(x, y);
		// 0,00001 graad is ongeveer een meter.
		assert.ok(Math.abs(lng - lengte) < 0.00001, `lengtegraad bij ${x}, ${y}: ${lng}`);
		assert.ok(Math.abs(lat - breedte) < 0.00001, `breedtegraad bij ${x}, ${y}: ${lat}`);
	}
});
