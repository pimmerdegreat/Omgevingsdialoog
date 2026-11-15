// Voorbeeldtraject met verzonnen deelnemers, om de werking te laten zien zonder echt project.
// De gegevens zijn herhaalbaar: dezelfde startwaarde geeft altijd dezelfde uitkomst.
// Het traject speelt rond 't Goylaan in Utrecht, de straat van het Utrechtse kantoor van Buro SRO.
// De planonderdelen en alle reacties zijn verzonnen.

export const VOORBEELD_SLUG = 'voorbeeld-goylaan';

// Schetsen voor het voorbeeld (server/seed/beelden), met vaste sleutels zodat de opzet ernaar kan verwijzen.
export const VOORBEELD_BEELDEN = [
	{ id: '00000000-0000-4000-a000-0000000000b1', bestand: 'overzicht.png' },
	{ id: '00000000-0000-4000-a000-0000000000b2', bestand: 'model-a.png' },
	{ id: '00000000-0000-4000-a000-0000000000b3', bestand: 'model-b.png' },
	{ id: '00000000-0000-4000-a000-0000000000b4', bestand: 'model-c.png' },
];
const [OVERZICHT, MODEL_A, MODEL_B, MODEL_C] = VOORBEELD_BEELDEN.map((b) => b.id);
const MODELLEN = ['Model A · Groen plein', 'Model B · Stenen plein met fonteinen', 'Model C · Plein met paviljoen'];

