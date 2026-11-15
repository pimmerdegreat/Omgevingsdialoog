<script setup lang="ts">
// Het deelnemersdeel: welkom, de stappen van het traject, afronden en bedankt.
import L from 'leaflet';
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { boogSvg } from '../../../gedeeld/boog.js';
import { LEEFTIJDEN, OORDELEN, VORMEN } from '../../../gedeeld/constanten.js';
import { ApiFout, haalTraject, verstuurInzending } from '../api';
import logo from '../../../gedeeld/buro-sro.png';
import { midden } from '../kaart/geo';
import KaartVlak from '../kaart/KaartVlak.vue';
import { startTekenen, type Tekening } from '../kaart/tekenen';
import type { Bijdrage, Categorie, Geometrie, Inzending, Onderdeel, Oordeel, PubliekTraject, Reactie, Stap, Vraag } from '../types';

const route = useRoute();
const slug = String(route.params.slug);
const opslagSleutel = `dialoogkaart:concept:${slug}`;

const traject = ref<PubliekTraject | null>(null);
const fase = ref<'laden' | 'fout' | 'bezig' | 'verzonden'>('laden');
const foutmelding = ref('');

// -1 = welkom, 0 t/m n-1 = de stappen van het traject, n = afronden.
const stapNr = ref(-1);
const bijdragen = ref<Bijdrage[]>([]);
const reacties = ref<Record<string, Reactie>>({});
const antwoorden = ref<Record<string, unknown>>({});
const persoon = reactive({ postcode: '', leeftijd: '', email: '', op_de_hoogte: false, akkoord: false, website: '' });

const bewerk = ref<string | null>(null);
const gekozenOnderdeel = ref<string | null>(null);
const stapFout = ref('');
const verstuurFout = ref('');
const bezigMetVersturen = ref(false);
const paneel = ref<HTMLElement | null>(null);
const zijpaneel = ref<HTMLElement | null>(null);

const def = computed(() => traject.value!.definitie);
const stappen = computed<Stap[]>(() => traject.value?.definitie.stappen ?? []);
const stap = computed<Stap | null>(() => stappen.value[stapNr.value] ?? null);
const aantalStappen = computed(() => stappen.value.length + 1);
const gesloten = computed(() => traject.value?.status === 'gesloten');
const kaartGroot = computed(() => stap.value?.type === 'tekenen' || stap.value?.type === 'reageren');
const vraagtPersoon = computed(() => {
	const o = traject.value?.definitie.over_jou;
	return Boolean(o && (o.postcode || o.leeftijd || o.email));
});

const alineas = (tekst: string) => tekst.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);

// ---- Laden en tussentijds bewaren in de browser ----

haalTraject(slug)
	.then((t) => {
		traject.value = t;
		document.title = `${t.titel} | ${t.organisatie.naam}`;
		try {
			const bewaard = JSON.parse(localStorage.getItem(opslagSleutel) || 'null');
			if (bewaard && t.status === 'open') {
				const stapIds = new Set(t.definitie.stappen.map((s) => s.id));
				bijdragen.value = (bewaard.bijdragen || []).filter((b: Bijdrage) => stapIds.has(b.stap_id));
				reacties.value = bewaard.reacties || {};
				antwoorden.value = bewaard.antwoorden || {};
			}
		} catch {
			// Onleesbare bewaarde gegevens: gewoon opnieuw beginnen.
		}
		fase.value = 'bezig';
	})
	.catch((fout) => {
		foutmelding.value = fout instanceof ApiFout && fout.status === 404 ? 'Dit traject bestaat niet of is nog niet geopend.' : fout.message;
		fase.value = 'fout';
	});

watch(
	[bijdragen, reacties, antwoorden],
	() => {
		if (fase.value !== 'bezig') return;
		try {
			localStorage.setItem(opslagSleutel, JSON.stringify({ bijdragen: bijdragen.value, reacties: reacties.value, antwoorden: antwoorden.value }));
		} catch {
			// Geen opslag beschikbaar (privévenster): de inzending werkt nog steeds.
		}
	},
	{ deep: true },
);

// ---- Kaart ----

let map: L.Map | null = null;
let eigenLaag: L.LayerGroup | null = null;
let planLaag: L.LayerGroup | null = null;

