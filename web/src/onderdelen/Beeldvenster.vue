<script setup lang="ts">
// Toont een afbeelding of video groot in het midden van het scherm, met de rest donker erachter.
// Bladeren met de pijlen als er meer zijn; sluiten met Esc, de knop of een klik naast het beeld.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { youtubeInsluiten } from '../../../gedeeld/media.js';

export interface Beeld {
	/** Adres van een afbeelding. */
	src?: string;
	/** Code van een YouTube-video. */
	youtube?: string;
	bijschrift: string;
}

const props = defineProps<{ beelden: Beeld[] }>();
const nummer = defineModel<number | null>({ required: true });
const sluitknop = ref<HTMLButtonElement | null>(null);
let vorigeFocus: HTMLElement | null = null;

function blader(stap: number) {
	if (nummer.value === null) return;
	nummer.value = (nummer.value + stap + props.beelden.length) % props.beelden.length;
}

function toets(e: KeyboardEvent) {
	if (nummer.value === null) return;
	if (e.key === 'Escape') nummer.value = null;
	if (e.key === 'ArrowRight') blader(1);
	if (e.key === 'ArrowLeft') blader(-1);
}

watch(nummer, (nu, eerder) => {
	if (nu !== null && eerder === null) {
		vorigeFocus = document.activeElement as HTMLElement | null;
		window.addEventListener('keydown', toets);
		document.documentElement.style.overflow = 'hidden';
		nextTick(() => sluitknop.value?.focus());
	}
	if (nu === null && eerder !== null) {
		window.removeEventListener('keydown', toets);
		document.documentElement.style.overflow = '';
		vorigeFocus?.focus();
	}
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', toets);
	document.documentElement.style.overflow = '';
});
</script>

<template>
	<Teleport to="body">
		<div
			v-if="nummer !== null && beelden[nummer]"
			class="beeldvenster"
			role="dialog"
			aria-modal="true"
			:aria-label="beelden[nummer].bijschrift || (beelden[nummer].youtube ? 'Video' : 'Afbeelding')"
			@click.self="nummer = null"
		>
			<figure :class="{ isvideo: beelden[nummer].youtube }">
				<div v-if="beelden[nummer].youtube" class="venster-video">
					<iframe
						:key="beelden[nummer].youtube"
						:src="youtubeInsluiten(beelden[nummer].youtube!)"
						:title="beelden[nummer].bijschrift || 'Video'"
						allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
						allowfullscreen
					></iframe>
				</div>
				<img v-else :src="beelden[nummer].src" :alt="beelden[nummer].bijschrift" />
				<figcaption v-if="beelden[nummer].bijschrift || beelden.length > 1">
					<span v-if="beelden.length > 1" class="teller">{{ nummer + 1 }} / {{ beelden.length }}</span>
					{{ beelden[nummer].bijschrift }}
				</figcaption>
			</figure>
			<button ref="sluitknop" type="button" class="venster-knop sluit" aria-label="Sluiten" @click="nummer = null">×</button>
			<template v-if="beelden.length > 1">
				<button type="button" class="venster-knop vorige" aria-label="Vorige" @click="blader(-1)">‹</button>
				<button type="button" class="venster-knop volgende" aria-label="Volgende" @click="blader(1)">›</button>
			</template>
		</div>
	</Teleport>
</template>
