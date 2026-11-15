<script setup lang="ts">
// Beheer: inloggen, het overzicht van trajecten en een nieuw traject aanmaken.
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { STATUSSEN } from '../../../gedeeld/constanten.js';
import { ApiFout, beheer } from '../api';
import type { TrajectRegel } from '../types';
import BeheerKop from './BeheerKop.vue';
import { datumTijd, getal, maakSleutel } from './hulp';

const router = useRouter();
const fase = ref<'laden' | 'inloggen' | 'lijst'>('laden');
const wachtwoord = ref('');
const fout = ref('');
const bezig = ref(false);
const trajecten = ref<TrajectRegel[]>([]);

const nieuw = ref({ titel: '', slug: '', kopie_van: '' });
const slugZelf = ref(false);
const nieuwFout = ref('');

const statusLabel = (id: string) => STATUSSEN.find((s) => s.id === id)?.label || id;
const totaal = computed(() => trajecten.value.reduce((s, t) => s + t.inzendingen, 0));

async function laad() {
	try {
		const ik = await beheer.ik();
		if (!ik.ingelogd) {
			fase.value = 'inloggen';
			return;
		}
		trajecten.value = await beheer.trajecten();
		fase.value = 'lijst';
	} catch (e) {
		fout.value = (e as Error).message;
		fase.value = 'inloggen';
	}
}

async function inloggen() {
	fout.value = '';
	bezig.value = true;
	try {
		await beheer.inloggen(wachtwoord.value);
		wachtwoord.value = '';
		await laad();
	} catch (e) {
		fout.value = (e as Error).message;
	} finally {
		bezig.value = false;
	}
}

watch(
	() => nieuw.value.titel,
	(titel) => {
		if (!slugZelf.value) nieuw.value.slug = maakSleutel(titel, 60);
	},
);

async function maak() {
	nieuwFout.value = '';
	if (!nieuw.value.titel.trim()) {
		nieuwFout.value = 'Geef het traject een naam.';
		return;
	}
	if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(nieuw.value.slug)) {
		nieuwFout.value = 'Het webadres bestaat uit 3 tot 60 kleine letters, cijfers en streepjes.';
		return;
	}
	bezig.value = true;
	try {
		const traject = await beheer.maak({ titel: nieuw.value.titel.trim(), slug: nieuw.value.slug, kopie_van: nieuw.value.kopie_van || undefined });
		router.push(`/beheer/t/${traject.id}?tab=opzet`);
	} catch (e) {
		nieuwFout.value = e instanceof ApiFout ? e.message : 'Aanmaken is niet gelukt.';
	} finally {
		bezig.value = false;
	}
}

onMounted(() => {
	document.title = 'Beheer | Dialoogkaart';
	laad();
});
</script>

<template>
	<div class="beheer">
		<BeheerKop :ingelogd="fase === 'lijst'" />

		<main v-if="fase === 'laden'" class="beheer-inhoud"><p>Bezig met laden.</p></main>

		<main v-else-if="fase === 'inloggen'" class="beheer-inhoud smal">
			<h1>Inloggen</h1>
			<form @submit.prevent="inloggen">
				<div class="veld">
					<label for="wachtwoord">Wachtwoord</label>
					<input id="wachtwoord" v-model="wachtwoord" type="password" autocomplete="current-password" required />
				</div>
				<p v-if="fout" class="foutmelding" role="alert">{{ fout }}</p>
				<button type="submit" class="knop ruimte" :disabled="bezig">Inloggen</button>
			</form>
		</main>

		<main v-else class="beheer-inhoud">
			<h1>Trajecten</h1>
			<p v-if="trajecten.length">{{ getal(trajecten.length) }} {{ trajecten.length === 1 ? 'traject' : 'trajecten' }} met samen {{ getal(totaal) }} inzendingen.</p>

			<div v-if="trajecten.length" class="tabelkader">
				<table class="tabel">
					<thead>
						<tr>
							<th scope="col">Traject</th>
							<th scope="col">Status</th>
							<th scope="col" class="getal">Deelnemers</th>
							<th scope="col" class="getal">Op de kaart</th>
							<th scope="col">Laatste inzending</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="t in trajecten" :key="t.id">
							<th scope="row">
								<RouterLink :to="`/beheer/t/${t.id}`">{{ t.titel }}</RouterLink>
							</th>
							<td><span class="status" :data-status="t.status">{{ statusLabel(t.status) }}</span></td>
							<td class="getal">{{ getal(t.inzendingen) }}</td>
							<td class="getal">{{ getal(t.bijdragen) }}</td>
							<td>{{ datumTijd(t.laatste_inzending) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p v-else class="notitie">Er zijn nog geen trajecten. Maak hieronder het eerste aan.</p>

			<section class="blok">
				<h2>Nieuw traject</h2>
				<form class="nieuw" @submit.prevent="maak">
					<div class="veld">
						<label for="nieuw-titel">Naam</label>
						<input id="nieuw-titel" v-model="nieuw.titel" type="text" maxlength="120" placeholder="Bijvoorbeeld: Centrumplan Garderen" />
					</div>
					<div class="veld">
						<label for="nieuw-slug">Webadres voor deelnemers</label>
						<input id="nieuw-slug" v-model="nieuw.slug" type="text" maxlength="60" @input="slugZelf = true" />
						<p class="hint">Komt achter /p/ in de link die je deelt.</p>
					</div>
					<div class="veld">
						<label for="nieuw-kopie">Beginnen met</label>
						<select id="nieuw-kopie" v-model="nieuw.kopie_van">
							<option value="">Een lege opzet</option>
							<option v-for="t in trajecten" :key="t.id" :value="t.id">Kopie van: {{ t.titel }}</option>
						</select>
					</div>
					<p v-if="nieuwFout" class="foutmelding" role="alert">{{ nieuwFout }}</p>
					<button type="submit" class="knop ruimte" :disabled="bezig">Traject aanmaken</button>
				</form>
			</section>
		</main>
	</div>
</template>
