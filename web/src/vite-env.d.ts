/// <reference types="vite/client" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<object, object, unknown>;
	export default component;
}

declare module '*/gedeeld/boog.js' {
	export function boogSvg(kleur: string, extraKlasse?: string): string;
}

declare module '*/gedeeld/basiskaarten.js' {
	export interface Basiskaart {
		id: string;
		naam: string;
		groep: string;
		url: string;
		maxZoom: number;
		bron: string;
	}
	export const BASISKAARTEN: Basiskaart[];
	export const BASISKAART_IDS: string[];
	export function basiskaart(id: string): Basiskaart;
}

declare module '*/gedeeld/constanten.js' {
	export const LEEFTIJDEN: { id: string; label: string }[];
	export const OORDELEN: { id: string; label: string; kleur: string }[];
	export const VORMEN: Record<'punt' | 'lijn' | 'vlak', { geometrie: string; label: string; actie: string }>;
	export const CATEGORIEKLEUREN: string[];
	export const STATUSSEN: { id: string; label: string; uitleg: string }[];
}

