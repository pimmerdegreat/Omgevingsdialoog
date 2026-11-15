// De kaartmarkering van Dialoogkaart: de boog uit het logo van Buro SRO, gevuld met de kleur van de categorie.

export function boogSvg(kleur, extraKlasse = '') {
	return (
		`<svg class="boog ${extraKlasse}" viewBox="0 0 28 37" aria-hidden="true" focusable="false">` +
		`<path d="M14 1C6.8 1 1 6.8 1 14v7.2c0 1.5.6 2.9 1.7 3.9L14 36l11.3-10.9c1.1-1 1.7-2.4 1.7-3.9V14C27 6.8 21.2 1 14 1z" fill="${kleur}" stroke="#fff" stroke-width="2"/>` +
		`<path d="M9 21v-6.5a5 5 0 0 1 10 0V21" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>` +
		`</svg>`
	);
}
