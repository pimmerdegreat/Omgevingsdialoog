<script setup lang="ts">
// Eén traject in beheer: resultaten, opzet, inzendingen en de bestanden voor QGIS.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LEEFTIJDEN, STATUSSEN } from '../../../gedeeld/constanten.js';
import { ApiFout, beheer, DEMO } from '../api';
import type { InzendingRegel, Traject } from '../types';
import BeheerKop from './BeheerKop.vue';
import { datumTijd, getal } from './hulp';
import Opzet from './Opzet.vue';

type Tab = 'resultaten' | 'opzet' | 'inzendingen' | 'qgis';
const TABS: { id: Tab; label: string }[] = [
	{ id: 'resultaten', label: 'Resultaten' },
	{ id: 'opzet', label: 'Opzet' },
	{ id: 'inzendingen', label: 'Inzendingen' },
	{ id: 'qgis', label: 'QGIS en export' },
];

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);

const traject = ref<Traject | null>(null);
const inzendingen = ref<InzendingRegel[]>([]);
const qgis = ref<Awaited<ReturnType<typeof beheer.qgis>> | null>(null);
const fout = ref('');
const rapportVersie = ref(0);

const tab = computed<Tab>(() => (TABS.some((t) => t.id === route.query.tab) ? (route.query.tab as Tab) : 'resultaten'));
const statusLabel = computed(() => STATUSSEN.find((s) => s.id === traject.value?.status)?.label);
const leeftijd = (sleutel: string | null) => LEEFTIJDEN.find((l) => l.id === sleutel)?.label || '';
const aantalBijdragen = computed(() => inzendingen.value.reduce((s, i) => s + i.bijdragen, 0));
const metEmail = computed(() => inzendingen.value.filter((i) => i.email).length);
const servernaam = location.hostname;

async function laad() {
	try {
		[traject.value, inzendingen.value, qgis.value] = await Promise.all([beheer.traject(id), beheer.inzendingen(id), beheer.qgis()]);
		document.title = `${traject.value.titel} | Beheer`;
	} catch (e) {
		if (e instanceof ApiFout && e.status === 401) router.replace('/beheer');
		else fout.value = (e as Error).message;
	}
}

async function verwijderInzending(i: InzendingRegel) {
	if (!window.confirm(`De inzending van ${datumTijd(i.ingediend)} verwijderen? Ook de bijdragen op de kaart van deze deelnemer verdwijnen. Dit kan niet ongedaan worden gemaakt.`)) return;
	try {
		await beheer.verwijderInzending(id, i.id);
		inzendingen.value = inzendingen.value.filter((x) => x.id !== i.id);
		rapportVersie.value++;
	} catch (e) {
		fout.value = (e as Error).message;
	}
}

async function verwijderTraject() {
	if (!traject.value) return;
	const antwoord = window.prompt(`Het traject "${traject.value.titel}" met alle ${inzendingen.value.length} inzendingen verwijderen? Dit kan niet ongedaan worden gemaakt. Typ het woord verwijder om door te gaan.`);
	if (antwoord?.trim().toLowerCase() !== 'verwijder') return;
	try {
		await beheer.verwijder(id);
		router.replace('/beheer');
	} catch (e) {
		fout.value = (e as Error).message;
	}
}

watch(tab, (nieuw) => {
	if (nieuw === 'resultaten' || nieuw === 'inzendingen') beheer.inzendingen(id).then((lijst) => (inzendingen.value = lijst)).catch(() => null);
});

onMounted(laad);
</script>