function categorieVan(b: Bijdrage): Categorie | null {
	const s = stappen.value.find((x) => x.id === b.stap_id);
	return s?.type === 'tekenen' ? (s.categorieen.find((c) => c.id === b.categorie_id) ?? null) : null;
}

function tekenEigenBijdragen() {
	if (!map || !eigenLaag) return;
	eigenLaag.clearLayers();
	for (const b of bijdragen.value) {
		const categorie = categorieVan(b);
		if (!categorie) continue;
		const actief = bewerk.value === b.lokaal;
		let laag: L.Layer;
		if (b.geometrie.type === 'Point') {
			const marker = L.marker([b.geometrie.coordinates[1], b.geometrie.coordinates[0]], {
				icon: L.divIcon({ className: `dk-marker${actief ? ' gekozen' : ''}`, html: boogSvg(categorie.kleur), iconSize: [28, 37], iconAnchor: [14, 36] }),
				draggable: fase.value === 'bezig',
				title: categorie.label,
			});
			marker.on('dragend', () => {
				const plek = marker.getLatLng();
				b.geometrie = { type: 'Point', coordinates: [Math.round(plek.lng * 1e6) / 1e6, Math.round(plek.lat * 1e6) / 1e6] };
			});
			laag = marker;
		} else {
			laag = L.geoJSON(b.geometrie as GeoJSON.GeoJsonObject, {
				style: { color: categorie.kleur, weight: actief ? 6 : 4, fillColor: categorie.kleur, fillOpacity: 0.25 },
			});
		}
		laag.on('click', () => kiesBijdrage(b.lokaal));
		laag.addTo(eigenLaag);
	}
}

function tekenPlanonderdelen() {
	if (!map || !planLaag) return;
	planLaag.clearLayers();
	const s = stap.value;
	if (s?.type !== 'reageren') return;
	for (const o of s.onderdelen) {
		const actief = gekozenOnderdeel.value === o.id;
		const stijl = { color: o.kleur, weight: actief ? 7 : 4, dashArray: actief ? undefined : '8 7', fillColor: o.kleur, fillOpacity: actief ? 0.4 : 0.2 };
		const laag =
			o.geometrie.type === 'Point'
				? L.circleMarker([o.geometrie.coordinates[1], o.geometrie.coordinates[0]], { ...stijl, radius: actief ? 17 : 14 })
				: L.geoJSON(o.geometrie as GeoJSON.GeoJsonObject, { style: stijl });
		laag.bindTooltip(o.titel, { direction: 'top', sticky: true });
		laag.on('click', () => kiesOnderdeel(o, false));
		laag.addTo(planLaag);
	}
}

const breedScherm = () => window.matchMedia('(min-width: 900px)').matches;

/** Hoeveel van de kaart het zwevende paneel afdekt: links op een breed scherm, onderaan op een telefoon. */
function afgedekt(): { links: number; onder: number } {
	const el = zijpaneel.value;
	if (!el) return { links: 0, onder: 0 };
	if (breedScherm()) return { links: el.offsetLeft + el.offsetWidth, onder: 0 };
	return { links: 0, onder: el.offsetHeight };
}

/** Brengt een gebied in beeld in het deel van de kaart dat niet achter het paneel ligt. */
function toonOpKaart(grenzen: L.LatLngBounds, maxZoom = 18) {
	if (!map) return;
	const { links, onder } = afgedekt();
	map.fitBounds(grenzen, { paddingTopLeft: [links + 32, 80], paddingBottomRight: [72, onder + 32], maxZoom });
}

function kaartKlaar(m: L.Map) {
	map = m;
	planLaag = L.layerGroup().addTo(m);
	eigenLaag = L.layerGroup().addTo(m);
	tekenEigenBijdragen();
	tekenPlanonderdelen();
	// Het startbeeld midden in het zichtbare deel van de kaart zetten, naast of boven het paneel.
	nextTick(() => {
		const { links, onder } = afgedekt();
		m.panBy([-links / 2, onder / 2], { animate: false });
	});
}

watch([bijdragen, bewerk], tekenEigenBijdragen, { deep: true });
watch([stapNr, gekozenOnderdeel], tekenPlanonderdelen);

