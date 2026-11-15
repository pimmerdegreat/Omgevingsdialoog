<script setup lang="ts">
// De kaart met ondergronden en kaartlagen van een traject. De pagina eromheen tekent er zelf
// bijdragen en planonderdelen op via de kaart die bij 'klaar' wordt doorgegeven.
import L from 'leaflet';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { BASISKAARTEN, basiskaart } from '../../../gedeeld/basiskaarten.js';
import { bestandUrl } from '../api';
import type { KaartOpzet } from '../types';

const props = defineProps<{ opzet: KaartOpzet; volgOpzet?: boolean }>();
const emit = defineEmits<{ klaar: [map: L.Map] }>();

const el = ref<HTMLElement | null>(null);
const paneelOpen = ref(false);
const gekozen = ref(props.opzet.standaard);
const lagenAan = ref<Record<string, boolean>>({});

let map: L.Map | null = null;
let ondergrond: L.TileLayer | null = null;
const laagObjecten = new Map<string, L.Layer>();
let kijker: ResizeObserver | null = null;

function zetOndergrond(id: string) {
	if (!map) return;
	const k = basiskaart(id);
	if (ondergrond) map.removeLayer(ondergrond);
	ondergrond = L.tileLayer(k.url, { maxZoom: 21, maxNativeZoom: k.maxZoom, attribution: k.bron }).addTo(map);
	ondergrond.bringToBack();
}

async function laadLagen() {
	if (!map) return;
	for (const laag of laagObjecten.values()) map.removeLayer(laag);
	laagObjecten.clear();
	for (const laag of props.opzet.lagen) {
		if (!(laag.id in lagenAan.value)) lagenAan.value[laag.id] = true;
		let object: L.Layer | null = null;
		if (laag.type === 'afbeelding' && laag.grenzen) {
			object = L.imageOverlay(bestandUrl(laag.bestand_id), laag.grenzen, { opacity: laag.dekking, interactive: false });
		} else if (laag.type === 'geojson') {
			try {
				const gegevens = await (await fetch(bestandUrl(laag.bestand_id))).json();
				object = L.geoJSON(gegevens, {
					interactive: false,
					style: { color: laag.kleur, weight: 2.5, opacity: laag.dekking, fillColor: laag.kleur, fillOpacity: laag.dekking * 0.25 },
					pointToLayer: (_f, plek) => L.circleMarker(plek, { radius: 5, color: laag.kleur, weight: 2, fillColor: laag.kleur, fillOpacity: laag.dekking * 0.6 }),
				});
			} catch {
				object = null; // Een kaartlaag die niet laadt mag het meedoen niet blokkeren.
			}
		}
		if (!object || !map) continue;
		laagObjecten.set(laag.id, object);
		if (lagenAan.value[laag.id]) object.addTo(map);
	}
}

function wisselLaag(id: string) {
	const object = laagObjecten.get(id);
	if (!object || !map) return;
	if (lagenAan.value[id]) object.addTo(map);
	else map.removeLayer(object);
}

onMounted(() => {
	if (!el.value) return;
	map = L.map(el.value, { zoomControl: false, zoomSnap: 0.5 }).setView([props.opzet.centrum[1], props.opzet.centrum[0]], props.opzet.zoom);
	map.attributionControl.setPrefix(false);
	L.control.zoom({ position: 'topright', zoomInTitle: 'Inzoomen', zoomOutTitle: 'Uitzoomen' }).addTo(map);
	zetOndergrond(gekozen.value);
	laadLagen();
	// De kaart verandert van formaat als het paneel ernaast meeschuift of het scherm draait.
	kijker = new ResizeObserver(() => map?.invalidateSize());
	kijker.observe(el.value);
	emit('klaar', map);
});

onBeforeUnmount(() => {
	kijker?.disconnect();
	map?.remove();
	map = null;
});

watch(gekozen, zetOndergrond);

// In beheer verandert de opzet terwijl de kaart open staat.
watch(
	() => JSON.stringify(props.opzet.lagen),
	() => laadLagen(),
);
watch(
	() => [props.opzet.basiskaarten.join(), props.opzet.standaard],
	() => {
		if (!props.opzet.basiskaarten.includes(gekozen.value) || props.volgOpzet) gekozen.value = props.opzet.standaard;
	},
);

const beschikbaar = () => BASISKAARTEN.filter((k) => props.opzet.basiskaarten.includes(k.id));
</script>

<template>
	<div class="kaartvlak">
		<div ref="el" class="kaart" role="application" aria-label="Kaart"></div>
		<div class="kaart-bediening">
			<button type="button" class="kaartknop" :aria-expanded="paneelOpen" aria-controls="kaartlagen" @click="paneelOpen = !paneelOpen">Kaartlagen</button>
			<div v-if="paneelOpen" id="kaartlagen" class="kaartlagen">
				<fieldset>
					<legend>Ondergrond</legend>
					<label v-for="k in beschikbaar()" :key="k.id"><input v-model="gekozen" type="radio" name="ondergrond" :value="k.id" /> {{ k.naam }}</label>
				</fieldset>
				<fieldset v-if="opzet.lagen.length">
					<legend>Kaartlagen</legend>
					<label v-for="laag in opzet.lagen" :key="laag.id">
						<input v-model="lagenAan[laag.id]" type="checkbox" @change="wisselLaag(laag.id)" />
						<span class="laagkleur" :style="{ background: laag.kleur }"></span>{{ laag.titel }}
					</label>
				</fieldset>
			</div>
		</div>
		<slot />
	</div>
</template>
