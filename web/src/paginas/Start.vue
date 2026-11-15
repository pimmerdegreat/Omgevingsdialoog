<script setup lang="ts">
// Startpagina: legt in het kort uit wat Dialoogkaart is en laat de kaart van het voorbeeld zien.
import L from 'leaflet';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { basiskaart } from '../../../gedeeld/basiskaarten.js';
import { boogSvg } from '../../../gedeeld/boog.js';
import { DEMO } from '../api';
import logo from '../../../gedeeld/buro-sro.png';

// Een greep uit de plekken van het voorbeeldtraject rond 't Goylaan: [lengte, breedte, kleur].
const PLEKKEN: [number, number, string][] = [
	[5.12528, 52.06804, '#7e9d45'],
	[5.12636, 52.065, '#b4472f'],
	[5.11981, 52.06626, '#b4472f'],
	[5.12228, 52.0658, '#d59800'],
	[5.12807, 52.06824, '#7e9d45'],
	[5.12393, 52.06843, '#d59800'],
	[5.11692, 52.06916, '#7e9d45'],
	[5.1215, 52.07, '#d59800'],
	[5.1157, 52.06695, '#b4472f'],
	[5.11842, 52.0681, '#2e8a86'],
	[5.124, 52.06679, '#2e8a86'],
	[5.1209, 52.0652, '#224362'],
	[5.1262, 52.0672, '#7e9d45'],
	[5.1183, 52.0655, '#d59800'],
];

const kaartEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;

onMounted(() => {
	document.title = 'Dialoogkaart van Buro SRO';
	if (!kaartEl.value) return;
	// Een stilstaand beeld van de kaart: schuiven en zoomen staan uit, zodat de pagina gewoon scrolt.
	map = L.map(kaartEl.value, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.25 });
	map.attributionControl.setPrefix(false);
	const k = basiskaart('brt-grijs');
	L.tileLayer(k.url, { maxZoom: 19, attribution: k.bron }).addTo(map);
	map.fitBounds(L.latLngBounds(PLEKKEN.map(([lng, lat]) => [lat, lng] as [number, number])).pad(0.12));
	PLEKKEN.forEach(([lng, lat, kleur], i) => {
		L.marker([lat, lng], {
			interactive: false,
			keyboard: false,
			icon: L.divIcon({ className: 'dk-marker start-marker', html: `<span style="animation-delay:${300 + i * 110}ms">${boogSvg(kleur)}</span>`, iconSize: [28, 37], iconAnchor: [14, 36] }),
		}).addTo(map!);
	});
});

onBeforeUnmount(() => map?.remove());
</script>

<template>
	<div class="start">
		<header class="start-kop">
			<a href="https://www.burosro.nl"><img :src="logo" alt="Buro SRO" width="877" height="400" /></a>
			<RouterLink v-if="!DEMO" to="/beheer" class="knop knop-stil knop-klein">Beheer</RouterLink>
		</header>
		<main class="start-inhoud">
			<div class="start-tekst">
				<h1>Zeg het op de kaart</h1>
				<p class="start-inleiding">
					Met Dialoogkaart vraagt Buro SRO bewoners waar het in hun buurt goed gaat, waar het beter kan en wat zij van een plan vinden. Elke bijdrage krijgt een plek op de kaart.
				</p>
				<div class="start-knoppen">
					<RouterLink to="/p/voorbeeld-goylaan" class="knop">Probeer het voorbeeld</RouterLink>
					<a v-if="DEMO" href="demo/resultaten.html" class="knop knop-stil">Bekijk het voorbeeldrapport</a>
				</div>
				<p v-if="DEMO" class="notitie">Dit is een demo zonder server. Wat je invult blijft in je eigen browser en wordt niet verstuurd.</p>
				<p>Heb je een link naar een traject gekregen? Open dan die link om mee te doen.</p>
			</div>
			<figure class="start-kaart">
				<div ref="kaartEl" class="start-kaartvlak" aria-hidden="true"></div>
				<figcaption>Het voorbeeld speelt rond 't Goylaan in Utrecht, de straat van ons kantoor. De bijdragen zijn verzonnen.</figcaption>
			</figure>
		</main>
	</div>
</template>