// Bij een stap met planonderdelen: breng ze allemaal in beeld.
watch(stapNr, () => {
	const s = stap.value;
	if (!map || s?.type !== 'reageren') return;
	const grenzen = L.latLngBounds(s.onderdelen.map((o) => midden(o.geometrie)));
	for (const o of s.onderdelen) if (o.geometrie.type !== 'Point') grenzen.extend(L.geoJSON(o.geometrie as GeoJSON.GeoJsonObject).getBounds());
	nextTick(() => {
		map?.invalidateSize();
		toonOpKaart(grenzen.pad(0.1));
	});
});

function toonInPaneel(id: string) {
	nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
}

// ---- Tekenen ----

const tekening = ref<Tekening | null>(null);
const tekenCategorie = ref<Categorie | null>(null);
const tekenAantal = ref(0);

function begin(categorie: Categorie) {
	if (!map || stap.value?.type !== 'tekenen') return;
	tekening.value?.annuleer();
	bewerk.value = null;
	const stapId = stap.value.id;
	tekenCategorie.value = categorie;
	tekening.value = startTekenen(
		map,
		categorie.vorm,
		categorie.kleur,
		(n) => (tekenAantal.value = n),
		(geometrie: Geometrie | null) => {
			tekening.value = null;
			tekenCategorie.value = null;
			if (!geometrie) return;
			const lokaal = `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
			bijdragen.value.push({ lokaal, stap_id: stapId, categorie_id: categorie.id, toelichting: '', geometrie });
			bewerk.value = lokaal;
			toonInPaneel(`bijdrage-${lokaal}`);
			nextTick(() => document.querySelector<HTMLTextAreaElement>(`#bijdrage-${lokaal} textarea`)?.focus({ preventScroll: true }));
		},
	);
}

const tekenHulp = computed(() => {
	const c = tekenCategorie.value;
	if (!c) return '';
	if (c.vorm === 'punt') return 'Klik op de kaart op de plek die je bedoelt.';
	const wat = c.vorm === 'lijn' ? 'lijn' : 'vlak';
	const nodig = c.vorm === 'lijn' ? 2 : 3;
	if (tekenAantal.value < nodig) return `Klik op de kaart om je ${wat} te tekenen. Zet minstens ${nodig} punten.`;
	return `Klik verder, of kies Klaar om je ${wat} af te ronden.`;
});

function kiesBijdrage(lokaal: string) {
	if (tekening.value) return;
	bewerk.value = lokaal;
	const b = bijdragen.value.find((x) => x.lokaal === lokaal);
	if (b && stappen.value[stapNr.value]?.id !== b.stap_id) {
		const nr = stappen.value.findIndex((s) => s.id === b.stap_id);
		if (nr >= 0 && fase.value === 'bezig') stapNr.value = nr;
	}
	toonInPaneel(`bijdrage-${lokaal}`);
}

function verwijderBijdrage(lokaal: string) {
	bijdragen.value = bijdragen.value.filter((b) => b.lokaal !== lokaal);
	if (bewerk.value === lokaal) bewerk.value = null;
}

const bijdragenVanStap = computed(() => (stap.value ? bijdragen.value.filter((b) => b.stap_id === stap.value!.id) : []));

// ---- Reageren op planonderdelen ----

const reactieSleutel = (o: Onderdeel) => `${stap.value!.id}/${o.id}`;

function kiesOnderdeel(o: Onderdeel, zoom: boolean) {
	gekozenOnderdeel.value = o.id;
	toonInPaneel(`onderdeel-${o.id}`);
	if (zoom && map) {
		const grenzen = o.geometrie.type === 'Point' ? L.latLng(midden(o.geometrie)).toBounds(160) : L.geoJSON(o.geometrie as GeoJSON.GeoJsonObject).getBounds().pad(0.3);
		toonOpKaart(grenzen, Math.max(map.getZoom(), 17));
	}
}

function oordeel(o: Onderdeel, waarde: Oordeel) {
	const sleutel = reactieSleutel(o);
	const huidig = reacties.value[sleutel];
	if (huidig?.oordeel === waarde) delete reacties.value[sleutel];
	else reacties.value[sleutel] = { oordeel: waarde, toelichting: huidig?.toelichting || '' };
	gekozenOnderdeel.value = o.id;
}

