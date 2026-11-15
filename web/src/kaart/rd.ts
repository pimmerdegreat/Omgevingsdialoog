// Omrekenen van RD New naar graden, bij het inlezen van bestanden uit QGIS in beheer.
import { rdNaarWgs as omreken } from '../../../gedeeld/rd.js';
import type { Coordinaat } from '../types';

export function rdNaarWgs(x: number, y: number): Coordinaat {
	return omreken(x, y) as Coordinaat;
}
