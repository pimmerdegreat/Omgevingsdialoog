// Omrekenen tussen graden (WGS84) en RD New (EPSG:28992), het Nederlandse stelsel dat QGIS gebruikt.
// Gedeeld door beheer (bestanden uit QGIS inlezen) en de server (GeoPackage voor QGIS maken).
import proj4 from 'proj4';

// De datumverschuiving staat in meters, boogseconden en ppm, zoals proj4 die verwacht.
export const RD_NEW =
	'+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957388243134,0.343987817378283,-1.87740163998045,4.0725 +units=m +no_defs';

// De beschrijving van RD New zoals PostGIS en QGIS die kennen; gaat mee in het GeoPackage.
export const RD_WKT =
	'PROJCS["Amersfoort / RD New",GEOGCS["Amersfoort",DATUM["Amersfoort",SPHEROID["Bessel 1841",6377397.155,299.1528128,AUTHORITY["EPSG","7004"]],TOWGS84[565.2369,50.0087,465.658,-0.406857,0.350733,-1.87035,4.0812],AUTHORITY["EPSG","6289"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4289"]],PROJECTION["Oblique_Stereographic"],PARAMETER["latitude_of_origin",52.15616055555555],PARAMETER["central_meridian",5.38763888888889],PARAMETER["scale_factor",0.9999079],PARAMETER["false_easting",155000],PARAMETER["false_northing",463000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["X",EAST],AXIS["Y",NORTH],AUTHORITY["EPSG","28992"]]';

const naarRd = proj4('WGS84', RD_NEW);

/** Van RD New (meters) naar graden: [lengtegraad, breedtegraad], afgerond op zes decimalen (ongeveer 10 cm). */
export function rdNaarWgs(x, y) {
	const [lng, lat] = naarRd.inverse([x, y]);
	return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}

/** Van graden naar RD New: [x, y] in meters, afgerond op de millimeter. */
export function wgsNaarRd(lng, lat) {
	const [x, y] = naarRd.forward([lng, lat]);
	return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
}