// ---- Vragen ----

function wisselKeuze(vraag: Vraag, optie: string) {
	const huidig = Array.isArray(antwoorden.value[vraag.id]) ? [...(antwoorden.value[vraag.id] as string[])] : [];
	const plek = huidig.indexOf(optie);
	if (plek >= 0) huidig.splice(plek, 1);
	else huidig.push(optie);
	if (huidig.length) antwoorden.value[vraag.id] = huidig;
	else delete antwoorden.value[vraag.id];
}

const schaal = (v: Vraag) => Array.from({ length: v.max - v.min + 1 }, (_, i) => v.min + i);

function isLeeg(waarde: unknown) {
	return waarde === undefined || waarde === null || waarde === '' || (Array.isArray(waarde) && !waarde.length);
}

// ---- Bladeren ----

function naar(nr: number) {
	tekening.value?.annuleer();
	stapFout.value = '';
	const huidig = stap.value;
	if (nr > stapNr.value && huidig?.type === 'vragen') {
		const open = huidig.vragen.find((v) => v.verplicht && isLeeg(antwoorden.value[v.id]));
		if (open) {
			stapFout.value = `Deze vraag is verplicht: ${open.label}`;
			toonInPaneel(`vraag-${open.id}`);
			return;
		}
	}
	bewerk.value = null;
	gekozenOnderdeel.value = null;
	stapNr.value = nr;
	nextTick(() => {
		paneel.value?.scrollTo({ top: 0 });
		paneel.value?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
	});
}

// ---- Versturen ----

const samenvatting = computed(() => {
	const delen: string[] = [];
	const n = bijdragen.value.length;
	const r = Object.keys(reacties.value).length;
	const a = Object.values(antwoorden.value).filter((w) => !isLeeg(w)).length;
	if (n) delen.push(`${n} ${n === 1 ? 'bijdrage' : 'bijdragen'} op de kaart`);
	if (r) delen.push(`${r} ${r === 1 ? 'oordeel' : 'oordelen'} over de voorstellen`);
	if (a) delen.push(`${a} ${a === 1 ? 'antwoord' : 'antwoorden'}`);
	if (!delen.length) return '';
	return delen.length === 1 ? delen[0] : `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`;
});

async function verstuur() {
	verstuurFout.value = '';
	if (!samenvatting.value) {
		verstuurFout.value = 'Je hebt nog niets ingevuld. Ga terug en zet iets op de kaart of beantwoord een vraag.';
		return;
	}
	if (!persoon.akkoord) {
		verstuurFout.value = 'Vink aan dat je akkoord gaat met de privacyverklaring.';
		return;
	}
	const inzending: Inzending = {
		bijdragen: bijdragen.value.map(({ lokaal: _lokaal, ...rest }) => rest),
		reacties: Object.entries(reacties.value).map(([sleutel, r]) => {
			const [stap_id, onderdeel_id] = sleutel.split('/');
			return { stap_id, onderdeel_id, oordeel: r.oordeel, toelichting: r.toelichting };
		}),
		antwoorden: antwoorden.value,
		postcode: persoon.postcode,
		leeftijd: persoon.leeftijd,
		email: persoon.email,
		op_de_hoogte: persoon.op_de_hoogte,
		akkoord: persoon.akkoord,
		mobiel: window.matchMedia('(max-width: 899px)').matches,
		website: persoon.website,
	};
	bezigMetVersturen.value = true;
	try {
		await verstuurInzending(slug, inzending);
		fase.value = 'verzonden';
		localStorage.removeItem(opslagSleutel);
		tekenEigenBijdragen();
		nextTick(() => paneel.value?.scrollTo({ top: 0 }));
	} catch (fout) {
		verstuurFout.value = (fout as Error).message;
	} finally {
		bezigMetVersturen.value = false;
	}
}

onBeforeUnmount(() => tekening.value?.annuleer());
</script>

