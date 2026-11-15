// Instellingen uit de omgeving. Zie .env.example voor uitleg per variabele.
import { randomBytes } from 'node:crypto';

const env = process.env;

function vereist(naam, terugval) {
	const waarde = env[naam] ?? terugval;
	if (waarde === undefined || waarde === '') {
		throw new Error(`Omgevingsvariabele ${naam} ontbreekt. Zie .env.example.`);
	}
	return waarde;
}

const productie = env.NODE_ENV === 'production';

export const config = {
	productie,
	poort: Number(env.POORT || 3000),
	// 127.0.0.1 = alleen bereikbaar vanaf de server zelf (achter een reverse proxy). 0.0.0.0 = ook vanaf het netwerk.
	host: env.HOST || '127.0.0.1',
	databaseUrl: vereist('DATABASE_URL', productie ? undefined : 'postgres://dialoog:dialoog@127.0.0.1:5432/dialoogkaart'),
	beheerWachtwoord: vereist('BEHEER_WACHTWOORD', productie ? undefined : 'beheer'),
	// Zonder vast geheim vervallen alle sessies bij een herstart. Voor testen is dat prima.
	sessieGeheim: env.SESSIE_GEHEIM || randomBytes(32).toString('hex'),
	// Extra adressen (bijvoorbeeld een GitHub Pages-site) die het deelnemersdeel mogen aanroepen.
	toegestaneHerkomst: (env.TOEGESTANE_HERKOMST || '').split(',').map((s) => s.trim()).filter(Boolean),
	// Websites die Dialoogkaart in een kader (iframe) mogen tonen, bijvoorbeeld de projectsite van een gemeente. * = elke site.
	insluitenOp: (env.INSLUITEN_OP || '').split(',').map((s) => s.trim()).filter(Boolean),
	// Bij een lege database het voorbeeldtraject met voorbeelddata aanmaken.
	voorbeeld: (env.VOORBEELD ?? '1') !== '0',
	// Aanzetten zodra de site alleen via https bereikbaar is: de inlogcookie gaat dan nooit over een onbeveiligde verbinding.
	httpsAltijd: env.HTTPS_ALTIJD === '1',
	// Alleen aanzetten als de server achter een eigen reverse proxy staat (voor het juiste IP-adres bij de aanvraaglimiet).
	achterProxy: env.ACHTER_PROXY === '1',
	organisatie: {
		naam: env.ORGANISATIE_NAAM || 'Buro SRO',
		website: env.ORGANISATIE_WEBSITE || 'https://www.burosro.nl',
		email: env.ORGANISATIE_EMAIL || 'utrecht@buro-sro.nl',
	},
};
