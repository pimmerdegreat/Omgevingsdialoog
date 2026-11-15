// Vaste keuzelijsten die server, website en rapport delen.

export const LEEFTIJDEN = [
	{ id: 'tm17', label: 'Jonger dan 18' },
	{ id: '18-29', label: '18 tot en met 29' },
	{ id: '30-44', label: '30 tot en met 44' },
	{ id: '45-64', label: '45 tot en met 64' },
	{ id: '65plus', label: '65 of ouder' },
];

export const OORDELEN = [
	{ id: 'goed', label: 'Goed idee', kleur: '#7e9d45' },
	{ id: 'twijfel', label: 'Twijfel', kleur: '#d59800' },
	{ id: 'niet', label: 'Geen goed idee', kleur: '#b4472f' },
];

export const VORMEN = {
	punt: { geometrie: 'Point', label: 'punt', actie: 'Zet een punt' },
	lijn: { geometrie: 'LineString', label: 'lijn', actie: 'Teken een lijn' },
	vlak: { geometrie: 'Polygon', label: 'vlak', actie: 'Teken een vlak' },
};

// Kleuren voor categorieën: de drie huiskleuren van Buro SRO, aangevuld met tinten die ernaast leesbaar blijven.
export const CATEGORIEKLEUREN = ['#224362', '#d59800', '#7e9d45', '#b4472f', '#2e8a86', '#7b4f7d', '#5f6b76', '#c56a1b'];

export const STATUSSEN = [
	{ id: 'concept', label: 'Concept', uitleg: 'Alleen jij ziet het traject.' },
	{ id: 'open', label: 'Open', uitleg: 'Deelnemers kunnen meedoen via de link.' },
	{ id: 'gesloten', label: 'Gesloten', uitleg: 'Meedoen kan niet meer. De resultaten blijven staan.' },
];
