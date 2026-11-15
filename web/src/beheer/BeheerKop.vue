<script setup lang="ts">
import { useRouter } from 'vue-router';
import { beheer } from '../api';
import logo from '../../../gedeeld/buro-sro.png';

defineProps<{ ingelogd: boolean }>();
const router = useRouter();

async function uitloggen() {
	await beheer.uitloggen().catch(() => null);
	router.go(0);
}
</script>

<template>
	<header class="beheer-kop">
		<RouterLink to="/beheer" class="beheer-logo"><img :src="logo" alt="Buro SRO" width="877" height="400" /><span>Dialoogkaart beheer</span></RouterLink>
		<button v-if="ingelogd" type="button" class="knop knop-stil knop-klein" @click="uitloggen">Uitloggen</button>
	</header>
</template>
