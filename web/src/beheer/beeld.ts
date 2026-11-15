// Verkleint een foto of ontwerpbeeld in de browser voordat het wordt opgeslagen.
// Zo blijft de site snel op een telefoon en past het beeld in het rapport voor de klant.

const TOEGESTAAN = /^image\/(png|jpeg|webp)$/;

export async function verkleinBeeld(bestand: File, maxZijde = 2000): Promise<{ blob: Blob; naam: string }> {
	if (!TOEGESTAAN.test(bestand.type)) throw new Error(`${bestand.name} is geen PNG, JPG of WebP.`);
	const bitmap = await createImageBitmap(bestand);
	const schaal = Math.min(1, maxZijde / Math.max(bitmap.width, bitmap.height));
	// Klein genoeg: ongewijzigd bewaren, zodat een tekening met scherpe lijnen of doorzichtigheid intact blijft.
	if (schaal === 1 && bestand.size <= 900 * 1024) {
		bitmap.close();
		return { blob: bestand, naam: bestand.name };
	}
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * schaal);
	canvas.height = Math.round(bitmap.height * schaal);
	const tekenaar = canvas.getContext('2d')!;
	tekenaar.fillStyle = '#ffffff';
	tekenaar.fillRect(0, 0, canvas.width, canvas.height);
	tekenaar.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	const blob = await new Promise<Blob>((klaar, mislukt) => canvas.toBlob((b) => (b ? klaar(b) : mislukt(new Error('Verkleinen is niet gelukt.'))), 'image/jpeg', 0.86));
	return { blob, naam: bestand.name.replace(/\.[^.]+$/, '') + '.jpg' };
}
