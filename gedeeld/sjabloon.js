// Beginopzet voor een nieuw traject. Alles is daarna in beheer aan te passen.
// Gedeeld door de server en de demo zonder server.

export function legeDefinitie(organisatie) {
	const { naam, email } = organisatie;
	return {
		intro: {
			kop: 'Denk mee over dit gebied',
			tekst: 'Vertel hier in een paar zinnen waar het traject over gaat, wat er met de inbreng gebeurt en hoe lang meedoen duurt.',
		},
		kaart: {
			centrum: [5.2913, 52.1326],
			zoom: 8,
			basiskaarten: ['brt-standaard', 'luchtfoto', 'osm'],
			standaard: 'brt-standaard',
			lagen: [],
		},
		stappen: [
			{
				id: 'plekken',
				type: 'tekenen',
				titel: 'Zet jouw plekken op de kaart',
				tekst: 'Kies wat je wilt aangeven en klik daarna op de kaart.',
				categorieen: [
					{ id: 'fijn', label: 'Fijne plek', kleur: '#7e9d45', vorm: 'punt', uitleg: '' },
					{ id: 'beter', label: 'Dit kan beter', kleur: '#d59800', vorm: 'punt', uitleg: '' },
				],
			},
		],
		over_jou: { postcode: true, leeftijd: true, email: true },
		privacy: {
			tekst: `${naam} is verantwoordelijk voor de verwerking van je gegevens. We gebruiken je bijdragen op de kaart en je antwoorden om het plan voor dit gebied te verbeteren.\n\nPostcode en leeftijd gebruiken we alleen om te zien of we alle groepen bereiken. Je e-mailadres gebruiken we alleen om op je bijdrage te reageren of om je op de hoogte te houden, als je daar zelf voor kiest.\n\nIn rapporten staan geen namen of e-mailadressen. We verwijderen je e-mailadres en de letters van je postcode twaalf maanden nadat het traject is gesloten. Wil je je gegevens eerder laten verwijderen? Stuur een bericht naar ${email}.`,
			bewaartermijn_maanden: 12,
		},
		bedankt: {
			kop: 'Dank voor je bijdrage',
			tekst: 'Je punten en antwoorden zijn opgeslagen. We nemen ze mee bij het uitwerken van het plan.',
		},
	};
}
