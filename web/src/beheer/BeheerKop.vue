<script setup lang="ts">
import { useRouter } from 'vue-router';
import logo from '../../../gedeeld/buro-sro.png';
import { beheer, DEMO } from '../api';

defineProps<{ ingelogd: boolean }>();
const router = useRouter();

async function uitloggen() {
	await beheer.uitloggen().catch(() => null);
	router.go(0);
}

async function opnieuw() {
	if (!window.confirm('De demo terugzetten naar de beginstand? Alles wat je in de demo hebt gemaakt of ingevuld verdwijnt.')) return;
	await beheer.demoOpnieuw();
	await router.push('/beheer');
	router.go(0);
}
</script>

<template>
	<header class="beheer-kop">
		<RouterLink to="/beheer" class="beheer-logo"><img :src="logo" alt="Buro SRO" width="877" height="400" /><span>Dialoogkaart beheer</span></RouterLink>
		<button v-if="ingelogd" type="button" class="knop knop-stil knop-klein" @click="uitloggen">Uitloggen</button>
	</header>
	<div v-if="DEMO" class="demobalk" role="note">
		<p><strong>Demo.</strong> Alles wat je hier maakt of wijzigt blijft in deze browser. Er wordt niets verstuurd.</p>
		<button type="button" class="tekstknop" @click="opnieuw">Demo opnieuw beginnen</button>
	</div>
</template>
