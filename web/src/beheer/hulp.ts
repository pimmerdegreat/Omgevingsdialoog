// Kleine hulpfuncties voor beheer.

/** Maakt van een tekst een sleutel of webadres: kleine letters, cijfers en streepjes. */
export function maakSleutel(tekst: string, maximaal = 40): string {
	return (
		tekst
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, maximaal)
			.replace(/-+$/, '') || 'item'
	);
}

/** Een sleutel die nog niet in de lijst voorkomt. Sleutels veranderen daarna niet meer, zodat inzendingen gekoppeld blijven. */
export function uniekeSleutel(basis: string, bestaand: string[]): string {
	const start = maakSleutel(basis, 32);
	let sleutel = start;
	for (let n = 2; bestaand.includes(sleutel); n++) sleutel = `${start}-${n}`;
	return sleutel;
}

export function datumTijd(iso: string | null): string {
	if (!iso) return 'Nog geen';
	return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function getal(n: number): string {
	return n.toLocaleString('nl-NL');
}