export function voorbeeldTraject() {
	return {
		slug: VOORBEELD_SLUG,
		titel: "Voorbeeldtraject: de buurt rond 't Goylaan",
		status: 'open',
		voorbeeld: true,
		definitie: {
			intro: {
				kop: "Wat kan er beter rond 't Goylaan?",
				tekst:
					"Dit is een voorbeeldtraject van Buro SRO. Het laat zien hoe bewoners op de kaart aangeven wat zij fijn vinden, wat beter kan en wat zij van een plan vinden.\n\nDe voorstellen op de kaart zijn verzonnen. Meedoen kost ongeveer vijf minuten en je kunt elke stap overslaan.",
			},
			kaart: {
				centrum: [5.1215, 52.0669],
				zoom: 16,
				basiskaarten: ['brt-standaard', 'brt-grijs', 'luchtfoto', 'osm', 'cyclosm'],
				standaard: 'brt-standaard',
				lagen: [],
			},
			stappen: [
				{
					id: 'plekken',
					type: 'tekenen',
					titel: 'Zet jouw plekken op de kaart',
					tekst: 'Kies wat je wilt aangeven en klik daarna op de kaart. Je kunt zoveel plekken toevoegen als je wilt.',
					categorieen: [
						{ id: 'fijn', label: 'Fijne plek', kleur: '#7e9d45', vorm: 'punt', uitleg: 'Een plek waar je graag komt.' },
						{ id: 'onveilig', label: 'Hier voel ik me niet veilig', kleur: '#b4472f', vorm: 'punt', uitleg: 'In het verkeer of op straat.' },
						{ id: 'idee', label: 'Idee voor deze plek', kleur: '#d59800', vorm: 'punt', uitleg: 'Iets wat hier zou moeten komen of veranderen.' },
						{ id: 'route', label: 'Mijn dagelijkse route', kleur: '#224362', vorm: 'lijn', uitleg: 'Te voet of op de fiets.' },
						{ id: 'groen', label: 'Hier mag meer groen komen', kleur: '#2e8a86', vorm: 'vlak', uitleg: 'Teken het gebied dat je bedoelt.' },
					],
				},
				{
					id: 'voorstellen',
					type: 'reageren',
					titel: 'Wat vind je van deze voorstellen?',
					tekst: 'Klik op een voorstel op de kaart of in de lijst en geef je mening. De voorstellen zijn verzonnen voor dit voorbeeld.',
					media: [{ type: 'afbeelding', bestand_id: OVERZICHT, bijschrift: 'Schetsontwerp van de vier voorstellen. Klik op de afbeelding om te vergroten.' }],
					onderdelen: [
						{
							id: 'bomenrij',
							titel: "Bomenrij langs 't Goylaan",
							tekst: 'Een dubbele rij bomen in de middenberm, van de brug tot aan het plein.',
							kleur: '#7e9d45',
							geometrie: {
								type: 'LineString',
								coordinates: [
									[5.1167, 52.06679],
									[5.11981, 52.06626],
									[5.12228, 52.0658],
									[5.12485, 52.06533],
								],
							},
						},
						{
							id: 'vijver',
							titel: 'Verblijfsplek aan de vijver',
							tekst: 'Een vlonder met zitrand aan het water, met ruimte voor spelen.',
							kleur: '#2e8a86',
							geometrie: {
								type: 'Polygon',
								coordinates: [
									[
										[5.12425, 52.06834],
										[5.1264, 52.06813],
										[5.12631, 52.06774],
										[5.12417, 52.06795],
										[5.12425, 52.06834],
									],
								],
							},
						},
						{
							id: 'oversteek',
							titel: 'Veilige oversteek bij de Constant Erzeijstraat',
							tekst: 'Een verhoogde oversteek met middeneiland voor voetgangers en fietsers.',
							kleur: '#d59800',
							geometrie: { type: 'Point', coordinates: [5.11981, 52.06626] },
						},
						{
							id: 'stalling',
							titel: "Fietsenstalling bij 't Goyplein",
							tekst: 'Een overdekte stalling voor tachtig fietsen naast de bushalte.',
							kleur: '#224362',
							geometrie: { type: 'Point', coordinates: [5.12571, 52.06533] },
						},
					],
				},
				{
					id: 'vragen',
					type: 'vragen',
					titel: 'Nog vijf vragen over de buurt',
					tekst: '',
					vragen: [
						{
							id: 'bezoek',
							type: 'keuze',
							label: 'Hoe vaak kom je in dit gebied?',
							verplicht: false,
							opties: ['Ik woon hier', 'Dagelijks', 'Wekelijks', 'Af en toe', 'Zelden of nooit'],
							min: 1,
							max: 5,
							minLabel: '',
							maxLabel: '',
						},
						{
							id: 'doel',
							type: 'meerkeuze',
							label: 'Waarvoor kom je hier?',
							verplicht: false,
							opties: ['Wonen', 'Werk of school', 'Boodschappen', 'Wandelen of sporten', 'Op doorreis', 'Bezoek aan vrienden of familie'],
							min: 1,
							max: 5,
							minLabel: '',
							maxLabel: '',
						},
						{
							id: 'cijfer',
							type: 'schaal',
							label: 'Welk rapportcijfer geef je de buurt nu?',
							verplicht: false,
							opties: [],
							min: 1,
							max: 10,
							minLabel: 'Slecht',
							maxLabel: 'Uitstekend',
						},
						{
							id: 'plein',
							type: 'keuze',
							label: "Welk model voor het plein bij 't Goyplein heeft je voorkeur?",
							verplicht: false,
							opties: MODELLEN,
							optieBeelden: { [MODELLEN[0]]: MODEL_A, [MODELLEN[1]]: MODEL_B, [MODELLEN[2]]: MODEL_C },
							min: 1,
							max: 5,
							minLabel: '',
							maxLabel: '',
						},
						{
							id: 'behouden',
							type: 'tekst',
							label: 'Wat moet zeker blijven zoals het is?',
							verplicht: false,
							opties: [],
							min: 1,
							max: 5,
							minLabel: '',
							maxLabel: '',
						},
					],
				},
			],
			over_jou: { postcode: true, leeftijd: true, email: true },
			privacy: {
				tekst:
					"Buro SRO is verantwoordelijk voor de verwerking van je gegevens. We gebruiken je bijdragen op de kaart en je antwoorden om het plan voor dit gebied te verbeteren.\n\nPostcode en leeftijd gebruiken we alleen om te zien of we alle groepen in de buurt bereiken. Je e-mailadres gebruiken we alleen om op je bijdrage te reageren of om je op de hoogte te houden, als je daar zelf voor kiest.\n\nIn rapporten staan geen namen of e-mailadressen. We verwijderen je e-mailadres en de letters van je postcode twaalf maanden nadat het traject is gesloten. Wil je je gegevens eerder laten verwijderen? Stuur een bericht naar utrecht@buro-sro.nl.",
				bewaartermijn_maanden: 12,
			},
			bedankt: {
				kop: 'Dank voor je bijdrage',
				tekst: 'Je punten en antwoorden zijn opgeslagen. Dit was een voorbeeldtraject, dus er gebeurt verder niets mee.',
			},
		},
	};
}

