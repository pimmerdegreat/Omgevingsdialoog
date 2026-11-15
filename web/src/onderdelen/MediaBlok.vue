<script setup lang="ts">
// Beelden en video's in het linkerpaneel, bij een stap of bij een vraag. Ze staan klein in het paneel;
// een klik opent ze groot in het midden van het scherm. Een YouTube-video laadt pas na die klik,
// zodat er zonder toestemming niets naar YouTube gaat.
import { computed, ref } from 'vue';
import { bestandUrl } from '../api';
import type { Media } from '../types';
import Beeldvenster, { type Beeld } from './Beeldvenster.vue';

const props = defineProps<{ media: Media[]; klein?: boolean }>();

const items = computed<Beeld[]>(() =>
	props.media.map((m) => (m.type === 'afbeelding' ? { src: bestandUrl(m.bestand_id), bijschrift: m.bijschrift } : { youtube: m.youtube, bijschrift: m.bijschrift })),
);
const groot = ref<number | null>(null);
</script>

<template>
	<div class="mediablok" :class="{ klein }">
		<div class="beeldstrook" :class="{ meer: items.length > 1 }">
			<figure v-for="(b, i) in items" :key="`${b.src || b.youtube}-${i}`">
				<button
					v-if="b.src"
					type="button"
					class="beeldknop"
					:aria-label="`Vergroot afbeelding${b.bijschrift ? ': ' + b.bijschrift : ''}`"
					@click="groot = i"
				>
					<img :src="b.src" :alt="b.bijschrift" loading="lazy" />
					<span class="vergroot-teken" aria-hidden="true">
						<svg viewBox="0 0 20 20"><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</span>
					<span v-if="items.length > 1" class="teller">{{ i + 1 }} / {{ items.length }}</span>
				</button>
				<button v-else type="button" class="beeldknop videoknop" :aria-label="`Video afspelen${b.bijschrift ? ': ' + b.bijschrift : ''}`" @click="groot = i">
					<span class="speel" aria-hidden="true"></span>
					<span class="video-tekst">Video afspelen</span>
					<small>Komt van YouTube. Bij afspelen maakt je browser verbinding met YouTube.</small>
					<span v-if="items.length > 1" class="teller">{{ i + 1 }} / {{ items.length }}</span>
				</button>
				<figcaption v-if="b.bijschrift">{{ b.bijschrift }}</figcaption>
			</figure>
		</div>
		<Beeldvenster v-model="groot" :beelden="items" />
	</div>
</template>
