// De opzet van een traject, zoals de server die bewaart en controleert (zie server/validatie.js).

export type Vorm = 'punt' | 'lijn' | 'vlak';
export type Coordinaat = [number, number];

export type Geometrie =
	| { type: 'Point'; coordinates: Coordinaat }
	| { type: 'LineString'; coordinates: Coordinaat[] }
	| { type: 'Polygon'; coordinates: Coordinaat[][] };

export interface Categorie {
	id: string;
	label: string;
	kleur: string;
	vorm: Vorm;
	uitleg: string;
}

export interface Onderdeel {
	id: string;
	titel: string;
	tekst: string;
	kleur: string;
	geometrie: Geometrie;
}

/** Een afbeelding of YouTube-video bovenaan een stap. */
export type Media = { type: 'afbeelding'; bestand_id: string; bijschrift: string } | { type: 'video'; youtube: string; bijschrift: string };

export type Vraagtype = 'keuze' | 'meerkeuze' | 'schaal' | 'tekst' | 'getal';

export interface Vraag {
	id: string;
	type: Vraagtype;
	label: string;
	verplicht: boolean;
	opties: string[];
	min: number;
	max: number;
	minLabel: string;
	maxLabel: string;
	/** Afbeelding per antwoordoptie: optietekst naar bestandssleutel. */
	optieBeelden?: Record<string, string>;
	/** Beelden of een video die de vraag ondersteunen. */
	media?: Media[];
}

interface StapBasis {
	id: string;
	titel: string;
	tekst: string;
	media?: Media[];
}
export interface TekenStap extends StapBasis {
	type: 'tekenen';
	categorieen: Categorie[];
}
export interface ReageerStap extends StapBasis {
	type: 'reageren';
	onderdelen: Onderdeel[];
}
export interface VragenStap extends StapBasis {
	type: 'vragen';
	vragen: Vraag[];
}
export type Stap = TekenStap | ReageerStap | VragenStap;

export interface Kaartlaag {
	id: string;
	titel: string;
	type: 'geojson' | 'afbeelding';
	bestand_id: string;
	kleur: string;
	dekking: number;
	grenzen?: [[number, number], [number, number]];
}

export interface KaartOpzet {
	centrum: Coordinaat;
	zoom: number;
	basiskaarten: string[];
	standaard: string;
	lagen: Kaartlaag[];
}

export interface Definitie {
	intro: { kop: string; tekst: string };
	kaart: KaartOpzet;
	stappen: Stap[];
	over_jou: { postcode: boolean; leeftijd: boolean; email: boolean };
	privacy: { tekst: string; bewaartermijn_maanden: number };
	bedankt: { kop: string; tekst: string };
}

export type Status = 'concept' | 'open' | 'gesloten';

export interface Organisatie {
	naam: string;
	website: string;
	email: string;
}

export interface PubliekTraject {
	slug: string;
	titel: string;
	status: Status;
	voorbeeld: boolean;
	definitie: Definitie;
	organisatie: Organisatie;
}

export interface Traject {
	id: string;
	slug: string;
	titel: string;
	status: Status;
	voorbeeld: boolean;
	definitie: Definitie;
	aangemaakt: string;
	gewijzigd: string;
}

export interface TrajectRegel {
	id: string;
	slug: string;
	titel: string;
	status: Status;
	voorbeeld: boolean;
	aangemaakt: string;
	inzendingen: number;
	bijdragen: number;
	laatste_inzending: string | null;
}

export interface InzendingRegel {
	id: string;
	ingediend: string;
	postcode: string | null;
	leeftijd: string | null;
	email: string | null;
	op_de_hoogte: boolean;
	bijdragen: number;
	reacties: number;
}

export type Oordeel = 'goed' | 'twijfel' | 'niet';

export interface Bijdrage {
	lokaal: string;
	stap_id: string;
	categorie_id: string;
	toelichting: string;
	geometrie: Geometrie;
}

export interface Reactie {
	oordeel: Oordeel;
	toelichting: string;
}

export interface Inzending {
	bijdragen: Omit<Bijdrage, 'lokaal'>[];
	reacties: { stap_id: string; onderdeel_id: string; oordeel: Oordeel; toelichting: string }[];
	antwoorden: Record<string, unknown>;
	postcode: string;
	leeftijd: string;
	email: string;
	op_de_hoogte: boolean;
	akkoord: boolean;
	mobiel: boolean;
	website: string;
}