<template>
	<div class="beheer">
		<BeheerKop ingelogd />
		<main class="beheer-inhoud">
			<p v-if="fout" class="foutmelding" role="alert">{{ fout }}</p>
			<p v-if="!traject && !fout">Bezig met laden.</p>

			<template v-if="traject">
				<p class="kruimel"><RouterLink to="/beheer">Alle trajecten</RouterLink></p>
				<h1>{{ traject.titel }}</h1>
				<p class="kopregel">
					<span class="status" :data-status="traject.status">{{ statusLabel }}</span>
					<span>{{ getal(inzendingen.length) }} {{ inzendingen.length === 1 ? 'deelnemer' : 'deelnemers' }}</span>
					<span>{{ getal(aantalBijdragen) }} {{ aantalBijdragen === 1 ? 'bijdrage' : 'bijdragen' }} op de kaart</span>
					<span v-if="traject.voorbeeld">Voorbeelddata</span>
				</p>

				<nav class="tabs" aria-label="Onderdelen van dit traject">
					<RouterLink v-for="t in TABS" :key="t.id" :to="{ query: { tab: t.id } }" :aria-current="tab === t.id ? 'page' : undefined">{{ t.label }}</RouterLink>
				</nav>

				<!-- Resultaten -->
				<section v-if="tab === 'resultaten'">
					<p v-if="DEMO && traject.voorbeeld" class="notitie">In de demo toont het rapport de voorbeelddata. Wat je zelf in de demo invult, staat er niet in; op de echte server wel.</p>
					<p v-if="DEMO && !beheer.rapportUrl(id)" class="notitie">In de demo is er alleen een rapport van het voorbeeldtraject. Op de echte server maakt Dialoogkaart het rapport van elk traject.</p>
					<div v-if="inzendingen.length && beheer.rapportUrl(id)" class="knoppenrij">
						<a class="knop" :href="beheer.rapportUrl(id, true)" download>Download het rapport voor je klant</a>
						<a class="knop knop-stil" :href="beheer.rapportUrl(id)" target="_blank" rel="noopener">Open het rapport in een nieuw tabblad</a>
					</div>
					<p class="hint ruimte">Het rapport is één HTML-bestand dat je als bijlage kunt mailen. Het bevat geen e-mailadressen. De kaartondergrond wordt bij het openen van internet geladen.</p>
					<iframe v-if="inzendingen.length && beheer.rapportUrl(id)" :key="rapportVersie" class="rapportkader" :src="beheer.rapportUrl(id)" title="Voorbeeld van het resultatenrapport"></iframe>
					<p v-else-if="!inzendingen.length" class="notitie">Er zijn nog geen inzendingen. Zet het traject bij Opzet op Open en deel de link met deelnemers.</p>
				</section>

				<!-- Opzet -->
				<Opzet v-else-if="tab === 'opzet'" :traject="traject" @bewaard="(t) => (traject = t)" />

				<!-- Inzendingen -->
				<section v-else-if="tab === 'inzendingen'">
					<p v-if="inzendingen.length">
						{{ getal(metEmail) }} van de {{ getal(inzendingen.length) }} deelnemers lieten een e-mailadres achter. Deze lijst bevat persoonsgegevens en is alleen voor jou bedoeld.
					</p>
					<div v-if="inzendingen.length" class="knoppenrij">
						<a v-if="beheer.exportUrl(id, 'inzendingen.csv')" class="knop knop-stil" :href="beheer.exportUrl(id, 'inzendingen.csv')" download>Download alle antwoorden (CSV, met e-mailadressen)</a>
					</div>
					<div v-if="inzendingen.length" class="tabelkader ruimte">
						<table class="tabel">
							<thead>
								<tr>
									<th scope="col">Ingediend</th>
									<th scope="col">Postcode</th>
									<th scope="col">Leeftijd</th>
									<th scope="col">E-mailadres</th>
									<th scope="col" class="getal">Op de kaart</th>
									<th scope="col" class="getal">Oordelen</th>
									<th scope="col"><span class="alleen-lezer">Verwijderen</span></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="i in inzendingen" :key="i.id">
									<td>{{ datumTijd(i.ingediend) }}</td>
									<td>{{ i.postcode }}</td>
									<td>{{ leeftijd(i.leeftijd) }}</td>
									<td>
										<a v-if="i.email" :href="`mailto:${i.email}`">{{ i.email }}</a>
										<small v-if="i.email && i.op_de_hoogte"> wil op de hoogte blijven</small>
									</td>
									<td class="getal">{{ i.bijdragen }}</td>
									<td class="getal">{{ i.reacties }}</td>
									<td><button type="button" class="tekstknop gevaar" @click="verwijderInzending(i)">Verwijder</button></td>
								</tr>
							</tbody>
						</table>
					</div>
					<p v-else class="notitie">Er zijn nog geen inzendingen.</p>
				</section>

				<!-- QGIS en export -->
				<section v-else class="qgis">
					<section class="blok">
						<h2>Openen in QGIS</h2>
						<p>Het GeoPackage bevat alle bijdragen als punten, lijnen en vlakken in RD New, de planonderdelen met de telling van de oordelen, en de antwoorden per deelnemer. QGIS kleurt de bijdragen vanzelf per categorie.</p>
						<a v-if="beheer.exportUrl(id, 'geopackage')" class="knop" :href="beheer.exportUrl(id, 'geopackage')" download>Download GeoPackage voor QGIS</a>
						<p v-else class="notitie">In de demo zijn de bestanden voor QGIS er alleen van het voorbeeldtraject.</p>
						<p class="hint ruimte">Sleep het bestand in QGIS en kies de lagen die je wilt zien. Download het opnieuw voor de nieuwste inzendingen.</p>
					</section>

					<section class="blok">
						<h2>Rechtstreeks verbinden vanuit QGIS of GeoServer</h2>
						<template v-if="qgis?.ingesteld">
							<p>Met een PostGIS-verbinding ziet QGIS altijd de laatste stand. Voeg in QGIS een nieuwe PostgreSQL-verbinding toe met deze gegevens:</p>
							<dl class="gegevens">
								<div><dt>Host</dt><dd>{{ servernaam }}</dd></div>
								<div><dt>Poort</dt><dd>{{ qgis.poort }}</dd></div>
								<div><dt>Database</dt><dd>{{ qgis.database }}</dd></div>
								<div><dt>Gebruiker</dt><dd>{{ qgis.gebruiker }}</dd></div>
								<div><dt>Schema</dt><dd>{{ qgis.schema }}</dd></div>
							</dl>
							<p>Het wachtwoord heeft je beheerder ingesteld. De lagen heten {{ qgis.lagen.join(', ') }}. Filter op de kolom traject met de waarde <strong>{{ traject.slug }}</strong> om alleen dit traject te zien.</p>
							<p class="hint">De poort moet door de beheerder zijn opengezet voor jullie kantoornetwerk. Dezelfde lagen kan GeoServer als WMS of WFS aanbieden.</p>
						</template>
						<p v-else-if="DEMO" class="notitie">Rechtstreeks verbinden kan alleen met de echte server, omdat de demo geen database heeft.</p>
						<p v-else class="notitie">De alleen-lezen gebruiker voor QGIS is nog niet aangemaakt in de database. In de installatiebeschrijving staat hoe de beheerder dat doet.</p>
					</section>

					<section class="blok">
						<h2>Andere bestanden</h2>
						<div class="knoppenrij">
							<a v-if="beheer.exportUrl(id, 'geojson')" class="knop knop-stil" :href="beheer.exportUrl(id, 'geojson')" download>Bijdragen als GeoJSON</a>
							<a v-if="beheer.exportUrl(id, 'bijdragen.csv')" class="knop knop-stil" :href="beheer.exportUrl(id, 'bijdragen.csv')" download>Bijdragen als CSV</a>
						</div>
						<p class="hint ruimte">De GeoJSON staat in graden (WGS84). De CSV opent direct in Excel en bevat per bijdrage de categorie, de toelichting en de plek.</p>
					</section>

					<section class="blok gevarenzone">
						<h2>Traject verwijderen</h2>
						<p>Verwijdert de opzet, alle inzendingen en alle kaartlagen van dit traject.</p>
						<button type="button" class="knop knop-gevaar" @click="verwijderTraject">Traject verwijderen</button>
					</section>
				</section>
			</template>
		</main>
	</div>
</template>
