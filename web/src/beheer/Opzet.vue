<script setup lang="ts">
// De opzet van een traject bewerken: basis, welkom, kaart, stappen, deelnemersvragen, privacy en bedankt.
import L from 'leaflet';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { BASISKAARTEN } from '../../../gedeeld/basiskaarten.js';
import { boogSvg } from '../../../gedeeld/boog.js';
import { CATEGORIEKLEUREN, STATUSSEN, VORMEN } from '../../../gedeeld/constanten.js';
import { beheer, DEMO } from '../api';
import { leesGeojson, midden, naamUit } from '../kaart/geo';
import KaartVlak from '../kaart/KaartVlak.vue';
import { rdNaarWgs } from '../kaart/rd';
import { startTekenen, type Tekening } from '../kaart/tekenen';
import type { Geometrie, Kaartlaag, Onderdeel, Stap, Traject, Vorm, Vraag } from '../types';
import { maakSleutel, uniekeSleutel } from './hulp';

const props = defineProps<{ traject: Traject }>();
const emit = defineEmits<{ bewaard: [traject: Traject] }>();

const werk = reactive<Pick<Traject, 'id' | 'titel' | 'slug' | 'status' | 'definitie'>>(JSON.parse(JSON.stringify(props.traject)));
const bewaardeVersie = ref(JSON.stringify({ titel: werk.titel, slug: werk.slug, status: werk.status, definitie: werk.definitie }));
const gewijzigd = computed(() => JSON.stringify({ titel: werk.titel, slug: werk.slug, status: werk.status, definitie: werk.definitie }) !== bewaardeVersie.value);
const bezig = ref(false);
const melding = ref('');
const fout = ref('');

