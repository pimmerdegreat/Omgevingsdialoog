// Tekenen op de kaart: één klik voor een punt, meerdere klikken voor een lijn of vlak.
// Bewust eenvoudig gehouden zodat het op een telefoon net zo werkt als met een muis.
import L from 'leaflet';
import type { Coordinaat, Geometrie, Vorm } from '../types';

export interface Tekening {
	/** Rondt de lijn of het vlak af. Geeft false als er nog te weinig punten staan. */
	voltooi: () => boolean;
	wisLaatste: () => void;
	annuleer: () => void;
}

const rond = (n: number) => Math.round(n * 1e6) / 1e6;

export function startTekenen(
	map: L.Map,
	vorm: Vorm,
	kleur: string,
	opAantal: (aantal: number) => void,
	klaar: (geometrie: Geometrie | null) => void,
): Tekening {
	const hoeken: L.LatLng[] = [];
	const laag = L.layerGroup().addTo(map);
	const minimum = vorm === 'lijn' ? 2 : 3;
	const stijl = { color: kleur, weight: 4, fillColor: kleur, fillOpacity: 0.2 };
	const vormLaag: L.Polyline | L.Polygon = vorm === 'vlak' ? L.polygon([], stijl).addTo(laag) : L.polyline([], stijl).addTo(laag);
	const elastiek = L.polyline([], { color: kleur, weight: 2, dashArray: '6 6', interactive: false }).addTo(laag);
	const stippen = L.layerGroup().addTo(laag);
	const dubbelklikZoom = map.doubleClickZoom.enabled();
	let laatsteKlik = 0;

	map.getContainer().classList.add('tekenmodus');
	map.doubleClickZoom.disable();

	function teken() {
		vormLaag.setLatLngs(hoeken);
		stippen.clearLayers();
		hoeken.forEach((h) => L.circleMarker(h, { radius: 6, color: '#fff', weight: 2, fillColor: kleur, fillOpacity: 1, interactive: false }).addTo(stippen));
		opAantal(hoeken.length);
	}

	function opruimen() {
		map.off('click', opKlik);
		map.off('mousemove', opBeweging);
		map.removeLayer(laag);
		map.getContainer().classList.remove('tekenmodus');
		if (dubbelklikZoom) map.doubleClickZoom.enable();
	}

	function voltooi(): boolean {
		if (hoeken.length < minimum) return false;
		const c: Coordinaat[] = hoeken.map((h) => [rond(h.lng), rond(h.lat)]);
		opruimen();
		klaar(vorm === 'lijn' ? { type: 'LineString', coordinates: c } : { type: 'Polygon', coordinates: [[...c, c[0]]] });
		return true;
	}

	function opKlik(e: L.LeafletMouseEvent) {
		if (vorm === 'punt') {
			opruimen();
			klaar({ type: 'Point', coordinates: [rond(e.latlng.lng), rond(e.latlng.lat)] });
			return;
		}
		// Een dubbelklik komt binnen als twee klikken kort na elkaar: de tweede rondt af in plaats van een punt toe te voegen.
		const nu = Date.now();
		const dubbel = nu - laatsteKlik < 320;
		laatsteKlik = nu;
		if (dubbel && hoeken.length >= minimum) {
			voltooi();
			return;
		}
		if (dubbel) return;
		hoeken.push(e.latlng);
		teken();
	}

	function opBeweging(e: L.LeafletMouseEvent) {
		if (!hoeken.length) return;
		elastiek.setLatLngs([hoeken[hoeken.length - 1], e.latlng]);
	}

	map.on('click', opKlik);
	map.on('mousemove', opBeweging);
	opAantal(0);

	return {
		voltooi,
		wisLaatste() {
			hoeken.pop();
			elastiek.setLatLngs([]);
			teken();
		},
		annuleer() {
			opruimen();
			klaar(null);
		},
	};
}
