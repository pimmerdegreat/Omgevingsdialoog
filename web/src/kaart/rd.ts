// Omrekenen van RD New (EPSG:28992) naar graden (WGS84). Alleen nodig in beheer, bij het inlezen van bestanden uit QGIS.
import proj4 from 'proj4';
import type { Coordinaat } from '../types';

// De datumverschuiving staat in meters, boogseconden en ppm, zoals proj4 die verwacht.
const RD_NEW =
	'+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957388243134,0.343987817378283,-1.87740163998045,4.0725 +units=m +no_defs';

export function rdNaarWgs(x: number, y: number): Coordinaat {
	const [lng, lat] = proj4(RD_NEW, 'WGS84', [x, y]);
	return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}