const def = computed(() => werk.definitie);
// Op de server is er een korte link (/p/naam); in de demo zonder server alleen het adres met een hekje.
const deelnemerLink = computed(() => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}${DEMO ? '#/' : ''}p/${werk.slug}`);
const gekopieerd = ref(false);

async function kopieerLink() {
	try {
		await navigator.clipboard.writeText(deelnemerLink.value);
		gekopieerd.value = true;
		setTimeout(() => (gekopieerd.value = false), 2500);
	} catch {
		// Kopiëren is geblokkeerd: de link staat zichtbaar in beeld om zelf te selecteren.
	}
}

// ---- Controleren en bewaren ----

function controleer(): string {
	if (!werk.titel.trim()) return 'Geef het traject een naam.';
	if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(werk.slug)) return 'Het webadres bestaat uit 3 tot 60 kleine letters, cijfers en streepjes.';
	if (!def.value.intro.kop.trim()) return 'Vul bij Welkom een kop in.';
	if (!def.value.kaart.basiskaarten.length) return 'Kies minstens één ondergrond voor de kaart.';
	if (!def.value.stappen.length) return 'Voeg minstens één stap toe.';
	for (const stap of def.value.stappen) {
		const naam = stap.titel.trim() || 'zonder titel';
		if (!stap.titel.trim()) return 'Geef elke stap een titel.';
		if (stap.type === 'tekenen') {
			if (!stap.categorieen.length) return `Stap "${naam}" heeft nog geen categorieën.`;
			if (stap.categorieen.some((c) => !c.label.trim())) return `Geef elke categorie in stap "${naam}" een naam.`;
		}
		if (stap.type === 'reageren') {
			if (!stap.onderdelen.length) return `Stap "${naam}" heeft nog geen planonderdelen. Teken er een op de kaart of lees een GeoJSON-bestand in.`;
			if (stap.onderdelen.some((o) => !o.titel.trim())) return `Geef elk planonderdeel in stap "${naam}" een titel.`;
		}
		if (stap.type === 'vragen') {
			if (!stap.vragen.length) return `Stap "${naam}" heeft nog geen vragen.`;
			for (const v of stap.vragen) {
				if (!v.label.trim()) return `Vul bij elke vraag in stap "${naam}" de vraagtekst in.`;
				if ((v.type === 'keuze' || v.type === 'meerkeuze') && v.opties.length < 2) return `De vraag "${v.label}" heeft minstens twee antwoordopties nodig.`;
				if (v.type === 'schaal' && v.min >= v.max) return `Bij de vraag "${v.label}" moet de schaal van laag naar hoog lopen.`;
			}
		}
	}
	if (!def.value.privacy.tekst.trim()) return 'Vul de privacyverklaring in.';
	if (!def.value.bedankt.kop.trim()) return 'Vul bij Bedankt een kop in.';
	return '';
}

async function bewaar() {
	melding.value = '';
	fout.value = controleer();
	if (fout.value) return;
	bezig.value = true;
	try {
		const traject = await beheer.bewaar(werk);
		Object.assign(werk, { titel: traject.titel, slug: traject.slug, status: traject.status, definitie: traject.definitie });
		bewaardeVersie.value = JSON.stringify({ titel: werk.titel, slug: werk.slug, status: werk.status, definitie: werk.definitie });
		melding.value = 'Opgeslagen.';
		emit('bewaard', traject);
		setTimeout(() => (melding.value = ''), 3000);
	} catch (e) {
		fout.value = (e as Error).message;
	} finally {
		bezig.value = false;
	}
}

// Een foutmelding verdwijnt zodra er iets aan de opzet verandert.
watch(
	() => JSON.stringify(werk),
	() => (fout.value = ''),
);

function waarschuw(e: BeforeUnloadEvent) {
	if (gewijzigd.value) e.preventDefault();
}
onMounted(() => window.addEventListener('beforeunload', waarschuw));
onBeforeUnmount(() => window.removeEventListener('beforeunload', waarschuw));
onBeforeRouteLeave(() => !gewijzigd.value || window.confirm('Er zijn wijzigingen die nog niet zijn opgeslagen. Toch weggaan?'));
defineExpose({ gewijzigd });

// ---- Kaart ----

let map: L.Map | null = null;
let planLaag: L.LayerGroup | null = null;
const tekening = ref<Tekening | null>(null);
const tekenAantal = ref(0);
const tekenVorm = ref<Vorm>('punt');
const tekenVoor = ref('');

function tekenPlan() {
	if (!map || !planLaag) return;
	planLaag.clearLayers();
	for (const stap of def.value.stappen) {
		if (stap.type !== 'reageren') continue;
		for (const o of stap.onderdelen) {
			const stijl = { color: o.kleur, weight: 4, dashArray: '8 7', fillColor: o.kleur, fillOpacity: 0.2 };
			const laag = o.geometrie.type === 'Point' ? L.circleMarker([o.geometrie.coordinates[1], o.geometrie.coordinates[0]], { ...stijl, radius: 13 }) : L.geoJSON(o.geometrie as GeoJSON.GeoJsonObject, { style: stijl });
			laag.bindTooltip(o.titel || 'Planonderdeel', { direction: 'top', sticky: true }).addTo(planLaag);
		}
	}
}

function kaartKlaar(m: L.Map) {
	map = m;
	planLaag = L.layerGroup().addTo(m);
	tekenPlan();
}

watch(() => JSON.stringify(def.value.stappen.map((s) => (s.type === 'reageren' ? s.onderdelen : null))), tekenPlan);

function neemUitsnede() {
	if (!map) return;
	const c = map.getCenter();
	def.value.kaart.centrum = [Math.round(c.lng * 1e5) / 1e5, Math.round(c.lat * 1e5) / 1e5];
	def.value.kaart.zoom = map.getZoom();
	melding.value = 'Het startbeeld van de kaart is aangepast. Vergeet niet op te slaan.';
}

function wisselOndergrond(id: string) {
	const lijst = def.value.kaart.basiskaarten;
	const plek = lijst.indexOf(id);
	if (plek >= 0) {
		if (lijst.length === 1) return;
		lijst.splice(plek, 1);
		if (def.value.kaart.standaard === id) def.value.kaart.standaard = lijst[0];
	} else {
		lijst.push(id);
	}
}

// Kaartlagen: GeoJSON of een afbeelding met hoekpunten.
const laagFout = ref('');
const grenzenIn = reactive<Record<string, 'wgs' | 'rd'>>({});

async function voegLaagToe(e: Event) {
	const invoer = e.target as HTMLInputElement;
	const bestand = invoer.files?.[0];
	invoer.value = '';
	laagFout.value = '';
	if (!bestand || !map) return;
	const titel = bestand.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Kaartlaag';
	const id = uniekeSleutel(titel, def.value.kaart.lagen.map((l) => l.id));
	try {
		if (/\.(geojson|json)$/i.test(bestand.name)) {
			const objecten = leesGeojson(await bestand.text(), rdNaarWgs);
			if (!objecten.length) throw new Error('In dit bestand staan geen punten, lijnen of vlakken.');
			const verzameling = { type: 'FeatureCollection', features: objecten.map((o) => ({ type: 'Feature', geometry: o.geometrie, properties: {} })) };
			const upload = await beheer.uploadBestand(werk.id, new Blob([JSON.stringify(verzameling)], { type: 'application/geo+json' }), bestand.name);
			def.value.kaart.lagen.push({ id, titel, type: 'geojson', bestand_id: upload.id, kleur: '#224362', dekking: 0.8 });
			map.fitBounds(L.geoJSON(verzameling as GeoJSON.GeoJsonObject).getBounds().pad(0.1));
		} else {
			const upload = await beheer.uploadBestand(werk.id, bestand, bestand.name);
			// De afbeelding komt eerst op de huidige uitsnede te liggen; daarna vul je de echte hoekpunten in.
			const g = map.getBounds().pad(-0.15);
			const r = (n: number) => Math.round(n * 1e6) / 1e6;
			def.value.kaart.lagen.push({ id, titel, type: 'afbeelding', bestand_id: upload.id, kleur: '#224362', dekking: 0.7, grenzen: [[r(g.getSouth()), r(g.getWest())], [r(g.getNorth()), r(g.getEast())]] });
			grenzenIn[id] = 'wgs';
		}
	} catch (fout) {
		laagFout.value = fout instanceof SyntaxError ? 'Dit bestand is geen geldige GeoJSON.' : (fout as Error).message;
	}
}

/** Zet de vier ingevulde hoekwaarden (west, zuid, oost, noord) om naar de grenzen van de afbeelding. */
function zetGrenzen(laag: Kaartlaag, e: Event) {
	const veld = e.target as HTMLInputElement;
	const waarden = veld.value.split(/[\s;]+/).map((w) => Number(w.replace(',', '.')));
	laagFout.value = '';
	if (waarden.length !== 4 || waarden.some((w) => !Number.isFinite(w))) {
		laagFout.value = 'Vul vier getallen in: west, zuid, oost en noord.';
		return;
	}
	let [west, zuid, oost, noord] = waarden;
	if (grenzenIn[laag.id] === 'rd' || Math.abs(west) > 180) {
		[west, zuid] = rdNaarWgs(west, zuid);
		[oost, noord] = rdNaarWgs(oost, noord);
	}
	if (west >= oost || zuid >= noord) {
		laagFout.value = 'West moet kleiner zijn dan oost, en zuid kleiner dan noord.';
		return;
	}
	laag.grenzen = [[zuid, west], [noord, oost]];
	map?.fitBounds(laag.grenzen);
}

const grenzenTekst = (laag: Kaartlaag) => (laag.grenzen ? [laag.grenzen[0][1], laag.grenzen[0][0], laag.grenzen[1][1], laag.grenzen[1][0]].join(' ') : '');

// ---- Stappen ----

const STAPNAMEN: Record<Stap['type'], string> = { tekenen: 'Tekenen op de kaart', reageren: 'Reageren op planonderdelen', vragen: 'Vragen' };

function voegStapToe(type: Stap['type']) {
	const ids = def.value.stappen.map((s) => s.id);
	const basis = { id: uniekeSleutel(type, ids), tekst: '' };
	if (type === 'tekenen') def.value.stappen.push({ ...basis, type, titel: 'Zet jouw plekken op de kaart', categorieen: [nieuweCategorie([])] });
	else if (type === 'reageren') def.value.stappen.push({ ...basis, type, titel: 'Wat vind je van deze voorstellen?', onderdelen: [] });
	else def.value.stappen.push({ ...basis, type, titel: 'Een paar vragen', vragen: [nieuweVraag([])] });
	nextTick(() => document.getElementById(`stap-${basis.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function verplaats<T>(lijst: T[], van: number, richting: -1 | 1) {
	const naar = van + richting;
	if (naar < 0 || naar >= lijst.length) return;
	[lijst[van], lijst[naar]] = [lijst[naar], lijst[van]];
}

function verwijderStap(nr: number) {
	const stap = def.value.stappen[nr];
	if (window.confirm(`Stap "${stap.titel}" verwijderen? Inzendingen bij deze stap tellen dan niet meer mee in het rapport.`)) def.value.stappen.splice(nr, 1);
}

function nieuweCategorie(bestaand: { id: string; kleur: string }[]) {
	const kleur = CATEGORIEKLEUREN.find((k) => !bestaand.some((c) => c.kleur === k)) || CATEGORIEKLEUREN[0];
	return { id: uniekeSleutel(`categorie-${bestaand.length + 1}`, bestaand.map((c) => c.id)), label: '', kleur, vorm: 'punt' as Vorm, uitleg: '' };
}

function nieuweVraag(bestaand: Vraag[]): Vraag {
	const alle = def.value.stappen.flatMap((s) => (s.type === 'vragen' ? s.vragen.map((v) => v.id) : [])).concat(bestaand.map((v) => v.id));
	return { id: uniekeSleutel(`vraag-${alle.length + 1}`, alle), type: 'keuze', label: '', verplicht: false, opties: [], min: 1, max: 5, minLabel: '', maxLabel: '' };
}

const optiesTekst = (v: Vraag) => v.opties.join('\n');
function zetOpties(v: Vraag, e: Event) {
	v.opties = (e.target as HTMLTextAreaElement).value.split('\n').map((o) => o.trim()).filter(Boolean);
}

// Planonderdelen: tekenen op de kaart of inlezen uit GeoJSON.
function tekenOnderdeel(stap: Extract<Stap, { type: 'reageren' }>, vorm: Vorm, bestaand?: Onderdeel) {
	if (!map) return;
	tekening.value?.annuleer();
	tekenVorm.value = vorm;
	tekenVoor.value = bestaand?.titel || 'nieuw planonderdeel';
	document.querySelector('.opzet-kaart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	tekening.value = startTekenen(
		map,
		vorm,
		bestaand?.kleur || '#224362',
		(n) => (tekenAantal.value = n),
		(geometrie: Geometrie | null) => {
			tekening.value = null;
			if (!geometrie) return;
			if (bestaand) {
				bestaand.geometrie = geometrie;
			} else {
				const id = uniekeSleutel(`onderdeel-${stap.onderdelen.length + 1}`, stap.onderdelen.map((o) => o.id));
				const kleur = CATEGORIEKLEUREN[stap.onderdelen.length % CATEGORIEKLEUREN.length];
				stap.onderdelen.push({ id, titel: '', tekst: '', kleur, geometrie });
				nextTick(() => {
					document.getElementById(`onderdeel-${stap.id}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
					document.querySelector<HTMLInputElement>(`#onderdeel-${stap.id}-${id} input`)?.focus({ preventScroll: true });
				});
			}
		},
	);
}

const importFout = ref('');
async function leesOnderdelenIn(stap: Extract<Stap, { type: 'reageren' }>, e: Event) {
	const invoer = e.target as HTMLInputElement;
	const bestand = invoer.files?.[0];
	invoer.value = '';
	importFout.value = '';
	if (!bestand) return;
	try {
		const objecten = leesGeojson(await bestand.text(), rdNaarWgs);
		if (!objecten.length) throw new Error('In dit bestand staan geen punten, lijnen of vlakken.');
		if (stap.onderdelen.length + objecten.length > 40) throw new Error('Een stap kan hoogstens 40 planonderdelen hebben.');
		for (const o of objecten) {
			const titel = naamUit(o.eigenschappen) || `Planonderdeel ${stap.onderdelen.length + 1}`;
			stap.onderdelen.push({ id: uniekeSleutel(maakSleutel(titel, 28), stap.onderdelen.map((x) => x.id)), titel, tekst: '', kleur: CATEGORIEKLEUREN[stap.onderdelen.length % CATEGORIEKLEUREN.length], geometrie: o.geometrie });
		}
		const alle = stap.onderdelen.map((o) => midden(o.geometrie));
		map?.fitBounds(L.latLngBounds(alle).pad(0.2), { maxZoom: 18 });
	} catch (fout) {
		importFout.value = fout instanceof SyntaxError ? 'Dit bestand is geen geldige GeoJSON.' : (fout as Error).message;
	}
}

function toonOnderdeel(o: Onderdeel) {
	if (!map) return;
	document.querySelector('.opzet-kaart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	if (o.geometrie.type === 'Point') map.setView(midden(o.geometrie), Math.max(map.getZoom(), 17));
	else map.fitBounds(L.geoJSON(o.geometrie as GeoJSON.GeoJsonObject).getBounds().pad(0.4), { maxZoom: 18 });
}

const vormNaam = (g: Geometrie) => ({ Point: 'punt', LineString: 'lijn', Polygon: 'vlak' })[g.type];
const tekenMinimum = computed(() => (tekenVorm.value === 'lijn' ? 2 : 3));
</script>

<template>
	<form class="opzet" novalidate @submit.prevent="bewaar">
		<section class="blok">
			<h2>Basis</h2>
			<div class="veld">
				<label for="titel">Naam van het traject</label>
				<input id="titel" v-model="werk.titel" type="text" maxlength="120" />
			</div>
			<div class="veld">
				<label for="slug">Webadres voor deelnemers</label>
				<input id="slug" v-model="werk.slug" type="text" maxlength="60" />
				<p class="hint">
					Link om te delen: <strong>{{ deelnemerLink }}</strong>
					<button type="button" class="tekstknop" @click="kopieerLink">{{ gekopieerd ? 'Gekopieerd' : 'Kopieer' }}</button>
				</p>
			</div>
			<fieldset class="veld">
				<legend>Status</legend>
				<label v-for="s in STATUSSEN" :key="s.id" class="keuze">
					<input v-model="werk.status" type="radio" name="status" :value="s.id" /><span><strong>{{ s.label }}</strong>. {{ s.uitleg }}</span>
				</label>
			</fieldset>
			<p><a :href="`#/p/${werk.slug}`" target="_blank" rel="noopener">Bekijk het traject als deelnemer</a> (opent de laatst opgeslagen versie)</p>
		</section>

		<section class="blok">
			<h2>Welkom</h2>
			<div class="veld">
				<label for="intro-kop">Kop</label>
				<input id="intro-kop" v-model="def.intro.kop" type="text" maxlength="120" />
			</div>
			<div class="veld">
				<label for="intro-tekst">Tekst</label>
				<textarea id="intro-tekst" v-model="def.intro.tekst" rows="5" maxlength="3000"></textarea>
				<p class="hint">Een lege regel begint een nieuwe alinea.</p>
			</div>
		</section>

		<section id="kaartdeel" class="blok">
			<h2>Kaart</h2>
			<p>Schuif en zoom naar het gebied van het traject en leg dat vast als startbeeld.</p>
			<div class="opzet-kaart">
				<KaartVlak :opzet="def.kaart" volg-opzet @klaar="kaartKlaar">
					<div v-if="tekening" class="tekenbalk" role="status">
						<p>
							<template v-if="tekenVorm === 'punt'">Klik op de kaart op de plek van {{ tekenVoor }}.</template>
							<template v-else>Klik op de kaart om het {{ tekenVorm === 'lijn' ? 'verloop' : 'gebied' }} van {{ tekenVoor }} te tekenen.</template>
						</p>
						<div class="tekenbalk-knoppen">
							<button v-if="tekenVorm !== 'punt'" type="button" class="knop knop-klein knop-oker" :disabled="tekenAantal < tekenMinimum" @click="tekening?.voltooi()">Klaar</button>
							<button v-if="tekenVorm !== 'punt' && tekenAantal > 0" type="button" class="knop knop-klein knop-stil" @click="tekening?.wisLaatste()">Punt terug</button>
							<button type="button" class="knop knop-klein knop-stil" @click="tekening?.annuleer()">Annuleren</button>
						</div>
					</div>
				</KaartVlak>
			</div>
			<button type="button" class="knop knop-stil ruimte" @click="neemUitsnede">Gebruik deze uitsnede als startbeeld</button>

			<h3>Ondergronden</h3>
			<p class="hint">Kies welke ondergronden deelnemers kunnen kiezen en met welke de kaart opent.</p>
			<div class="tabelkader">
				<table class="tabel compact">
					<thead>
						<tr>
							<th scope="col">Ondergrond</th>
							<th scope="col">Bron</th>
							<th scope="col">Aanbieden</th>
							<th scope="col">Start</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="k in BASISKAARTEN" :key="k.id">
							<th scope="row">{{ k.naam }}</th>
							<td>{{ k.groep }}</td>
							<td><input type="checkbox" :checked="def.kaart.basiskaarten.includes(k.id)" :aria-label="`${k.naam} aanbieden`" @change="wisselOndergrond(k.id)" /></td>
							<td><input v-model="def.kaart.standaard" type="radio" name="standaard" :value="k.id" :disabled="!def.kaart.basiskaarten.includes(k.id)" :aria-label="`Openen met ${k.naam}`" /></td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Kaartlagen</h3>
			<p class="hint">Leg je eigen plantekening over de kaart. Een GeoJSON-bestand uit QGIS mag in graden of in RD New staan. Bij een afbeelding (PNG, JPG of WebP) vul je daarna de hoekpunten in.</p>
			<ul v-if="def.kaart.lagen.length" class="rijen">
				<li v-for="(laag, nr) in def.kaart.lagen" :key="laag.id">
					<div class="rij-velden">
						<div class="veld breed">
							<label :for="`laag-${laag.id}`">Naam in de legenda</label>
							<input :id="`laag-${laag.id}`" v-model="laag.titel" type="text" maxlength="80" />
						</div>
						<div class="veld">
							<label :for="`dekking-${laag.id}`">Dekking</label>
							<input :id="`dekking-${laag.id}`" v-model.number="laag.dekking" type="range" min="0.1" max="1" step="0.1" />
						</div>
						<div v-if="laag.type === 'geojson'" class="veld">
							<span class="veldlabel">Kleur</span>
							<div class="kleuren">
								<button v-for="k in CATEGORIEKLEUREN" :key="k" type="button" :style="{ background: k }" :aria-pressed="laag.kleur === k" :aria-label="`Kleur ${k}`" @click="laag.kleur = k"></button>
							</div>
						</div>
					</div>
					<div v-if="laag.type === 'afbeelding'" class="rij-velden">
						<div class="veld breed">
							<label :for="`grenzen-${laag.id}`">Hoekpunten: west, zuid, oost, noord</label>
							<input :id="`grenzen-${laag.id}`" type="text" :value="grenzenTekst(laag)" @change="zetGrenzen(laag, $event)" />
							<p class="hint">Vier getallen met een spatie ertussen, in graden of in RD New (meters). Je vindt ze in QGIS bij de eigenschappen van de laag onder Bereik.</p>
						</div>
					</div>
					<div class="rij-acties">
						<span class="soort">{{ laag.type === 'geojson' ? 'GeoJSON' : 'Afbeelding' }}</span>
						<button type="button" class="tekstknop gevaar" @click="def.kaart.lagen.splice(nr, 1)">Verwijder kaartlaag</button>
					</div>
				</li>
			</ul>
			<label class="knop knop-stil ruimte bestandknop">Kaartlaag toevoegen<input type="file" accept=".geojson,.json,.png,.jpg,.jpeg,.webp" @change="voegLaagToe" /></label>
			<p v-if="laagFout" class="foutmelding" role="alert">{{ laagFout }}</p>
		</section>

		<section class="blok">
			<h2>Stappen</h2>
			<p>Deelnemers doorlopen de stappen in deze volgorde. Na de laatste stap volgt het afronden.</p>

			<article v-for="(stap, nr) in def.stappen" :id="`stap-${stap.id}`" :key="stap.id" class="stap">
				<header class="stap-kop">
					<p class="stap-soort">Stap {{ nr + 1 }}: {{ STAPNAMEN[stap.type] }}</p>
					<div class="stap-acties">
						<button type="button" class="tekstknop" :disabled="nr === 0" @click="verplaats(def.stappen, nr, -1)">Omhoog</button>
						<button type="button" class="tekstknop" :disabled="nr === def.stappen.length - 1" @click="verplaats(def.stappen, nr, 1)">Omlaag</button>
						<button type="button" class="tekstknop gevaar" @click="verwijderStap(nr)">Verwijder stap</button>
					</div>
				</header>
				<div class="veld">
					<label :for="`stap-titel-${stap.id}`">Titel</label>
					<input :id="`stap-titel-${stap.id}`" v-model="stap.titel" type="text" maxlength="120" />
				</div>
				<div class="veld">
					<label :for="`stap-tekst-${stap.id}`">Uitleg</label>
					<textarea :id="`stap-tekst-${stap.id}`" v-model="stap.tekst" rows="2" maxlength="3000"></textarea>
				</div>

				<!-- Tekenstap -->
				<template v-if="stap.type === 'tekenen'">
					<h3>Categorieën</h3>
					<ul class="rijen">
						<li v-for="(c, cnr) in stap.categorieen" :key="c.id">
							<div class="rij-velden">
								<span class="rij-boog" v-html="boogSvg(c.kleur)"></span>
								<div class="veld breed">
									<label :for="`cat-${stap.id}-${c.id}`">Naam</label>
									<input :id="`cat-${stap.id}-${c.id}`" v-model="c.label" type="text" maxlength="80" placeholder="Bijvoorbeeld: Fijne plek" />
								</div>
								<div class="veld">
									<label :for="`vorm-${stap.id}-${c.id}`">Vorm</label>
									<select :id="`vorm-${stap.id}-${c.id}`" v-model="c.vorm">
										<option v-for="(v, sleutel) in VORMEN" :key="sleutel" :value="sleutel">{{ v.label }}</option>
									</select>
								</div>
							</div>
							<div class="rij-velden">
								<div class="veld breed">
									<label :for="`uitleg-${stap.id}-${c.id}`">Korte uitleg (mag leeg blijven)</label>
									<input :id="`uitleg-${stap.id}-${c.id}`" v-model="c.uitleg" type="text" maxlength="300" />
								</div>
								<div class="veld">
									<span class="veldlabel">Kleur</span>
									<div class="kleuren">
										<button v-for="k in CATEGORIEKLEUREN" :key="k" type="button" :style="{ background: k }" :aria-pressed="c.kleur === k" :aria-label="`Kleur ${k}`" @click="c.kleur = k"></button>
									</div>
								</div>
							</div>
							<div class="rij-acties">
								<button type="button" class="tekstknop" :disabled="cnr === 0" @click="verplaats(stap.categorieen, cnr, -1)">Omhoog</button>
								<button type="button" class="tekstknop" :disabled="cnr === stap.categorieen.length - 1" @click="verplaats(stap.categorieen, cnr, 1)">Omlaag</button>
								<button type="button" class="tekstknop gevaar" @click="stap.categorieen.splice(cnr, 1)">Verwijder categorie</button>
							</div>
						</li>
					</ul>
					<button type="button" class="knop knop-stil ruimte" :disabled="stap.categorieen.length >= 12" @click="stap.categorieen.push(nieuweCategorie(stap.categorieen))">Categorie toevoegen</button>
				</template>

				<!-- Reageerstap -->
				<template v-else-if="stap.type === 'reageren'">
					<h3>Planonderdelen</h3>
					<p class="hint">Deelnemers geven per planonderdeel aan of zij het een goed idee vinden.</p>
					<ul v-if="stap.onderdelen.length" class="rijen">
						<li v-for="(o, onr) in stap.onderdelen" :id="`onderdeel-${stap.id}-${o.id}`" :key="o.id">
							<div class="rij-velden">
								<div class="veld breed">
									<label :for="`ond-titel-${stap.id}-${o.id}`">Titel</label>
									<input :id="`ond-titel-${stap.id}-${o.id}`" v-model="o.titel" type="text" maxlength="120" placeholder="Bijvoorbeeld: Nieuwe fietsbrug" />
								</div>
								<div class="veld">
									<span class="veldlabel">Kleur</span>
									<div class="kleuren">
										<button v-for="k in CATEGORIEKLEUREN" :key="k" type="button" :style="{ background: k }" :aria-pressed="o.kleur === k" :aria-label="`Kleur ${k}`" @click="o.kleur = k"></button>
									</div>
								</div>
							</div>
							<div class="veld">
								<label :for="`ond-tekst-${stap.id}-${o.id}`">Omschrijving</label>
								<textarea :id="`ond-tekst-${stap.id}-${o.id}`" v-model="o.tekst" rows="2" maxlength="1500"></textarea>
							</div>
							<div class="rij-acties">
								<span class="soort">Staat als {{ vormNaam(o.geometrie) }} op de kaart</span>
								<button type="button" class="tekstknop" @click="toonOnderdeel(o)">Toon op de kaart</button>
								<button type="button" class="tekstknop" @click="tekenOnderdeel(stap, ({ Point: 'punt', LineString: 'lijn', Polygon: 'vlak' } as const)[o.geometrie.type], o)">Teken opnieuw</button>
								<button type="button" class="tekstknop gevaar" @click="stap.onderdelen.splice(onr, 1)">Verwijder</button>
							</div>
						</li>
					</ul>
					<div class="knoppenrij">
						<button type="button" class="knop knop-stil" @click="tekenOnderdeel(stap, 'punt')">Punt tekenen</button>
						<button type="button" class="knop knop-stil" @click="tekenOnderdeel(stap, 'lijn')">Lijn tekenen</button>
						<button type="button" class="knop knop-stil" @click="tekenOnderdeel(stap, 'vlak')">Vlak tekenen</button>
						<label class="knop knop-stil bestandknop">GeoJSON inlezen<input type="file" accept=".geojson,.json" @change="leesOnderdelenIn(stap, $event)" /></label>
					</div>
					<p v-if="importFout" class="foutmelding" role="alert">{{ importFout }}</p>
				</template>

				<!-- Vragenstap -->
				<template v-else>
					<h3>Vragen</h3>
					<ul class="rijen">
						<li v-for="(v, vnr) in stap.vragen" :key="v.id">
							<div class="rij-velden">
								<div class="veld breed">
									<label :for="`vraag-${v.id}`">Vraag</label>
									<input :id="`vraag-${v.id}`" v-model="v.label" type="text" maxlength="300" />
								</div>
								<div class="veld">
									<label :for="`type-${v.id}`">Soort antwoord</label>
									<select :id="`type-${v.id}`" v-model="v.type">
										<option value="keuze">Eén keuze</option>
										<option value="meerkeuze">Meer keuzes</option>
										<option value="schaal">Schaal</option>
										<option value="tekst">Open tekst</option>
										<option value="getal">Getal</option>
									</select>
								</div>
							</div>
							<div v-if="v.type === 'keuze' || v.type === 'meerkeuze'" class="veld">
								<label :for="`opties-${v.id}`">Antwoordopties, één per regel</label>
								<textarea :id="`opties-${v.id}`" :value="optiesTekst(v)" rows="4" @change="zetOpties(v, $event)"></textarea>
							</div>
							<div v-else-if="v.type === 'schaal'" class="rij-velden">
								<div class="veld">
									<label :for="`min-${v.id}`">Van</label>
									<input :id="`min-${v.id}`" v-model.number="v.min" type="number" min="0" max="9" class="kort" />
								</div>
								<div class="veld">
									<label :for="`max-${v.id}`">Tot</label>
									<input :id="`max-${v.id}`" v-model.number="v.max" type="number" min="1" max="10" class="kort" />
								</div>
								<div class="veld breed">
									<label :for="`minl-${v.id}`">Betekenis laagste waarde</label>
									<input :id="`minl-${v.id}`" v-model="v.minLabel" type="text" maxlength="60" placeholder="Slecht" />
								</div>
								<div class="veld breed">
									<label :for="`maxl-${v.id}`">Betekenis hoogste waarde</label>
									<input :id="`maxl-${v.id}`" v-model="v.maxLabel" type="text" maxlength="60" placeholder="Uitstekend" />
								</div>
							</div>
							<div class="rij-acties">
								<label class="inline"><input v-model="v.verplicht" type="checkbox" /> Verplicht</label>
								<button type="button" class="tekstknop" :disabled="vnr === 0" @click="verplaats(stap.vragen, vnr, -1)">Omhoog</button>
								<button type="button" class="tekstknop" :disabled="vnr === stap.vragen.length - 1" @click="verplaats(stap.vragen, vnr, 1)">Omlaag</button>
								<button type="button" class="tekstknop gevaar" @click="stap.vragen.splice(vnr, 1)">Verwijder vraag</button>
							</div>
						</li>
					</ul>
					<button type="button" class="knop knop-stil ruimte" :disabled="stap.vragen.length >= 30" @click="stap.vragen.push(nieuweVraag(stap.vragen))">Vraag toevoegen</button>
				</template>
			</article>

			<div class="knoppenrij" :class="{ ruimte: def.stappen.length }">
				<button type="button" class="knop knop-stil" :disabled="def.stappen.length >= 12" @click="voegStapToe('tekenen')">Tekenstap toevoegen</button>
				<button type="button" class="knop knop-stil" :disabled="def.stappen.length >= 12" @click="voegStapToe('reageren')">Reageerstap toevoegen</button>
				<button type="button" class="knop knop-stil" :disabled="def.stappen.length >= 12" @click="voegStapToe('vragen')">Vragenstap toevoegen</button>
			</div>
		</section>

		<section class="blok">
			<h2>Over de deelnemer</h2>
			<p>Deze vragen komen bij het afronden en zijn voor de deelnemer nooit verplicht.</p>
			<label class="keuze"><input v-model="def.over_jou.postcode" type="checkbox" /><span>Postcode vragen</span></label>
			<label class="keuze"><input v-model="def.over_jou.leeftijd" type="checkbox" /><span>Leeftijdsgroep vragen</span></label>
			<label class="keuze"><input v-model="def.over_jou.email" type="checkbox" /><span>E-mailadres vragen, om te kunnen reageren</span></label>
		</section>

		<section class="blok">
			<h2>Privacy</h2>
			<div class="veld">
				<label for="privacy">Privacyverklaring</label>
				<textarea id="privacy" v-model="def.privacy.tekst" rows="9" maxlength="6000"></textarea>
				<p class="hint">Deelnemers moeten hiermee akkoord gaan voordat zij versturen.</p>
			</div>
			<div class="veld">
				<label for="bewaartermijn">Bewaartermijn in maanden na het sluiten</label>
				<input id="bewaartermijn" v-model.number="def.privacy.bewaartermijn_maanden" type="number" min="1" max="120" class="kort" />
				<p class="hint">Daarna wist Dialoogkaart vanzelf de e-mailadressen en de letters van de postcodes. De bijdragen op de kaart blijven staan.</p>
			</div>
		</section>

		<section class="blok">
			<h2>Bedankt</h2>
			<div class="veld">
				<label for="bedankt-kop">Kop</label>
				<input id="bedankt-kop" v-model="def.bedankt.kop" type="text" maxlength="120" />
			</div>
			<div class="veld">
				<label for="bedankt-tekst">Tekst</label>
				<textarea id="bedankt-tekst" v-model="def.bedankt.tekst" rows="3" maxlength="2000"></textarea>
			</div>
		</section>

		<div class="bewaarbalk">
			<p v-if="fout" class="bewaar-fout" role="alert">{{ fout }}</p>
			<p v-else-if="melding" role="status">{{ melding }}</p>
			<p v-else-if="gewijzigd">Er zijn wijzigingen die nog niet zijn opgeslagen.</p>
			<p v-else>Alles is opgeslagen.</p>
			<button type="submit" class="knop knop-oker" :disabled="bezig || !gewijzigd">{{ bezig ? 'Bezig met opslaan' : 'Opslaan' }}</button>
		</div>
	</form>
</template>
