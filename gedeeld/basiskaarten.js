// Ondergronden die een traject kan aanbieden. Gebruikt door de server (controle), de website en het rapport.
// Alle bronnen leveren tegels in Web Mercator (EPSG:3857).

const PDOK = 'Kaartgegevens &copy; <a href="https://www.kadaster.nl">Kadaster</a>';
const PDOK_LUCHT = 'Luchtfoto &copy; <a href="https://www.beeldmateriaal.nl">Beeldmateriaal Nederland</a>';
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers';

export const BASISKAARTEN = [
	{
		id: 'brt-standaard',
		naam: 'Kaart van Nederland',
		groep: 'PDOK',
		url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: PDOK,
	},
	{
		id: 'brt-grijs',
		naam: 'Kaart in grijstinten',
		groep: 'PDOK',
		url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: PDOK,
	},
	{
		id: 'brt-pastel',
		naam: 'Kaart in pasteltinten',
		groep: 'PDOK',
		url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: PDOK,
	},
	{
		id: 'brt-water',
		naam: 'Waterkaart',
		groep: 'PDOK',
		url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/water/EPSG:3857/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: PDOK,
	},
	{
		id: 'luchtfoto',
		naam: 'Luchtfoto',
		groep: 'PDOK',
		url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
		maxZoom: 21,
		bron: PDOK_LUCHT,
	},
	{
		id: 'osm',
		naam: 'OpenStreetMap',
		groep: 'OpenStreetMap',
		url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: OSM,
	},
	{
		id: 'osm-hot',
		naam: 'OpenStreetMap Humanitair',
		groep: 'OpenStreetMap',
		url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: `${OSM}, stijl van het Humanitarian OpenStreetMap Team`,
	},
	{
		id: 'cyclosm',
		naam: 'Fietskaart (CyclOSM)',
		groep: 'OpenStreetMap',
		url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
		maxZoom: 19,
		bron: `${OSM}, stijl van <a href="https://www.cyclosm.org">CyclOSM</a>`,
	},
	{
		id: 'opentopomap',
		naam: 'Hoogtekaart (OpenTopoMap)',
		groep: 'OpenStreetMap',
		url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
		maxZoom: 17,
		bron: `${OSM}, stijl &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
	},
];

export const BASISKAART_IDS = BASISKAARTEN.map((k) => k.id);

export function basiskaart(id) {
	return BASISKAARTEN.find((k) => k.id === id) || BASISKAARTEN[0];
}