<template>
	<div v-if="fase === 'laden'" class="melding-scherm"><p>De kaart wordt geladen.</p></div>

	<div v-else-if="fase === 'fout'" class="melding-scherm">
		<img :src="logo" alt="Buro SRO" width="132" />
		<h1>Hier is niets te vinden</h1>
		<p>{{ foutmelding }}</p>
	</div>

	<div v-else-if="traject" class="meedoen" :class="{ 'kaart-groot': kaartGroot, tekent: tekenCategorie }">
		<KaartVlak :opzet="def.kaart" @klaar="kaartKlaar">
			<div v-if="tekenCategorie" class="tekenbalk" role="status">
				<p><span v-html="boogSvg(tekenCategorie.kleur, 'boog-klein')"></span>{{ tekenHulp }}</p>
				<div class="tekenbalk-knoppen">
					<button v-if="tekenCategorie.vorm !== 'punt'" type="button" class="knop knop-klein knop-oker" :disabled="tekenAantal < (tekenCategorie.vorm === 'lijn' ? 2 : 3)" @click="tekening?.voltooi()">Klaar</button>
					<button v-if="tekenCategorie.vorm !== 'punt' && tekenAantal > 0" type="button" class="knop knop-klein knop-stil" @click="tekening?.wisLaatste()">Punt terug</button>
					<button type="button" class="knop knop-klein knop-stil" @click="tekening?.annuleer()">Annuleren</button>
				</div>
			</div>
		</KaartVlak>

		<section ref="zijpaneel" class="zijpaneel" aria-label="Meedoen">
		<header class="balk">
			<a :href="traject.organisatie.website" class="balk-logo"><img :src="logo" :alt="traject.organisatie.naam" width="877" height="400" /></a>
			<p class="balk-titel">{{ traject.titel }}</p>
			<span v-if="traject.voorbeeld" class="voorbeeld-label">Voorbeeld</span>
		</header>

		<main ref="paneel" class="paneel">
			<!-- Gesloten traject -->
			<section v-if="gesloten">
				<h1 tabindex="-1">Dit traject is gesloten</h1>
				<p>Meedoen kan niet meer. Dank aan iedereen die een bijdrage heeft geleverd.</p>
				<p>Vragen? Mail naar <a :href="`mailto:${traject.organisatie.email}`">{{ traject.organisatie.email }}</a>.</p>
			</section>

			<!-- Bedankt -->
			<section v-else-if="fase === 'verzonden'">
				<h1 tabindex="-1">{{ def.bedankt.kop }}</h1>
				<p v-for="a in alineas(def.bedankt.tekst)" :key="a">{{ a }}</p>
				<p>Je hebt {{ samenvatting }} ingezonden.</p>
			</section>

			<!-- Welkom -->
			<section v-else-if="stapNr === -1">
				<h1 tabindex="-1">{{ def.intro.kop }}</h1>
				<p v-for="a in alineas(def.intro.tekst)" :key="a">{{ a }}</p>
				<p v-if="bijdragen.length || Object.keys(antwoorden).length" class="notitie">Je was al begonnen. Wat je eerder invulde staat er nog.</p>
			</section>

			<!-- Tekenen -->
			<section v-else-if="stap?.type === 'tekenen'">
				<h1 tabindex="-1">{{ stap.titel }}</h1>
				<p v-for="a in alineas(stap.tekst)" :key="a">{{ a }}</p>
				<ul class="categorieen">
					<li v-for="c in stap.categorieen" :key="c.id">
						<button type="button" class="categorie" :class="{ actief: tekenCategorie?.id === c.id }" @click="begin(c)">
							<span v-html="boogSvg(c.kleur)"></span>
							<span class="categorie-tekst"><strong>{{ c.label }}</strong><span v-if="c.uitleg">{{ c.uitleg }}</span></span>
							<span class="categorie-actie">{{ VORMEN[c.vorm].actie }}</span>
						</button>
					</li>
				</ul>

				<template v-if="bijdragenVanStap.length">
					<h2>Jouw bijdragen</h2>
					<ul class="eigen">
						<li v-for="b in bijdragenVanStap" :id="`bijdrage-${b.lokaal}`" :key="b.lokaal" :class="{ open: bewerk === b.lokaal }">
							<div class="eigen-kop">
								<span v-html="boogSvg(categorieVan(b)?.kleur || '#224362', 'boog-klein')"></span>
								<button type="button" class="eigen-titel" @click="kiesBijdrage(b.lokaal)">
									<strong>{{ categorieVan(b)?.label }}</strong>
									<span v-if="bewerk !== b.lokaal">{{ b.toelichting || 'Zonder toelichting' }}</span>
								</button>
								<button type="button" class="tekstknop" @click="verwijderBijdrage(b.lokaal)">Verwijder</button>
							</div>
							<div v-if="bewerk === b.lokaal" class="eigen-bewerk">
								<label :for="`toel-${b.lokaal}`">Toelichting</label>
								<textarea :id="`toel-${b.lokaal}`" v-model="b.toelichting" rows="3" maxlength="2000" placeholder="Wat wil je over deze plek kwijt?"></textarea>
								<p v-if="b.geometrie.type === 'Point'" class="hint">Je kunt de markering op de kaart verslepen.</p>
								<button type="button" class="knop knop-klein" @click="bewerk = null">Bewaren</button>
							</div>
						</li>
					</ul>
				</template>
			</section>

			<!-- Reageren op planonderdelen -->
			<section v-else-if="stap?.type === 'reageren'">
				<h1 tabindex="-1">{{ stap.titel }}</h1>
				<p v-for="a in alineas(stap.tekst)" :key="a">{{ a }}</p>
				<ul class="onderdelen">
					<li v-for="o in stap.onderdelen" :id="`onderdeel-${o.id}`" :key="o.id" :class="{ gekozen: gekozenOnderdeel === o.id }">
						<h2>
							<button type="button" class="onderdeel-titel" @click="kiesOnderdeel(o, true)"><span class="kleurvlak" :style="{ background: o.kleur }"></span>{{ o.titel }}</button>
						</h2>
						<p v-if="o.tekst">{{ o.tekst }}</p>
						<div class="oordelen" role="group" :aria-label="`Jouw oordeel over ${o.titel}`">
							<button v-for="x in OORDELEN" :key="x.id" type="button" :data-oordeel="x.id" :aria-pressed="reacties[reactieSleutel(o)]?.oordeel === x.id" :style="{ '--kleur': x.kleur }" @click="oordeel(o, x.id as Oordeel)">
								{{ x.label }}
							</button>
						</div>
						<div v-if="reacties[reactieSleutel(o)]" class="veld">
							<label :for="`reactie-${o.id}`">Toelichting (mag je overslaan)</label>
							<textarea :id="`reactie-${o.id}`" v-model="reacties[reactieSleutel(o)].toelichting" rows="2" maxlength="2000"></textarea>
						</div>
					</li>
				</ul>
			</section>

			<!-- Vragen -->
			<section v-else-if="stap?.type === 'vragen'">
				<h1 tabindex="-1">{{ stap.titel }}</h1>
				<p v-for="a in alineas(stap.tekst)" :key="a">{{ a }}</p>
				<div v-for="v in stap.vragen" :id="`vraag-${v.id}`" :key="v.id" class="vraag">
					<fieldset v-if="v.type === 'keuze' || v.type === 'meerkeuze' || v.type === 'schaal'">
						<legend>{{ v.label }} <span v-if="v.verplicht" class="verplicht">verplicht</span></legend>
						<p v-if="v.type === 'meerkeuze'" class="hint">Je kunt meer antwoorden kiezen.</p>
						<template v-if="v.type === 'keuze'">
							<label v-for="optie in v.opties" :key="optie" class="keuze"><input v-model="antwoorden[v.id]" type="radio" :name="v.id" :value="optie" /><span>{{ optie }}</span></label>
						</template>
						<template v-else-if="v.type === 'meerkeuze'">
							<label v-for="optie in v.opties" :key="optie" class="keuze">
								<input type="checkbox" :checked="Array.isArray(antwoorden[v.id]) && (antwoorden[v.id] as string[]).includes(optie)" @change="wisselKeuze(v, optie)" /><span>{{ optie }}</span>
							</label>
						</template>
						<template v-else>
							<div class="schaal" :style="{ '--aantal': v.max - v.min + 1 }">
								<label v-for="n in schaal(v)" :key="n"><input v-model="antwoorden[v.id]" type="radio" :name="v.id" :value="n" /><span>{{ n }}</span></label>
							</div>
							<p v-if="v.minLabel || v.maxLabel" class="schaal-labels"><span>{{ v.minLabel }}</span><span>{{ v.maxLabel }}</span></p>
						</template>
					</fieldset>
					<div v-else class="veld">
						<label :for="`invoer-${v.id}`">{{ v.label }} <span v-if="v.verplicht" class="verplicht">verplicht</span></label>
						<textarea v-if="v.type === 'tekst'" :id="`invoer-${v.id}`" v-model="antwoorden[v.id] as string" rows="4" maxlength="4000"></textarea>
						<input v-else :id="`invoer-${v.id}`" v-model.number="antwoorden[v.id]" type="number" inputmode="decimal" />
					</div>
				</div>
			</section>

			<!-- Afronden -->
			<section v-else>
				<h1 tabindex="-1">Tot slot</h1>
				<p v-if="samenvatting">Je verstuurt {{ samenvatting }}.</p>
				<p v-else class="notitie">Je hebt nog niets ingevuld. Ga terug om iets op de kaart te zetten of een vraag te beantwoorden.</p>

				<template v-if="vraagtPersoon">
					<p>De vragen hieronder mag je overslaan. Ze helpen ons te zien of we de hele buurt bereiken.</p>
					<div v-if="def.over_jou.postcode" class="veld">
						<label for="postcode">Postcode</label>
						<input id="postcode" v-model="persoon.postcode" type="text" autocomplete="postal-code" maxlength="7" placeholder="3525 AA" class="kort" />
					</div>
					<div v-if="def.over_jou.leeftijd" class="veld">
						<label for="leeftijd">Leeftijd</label>
						<select id="leeftijd" v-model="persoon.leeftijd">
							<option value="">Zeg ik liever niet</option>
							<option v-for="l in LEEFTIJDEN" :key="l.id" :value="l.id">{{ l.label }}</option>
						</select>
					</div>
					<div v-if="def.over_jou.email" class="veld">
						<label for="email">E-mailadres</label>
						<input id="email" v-model="persoon.email" type="email" autocomplete="email" maxlength="254" placeholder="naam@voorbeeld.nl" />
						<p class="hint">Alleen nodig als je een reactie van {{ traject.organisatie.naam }} wilt kunnen krijgen.</p>
						<label v-if="persoon.email" class="keuze"><input v-model="persoon.op_de_hoogte" type="checkbox" /><span>Houd mij op de hoogte van dit traject</span></label>
					</div>
				</template>

				<!-- Lokveld tegen geautomatiseerde inzendingen; mensen zien dit niet. -->
				<div class="niet-invullen" aria-hidden="true"><label>Website <input v-model="persoon.website" type="text" tabindex="-1" autocomplete="off" /></label></div>

				<details class="privacy">
					<summary>Lees de privacyverklaring</summary>
					<p v-for="a in alineas(def.privacy.tekst)" :key="a">{{ a }}</p>
				</details>
				<label class="keuze akkoord"><input v-model="persoon.akkoord" type="checkbox" /><span>Ik ga akkoord met de privacyverklaring</span></label>
				<p v-if="verstuurFout" class="foutmelding" role="alert">{{ verstuurFout }}</p>
			</section>

			<p v-if="stapFout" class="foutmelding" role="alert">{{ stapFout }}</p>
		</main>

		<footer v-if="!gesloten && fase === 'bezig'" class="stapbalk">
			<div v-if="stapNr >= 0" class="voortgang" role="img" :aria-label="`Stap ${stapNr + 1} van ${aantalStappen}`">
				<span v-for="n in aantalStappen" :key="n" :class="{ gedaan: n <= stapNr + 1 }"></span>
			</div>
			<p v-if="stapNr >= 0" class="stapteller">Stap {{ stapNr + 1 }} van {{ aantalStappen }}</p>
			<div class="stapknoppen">
				<button v-if="stapNr >= 0" type="button" class="knop knop-stil" @click="naar(stapNr - 1)">Vorige</button>
				<button v-if="stapNr === -1" type="button" class="knop" @click="naar(0)">Begin</button>
				<button v-else-if="stapNr < stappen.length" type="button" class="knop" @click="naar(stapNr + 1)">Volgende</button>
				<button v-else type="button" class="knop" :disabled="bezigMetVersturen" @click="verstuur">{{ bezigMetVersturen ? 'Bezig met versturen' : 'Versturen' }}</button>
			</div>
		</footer>
		</section>
	</div>
</template>