// ---- Verzonnen deelnemers ----

function mulberry32(start) {
	let a = start >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Elke tekst is een kern met een wisselende aanvulling, zodat de voorbeelddata niet steeds dezelfde zin herhaalt.
const TEKSTEN = {
	fijn: {
		kernen: [
			'Hier lunch ik graag aan het water',
			'Rustige plek met veel vogels',
			'De kinderen spelen hier bijna elke dag',
			'Mooi uitzicht over de vijver',
			'Fijn om hier een rondje te lopen',
			'Hier kom je altijd bekenden tegen',
			'Onder de bomen is het heerlijk koel',
			'Prettig bankje in de zon',
			'Hier laat ik de hond uit',
			'Goede plek om even te zitten',
			'Het groen is hier goed onderhouden',
			'Hier is het nog echt stil',
		],
		aanvullingen: ['.', '.', ', vooral in het voorjaar.', ', vooral in de zomer.', ' na het werk.', ' in het weekend.', ', dat moet zo blijven.'],
	},
	onveilig: {
		kernen: [
			'Auto’s rijden hier veel te hard',
			'Oversteken met kinderen durf ik hier niet',
			'Het is hier onoverzichtelijk',
			'Fietsers en auto’s komen hier steeds in conflict',
			'Als fietser word je hier slecht gezien',
			'De verlichting is hier slecht',
			'Het voetgangerslicht staat te kort op groen',
			'Bestelbusjes parkeren hier op het fietspad',
			'Scooters rijden hier over de stoep',
			'De stoep is hier te smal voor een kinderwagen',
			'Je ziet het verkeer van rechts pas op het laatste moment',
			'Hier wordt vaak door rood gereden',
		],
		aanvullingen: ['.', '.', ', vooral in de spits.', ', vooral in het donker.', ' als de school uitgaat.', ', bijna elke dag.', ' sinds de bushalte is verplaatst.'],
	},
	idee: {
		kernen: [
			'Hier zou een bankje goed staan',
			'Een watertappunt zou hier fijn zijn',
			'Maak hier ruimte voor een weekmarkt',
			'Plaats hier fietsnietjes',
			'Een speelplek voor oudere kinderen ontbreekt hier',
			'Haal de tegels eruit en maak er een geveltuin van',
			'Hier past een buurtmoestuin',
			'Zet hier een picknicktafel neer',
			'Een oplaadpunt voor fietsen zou handig zijn',
			'Maak hier een afvalbak bij',
			'Hier kan een deelauto staan',
			'Leg hier een jeu-de-boulesbaan aan',
		],
		aanvullingen: ['.', '.', ', daar is in de buurt veel vraag naar.', ', dat kost weinig.', ' voor de ouderen in de flat.', ', samen met de school.', ' naast de ingang.'],
	},
	route: {
		kernen: ['Mijn route naar het werk', 'Zo loop ik met de hond', 'Fietsroute naar school', 'Naar de supermarkt en terug', 'Mijn hardlooprondje', 'Zo loop ik naar de bushalte'],
		aanvullingen: ['.', '.', ', elke dag.', ', twee keer per dag.', ', ook in het donker.'],
	},
	groen: {
		kernen: [
			'Veel steen hier, in de zomer wordt het erg heet',
			'Deze parkeerplaatsen staan vaak leeg',
			'Hier kan makkelijk een rij bomen bij',
			'Maak hier een wadi voor het regenwater',
			'Dit plein is nu alleen maar tegels',
			'Hier staat na een bui altijd water',
		],
		aanvullingen: ['.', '.', ', dat ziet iedereen.', ', al jaren.', ' en er is ruimte genoeg.'],
	},
};

// Reacties per planonderdeel en oordeel.
const REACTIES = {
	bomenrij: {
		goed: ['De straat wordt er een stuk koeler van.', 'Bomen dempen het verkeerslawaai.', 'Dit geeft de laan weer allure.', 'Graag grote bomen, geen sprietjes.', 'Goed voor de vogels en voor ons.'],
		twijfel: ['Mooi, maar wie ruimt het blad op?', 'Alleen als de bus er niet door vertraagt.', 'Wortels drukken straks het fietspad omhoog.', 'Welke soort komt er? Geen lindes graag.'],
		niet: ['Bomen nemen het zicht op het verkeer weg.', 'Zonde van het geld, de stoep is belangrijker.', 'Dit kost parkeerplaatsen in de zijstraten.'],
	},
	vijver: {
		goed: ['Eindelijk een plek om aan het water te zitten.', 'Fijn voor de kinderen uit de flats.', 'De vijver ligt er nu verloren bij.', 'Een vlonder maakt het water bereikbaar.', 'Hier kunnen buren elkaar ontmoeten.'],
		twijfel: ['Ik ben bang voor overlast in de avond.', 'Hoe veilig is het voor kleine kinderen?', 'Alleen als er ook toezicht komt.', 'Wie houdt het schoon?'],
		niet: ['Dit trekt hangjongeren aan.', 'De eenden hebben hier nu rust.', 'Wij wonen ernaast en willen geen drukte.', 'Er zijn al genoeg plekken om te zitten.'],
	},
	oversteek: {
		goed: ['Hier wacht de buurt al jaren op.', 'Dit maakt de schoolroute veiliger.', 'Auto’s moeten hier echt afremmen.', 'Met een middeneiland kan ik in twee keer oversteken.', 'Graag snel uitvoeren.'],
		twijfel: ['Een drempel geeft trillingen in de huizen.', 'Werkt alleen als er ook gehandhaafd wordt.', 'Staat de bus hier dan niet steeds stil?'],
		niet: ['De doorstroming wordt hierdoor slechter.', 'Honderd meter verderop is al een oversteek.'],
	},
	stalling: {
		goed: ['Dan staat mijn fiets droog bij de bus.', 'Nu staan de fietsen tegen de hekken.', 'Handig voor wie verder reist.'],
		twijfel: ['Tachtig plekken lijkt me te veel.', 'Alleen met camera, anders verdwijnen de fietsen.', 'Liever verspreid over de buurt.', 'Hangt af van hoe hoog het wordt.'],
		niet: ['Daar is te weinig ruimte voor.', 'Een stalling wordt een verzamelplek voor wrakken.', 'Het uitzicht vanaf het plein verdwijnt.', 'Niemand uit de buurt gaat dit gebruiken.', 'Zonde van het geld, er zijn dringender zaken.'],
	},
};

const BEHOUDEN = [
	'De oude bomen langs het water.',
	'De rust in de zijstraten.',
	'De buurtwinkels aan het plein.',
	'De speeltuin achter de flats.',
	'Het uitzicht over de Vaartsche Rijn.',
	'Het gemengde karakter van de buurt.',
	'De vijver en het groen eromheen.',
	'Gratis parkeren voor bewoners.',
	'De bushalte op loopafstand.',
];

// Zwaartepunten per categorie: [lengte, breedte, spreiding in meters, gewicht].
const PLEKKEN = {
	fijn: [
		[5.12528, 52.06804, 45, 5],
		[5.12807, 52.06824, 70, 3],
		[5.11692, 52.06916, 60, 3],
		[5.12393, 52.06843, 40, 1],
	],
	onveilig: [
		[5.12636, 52.065, 40, 5],
		[5.11981, 52.06626, 30, 4],
		[5.1157, 52.06695, 35, 2],
		[5.1222, 52.06582, 60, 1],
	],
	idee: [
		[5.12228, 52.0658, 80, 3],
		[5.12393, 52.06843, 50, 3],
		[5.1215, 52.07, 90, 2],
		[5.11842, 52.0681, 70, 2],
		[5.12528, 52.06804, 45, 2],
	],
	groen: [
		[5.11842, 52.0681, 60, 3],
		[5.124, 52.06679, 50, 3],
		[5.1209, 52.0652, 60, 2],
	],
};

const ROUTES = [
	[
		[5.1157, 52.06695],
		[5.1167, 52.06679],
		[5.11981, 52.06626],
		[5.12228, 52.0658],
		[5.12485, 52.06533],
		[5.12636, 52.065],
	],
	[
		[5.12228, 52.0718],
		[5.12121, 52.06916],
		[5.12056, 52.06758],
		[5.11981, 52.06626],
	],
	[
		[5.12393, 52.06843],
		[5.12528, 52.06804],
		[5.12807, 52.06824],
	],
	[
		[5.11692, 52.06916],
		[5.1162, 52.068],
		[5.1157, 52.06695],
	],
];

const M_PER_GRAAD_LAT = 111320;
const M_PER_GRAAD_LNG = 111320 * Math.cos((52.067 * Math.PI) / 180);
const rond = (g) => Math.round(g * 1e6) / 1e6;

/** Maakt een herhaalbare set verzonnen inzendingen voor het voorbeeldtraject. */
export function voorbeeldGegevens(start = 2010) {
	const rnd = mulberry32(start);
	const kies = (lijst) => lijst[Math.floor(rnd() * lijst.length)];
	const normaal = () => {
		const u = Math.max(rnd(), 1e-9);
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
	};
	const gewogen = (opties) => {
		const totaal = opties.reduce((s, o) => s + o[o.length - 1], 0);
		let r = rnd() * totaal;
		for (const o of opties) {
			r -= o[o.length - 1];
			if (r <= 0) return o;
		}
		return opties[opties.length - 1];
	};
	const uuid = () => {
		const hex = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');
		return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
	};
	const nabij = ([lng, lat, spreiding]) => [
		rond(lng + (normaal() * spreiding) / M_PER_GRAAD_LNG),
		rond(lat + (normaal() * spreiding) / M_PER_GRAAD_LAT),
	];

	const inzendingen = [];
	const bijdragen = [];
	const reacties = [];

	const begin = Date.UTC(2026, 8, 7, 6, 0, 0);
	const duur = 28 * 24 * 3600 * 1000;
	const postcodes = [
		['3525', 9],
		['3523', 4],
		['3524', 3],
		['3526', 2],
		['3582', 1],
		['3511', 1],
	];
	const leeftijden = [
		['tm17', 1],
		['18-29', 4],
		['30-44', 7],
		['45-64', 6],
		['65plus', 4],
	];
	const letters = 'ABCDEGHJKLMNPRSTVWXZ';

	for (let n = 0; n < 148; n++) {
		const id = uuid();
		// Meer inzendingen in de eerste week en rond het einde, zoals bij echte trajecten.
		const fase = rnd();
		const moment = begin + Math.floor((fase < 0.45 ? rnd() * 0.3 : fase < 0.8 ? 0.3 + rnd() * 0.5 : 0.8 + rnd() * 0.2) * duur);
		const metEmail = rnd() < 0.36;
		const antwoorden = {};
		if (rnd() < 0.92) antwoorden.bezoek = gewogen([['Ik woon hier', 9], ['Dagelijks', 4], ['Wekelijks', 3], ['Af en toe', 2], ['Zelden of nooit', 1]])[0];
		if (rnd() < 0.88) {
			const doelen = ['Wonen', 'Werk of school', 'Boodschappen', 'Wandelen of sporten', 'Op doorreis', 'Bezoek aan vrienden of familie'];
			const kansen = [0.62, 0.3, 0.48, 0.41, 0.22, 0.14];
			const gekozen = doelen.filter((_, i) => rnd() < kansen[i]);
			if (gekozen.length) antwoorden.doel = gekozen;
		}
		if (rnd() < 0.9) antwoorden.cijfer = Math.min(10, Math.max(3, Math.round(6.8 + normaal() * 1.3)));
		if (rnd() < 0.4) antwoorden.behouden = kies(BEHOUDEN);
		if (rnd() < 0.86) antwoorden.plein = gewogen([[MODELLEN[0], 6], [MODELLEN[1], 2], [MODELLEN[2], 4]])[0];

		inzendingen.push({
			id,
			ingediend: new Date(moment).toISOString(),
			antwoorden,
			postcode: rnd() < 0.85 ? gewogen(postcodes)[0] + (rnd() < 0.7 ? kies(letters) + kies(letters) : '') : null,
			leeftijd: rnd() < 0.83 ? gewogen(leeftijden)[0] : null,
			email: metEmail ? `deelnemer${String(n + 1).padStart(3, '0')}@voorbeeld.example` : null,
			op_de_hoogte: metEmail && rnd() < 0.7,
			mobiel: rnd() < 0.58,
		});

		const aantal = Math.floor(rnd() * 5);
		for (let k = 0; k < aantal; k++) {
			const categorie = gewogen([['fijn', 5], ['onveilig', 6], ['idee', 5], ['route', 2], ['groen', 2]])[0];
			let geometrie;
			if (categorie === 'route') {
				const basis = kies(ROUTES);
				geometrie = { type: 'LineString', coordinates: basis.map((p) => nabij([p[0], p[1], 9])) };
			} else if (categorie === 'groen') {
				const [lng, lat] = nabij(gewogen(PLEKKEN.groen));
				const straal = 18 + rnd() * 30;
				const hoeken = 5 + Math.floor(rnd() * 3);
				const draai = rnd() * Math.PI;
				const ring = Array.from({ length: hoeken }, (_, i) => {
					const hoek = draai + (i / hoeken) * 2 * Math.PI;
					const r = straal * (0.7 + rnd() * 0.5);
					return [rond(lng + (Math.cos(hoek) * r) / M_PER_GRAAD_LNG), rond(lat + (Math.sin(hoek) * r) / M_PER_GRAAD_LAT)];
				});
				ring.push(ring[0]);
				geometrie = { type: 'Polygon', coordinates: [ring] };
			} else {
				geometrie = { type: 'Point', coordinates: nabij(gewogen(PLEKKEN[categorie])) };
			}
			const toelichting = rnd() < 0.62 ? kies(TEKSTEN[categorie].kernen) + kies(TEKSTEN[categorie].aanvullingen) : '';
			bijdragen.push({ id: uuid(), inzending_id: id, stap_id: 'plekken', categorie_id: categorie, toelichting, geometrie });
		}

		const voorkeur = { bomenrij: [8, 2, 1], vijver: [5, 3, 2], oversteek: [9, 1, 1], stalling: [3, 3, 4] };
		for (const [onderdeel, gewichten] of Object.entries(voorkeur)) {
			if (rnd() > 0.74) continue;
			const oordeel = gewogen([['goed', gewichten[0]], ['twijfel', gewichten[1]], ['niet', gewichten[2]]])[0];
			const toelichting = rnd() < 0.38 ? kies(REACTIES[onderdeel][oordeel]) : '';
			reacties.push({ id: uuid(), inzending_id: id, stap_id: 'voorstellen', onderdeel_id: onderdeel, oordeel, toelichting });
		}
	}

	inzendingen.sort((a, b) => a.ingediend.localeCompare(b.ingediend));
	return { inzendingen, bijdragen, reacties };
}
