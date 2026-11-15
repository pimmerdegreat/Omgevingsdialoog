<script setup lang="ts">
// Beelden en video's toevoegen aan een stap of een vraag. Foto's worden eerst in de browser verkleind.
import { reactive, ref } from 'vue';
import { youtubeId } from '../../../gedeeld/media.js';
import { beheer, bestandUrl } from '../api';
import type { Media } from '../types';
import { verkleinBeeld } from './beeld';

const props = defineProps<{
	/** De stap of vraag waar de beelden bij horen. */
	doel: { id: string; media?: Media[] };
	trajectId: string;
	max: number;
	titel: string;
	uitleg: string;
}>();

const fout = ref('');
const bezig = ref(false);
const link = ref('');
const open = ref(Boolean(props.doel.media?.length));
const ids = reactive({ veld: `video-${props.doel.id}-${Math.random().toString(36).slice(2, 7)}` });

function lijst(): Media[] {
	props.doel.media ??= [];
	return props.doel.media;
}

function verplaats(van: number, richting: -1 | 1) {
	const l = lijst();
	const naar = van + richting;
	if (naar < 0 || naar >= l.length) return;
	[l[van], l[naar]] = [l[naar], l[van]];
}

async function voegBeeldenToe(e: Event) {
	const invoer = e.target as HTMLInputElement;
	const bestanden = [...(invoer.files || [])];
	invoer.value = '';
	fout.value = '';
	if (lijst().length + bestanden.length > props.max) {
		fout.value = `Hier passen hoogstens ${props.max} beelden of video’s.`;
		return;
	}
	bezig.value = true;
	try {
		for (const bestand of bestanden) {
			const { blob, naam } = await verkleinBeeld(bestand);
			const { id } = await beheer.uploadBestand(props.trajectId, blob, naam);
			lijst().push({ type: 'afbeelding', bestand_id: id, bijschrift: '' });
		}
	} catch (e) {
		fout.value = (e as Error).message;
	} finally {
		bezig.value = false;
	}
}

function voegVideoToe() {
	fout.value = '';
	const id = youtubeId(link.value);
	if (!id) {
		fout.value = 'Dat is geen YouTube-link. Kopieer de link uit de adresbalk of via Delen op YouTube.';
		return;
	}
	if (lijst().length >= props.max) {
		fout.value = `Hier passen hoogstens ${props.max} beelden of video’s.`;
		return;
	}
	lijst().push({ type: 'video', youtube: id, bijschrift: '' });
	link.value = '';
}
</script>

<template>
	<div class="media-bewerk">
		<button v-if="!open" type="button" class="tekstknop" @click="open = true">+ {{ titel }}</button>
		<template v-else>
			<p class="veldlabel">{{ titel }}</p>
			<p class="hint">{{ uitleg }}</p>
			<ul v-if="doel.media?.length" class="rijen">
				<li v-for="(m, nr) in doel.media" :key="(m.type === 'afbeelding' ? m.bestand_id : m.youtube) + nr">
					<div class="media-rij">
						<img v-if="m.type === 'afbeelding'" :src="bestandUrl(m.bestand_id)" class="media-duim" alt="" />
						<span v-else class="media-duim video-duim" aria-hidden="true"><span class="speel"></span></span>
						<div class="veld breed">
							<label :for="`bijschrift-${ids.veld}-${nr}`">Bijschrift</label>
							<input :id="`bijschrift-${ids.veld}-${nr}`" v-model="m.bijschrift" type="text" maxlength="200" />
						</div>
					</div>
					<div class="rij-acties">
						<span class="soort">{{ m.type === 'afbeelding' ? 'Afbeelding' : 'YouTube-video' }}</span>
						<button type="button" class="tekstknop" :disabled="nr === 0" @click="verplaats(nr, -1)">Omhoog</button>
						<button type="button" class="tekstknop" :disabled="nr === (doel.media?.length ?? 0) - 1" @click="verplaats(nr, 1)">Omlaag</button>
						<button type="button" class="tekstknop gevaar" @click="lijst().splice(nr, 1)">Verwijder</button>
					</div>
				</li>
			</ul>
			<div class="media-toevoegen">
				<label class="knop knop-stil bestandknop" :class="{ bezig }">
					{{ bezig ? 'Bezig met uploaden' : 'Afbeeldingen toevoegen' }}
					<input type="file" accept="image/png,image/jpeg,image/webp" multiple :disabled="bezig" @change="voegBeeldenToe" />
				</label>
				<div class="video-toevoegen">
					<label class="alleen-lezer" :for="ids.veld">YouTube-link</label>
					<input :id="ids.veld" v-model="link" type="text" placeholder="Plak een YouTube-link" @keydown.enter.prevent="voegVideoToe" />
					<button type="button" class="knop knop-stil" @click="voegVideoToe">Video toevoegen</button>
				</div>
			</div>
			<p v-if="fout" class="foutmelding" role="alert">{{ fout }}</p>
		</template>
	</div>
</template>
