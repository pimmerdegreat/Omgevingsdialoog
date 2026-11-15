// Beginopzet voor een nieuw traject, met de naam en het e-mailadres van de organisatie uit de instellingen.
import { legeDefinitie as sjabloon } from '../gedeeld/sjabloon.js';
import { config } from './config.js';

export function legeDefinitie() {
	return sjabloon(config.organisatie);
}
