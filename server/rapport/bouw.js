// Bouwt het resultatenrapport als één los HTML-bestand: stijl, lettertype, logo, kaartbibliotheek en gegevens zitten erin.
// Alleen de kaartondergrond wordt bij het openen van internet gehaald.
import { readFile } from 'node:fs/promises';
import { boogSvg } from '../../gedeeld/boog.js';
import { OORDELEN } from '../../gedeeld/constanten.js';

const pakket = (pad) => new URL(`../../node_modules/${pad}`, import.meta.url);

let onderdelenCache = null;

async function vasteOnderdelen() {
	if (onderdelenCache) return onderdelenCache;
	const lees = (pad, codering = 'utf8') => readFile(pad, codering);
	const hier = (naam) => new URL(naam, import.meta.url);
	const [huisstijl, rapportCss, rapportJs, leafletCss, leafletJs, heatJs, letter, logo] = await Promise.all([
		lees(hier('../../gedeeld/huisstijl.css')),
		lees(hier('./rapport.css')),
		lees(hier('./rapport.js')),
		lees(pakket('leaflet/dist/leaflet.css')),
		lees(pakket('leaflet/dist/leaflet.js')),
		lees(pakket('leaflet.heat/dist/leaflet-heat-global.js')),
		lees(pakket('@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2'), 'base64'),
		lees(hier('../../gedeeld/buro-sro.png'), 'base64'),
	]);
	// De standaardmarkeringen van Leaflet verwijzen naar losse afbeeldingen; die gebruiken we niet.
	const leafletZonderAfbeeldingen = leafletCss.replace(/url\([^)]*\)/g, 'none');
	onderdelenCache = { huisstijl, rapportCss, rapportJs, leafletCss: leafletZonderAfbeeldingen, leafletJs, heatJs, letter, logo };
	return onderdelenCache;
}

const e = (tekst) =>
	String(tekst ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const getal = (n) => Number(n).toLocaleString('nl-NL');
const komma = (n, decimalen = 1) => Number(n).toLocaleString('nl-NL', { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen });
const procent = (deel, totaal) => (totaal ? Math.round((deel / totaal) * 100) : 0);
const dag = (iso, metJaar = true) =>
	new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', ...(metJaar ? { year: 'numeric' } : {}), timeZone: 'Europe/Amsterdam' }).format(new Date(iso));
const meervoud = (n, een, meer) => `${getal(n)} ${n === 1 ? een : meer}`;

function staven(rijen, { kleur = 'var(--blauw)', totaal = null } = {}) {
	const hoogste = Math.max(1, ...rijen.map((r) => r.aantal));
	return `<ul class="staven">${rijen
		.map(
			(r) =>
				`<li><span class="staaf-label">${r.voor || ''}${e(r.label)}</span>` +
				`<span class="staaf-baan"><span class="staaf" style="--deel:${((r.aantal / hoogste) * 100).toFixed(1)}%;--kleur:${r.kleur || kleur}"></span></span>` +
				`<span class="staaf-getal">${getal(r.aantal)}${totaal ? `<small>${procent(r.aantal, totaal)}%</small>` : ''}</span></li>`,
		)
		.join('')}</ul>`;
}

function periodeZin(g) {
	if (!g.totalen.deelnemers) return 'Er zijn nog geen inzendingen.';
	const zelfdeJaar = g.periode.van.slice(0, 4) === g.periode.tot.slice(0, 4);
	const zelfdeDag = g.periode.van.slice(0, 10) === g.periode.tot.slice(0, 10);
	const wanneer = zelfdeDag ? `op ${dag(g.periode.van)}` : `tussen ${dag(g.periode.van, !zelfdeJaar)} en ${dag(g.periode.tot)}`;
	return `${meervoud(g.totalen.deelnemers, 'deelnemer deed', 'deelnemers deden')} mee ${wanneer}.`;
}

function bevinding(g) {
	const gevuld = g.categorieen.filter((c) => c.aantal > 0);
	if (!gevuld.length) return '';
	const top = [...gevuld].sort((a, b) => b.aantal - a.aantal)[0];
	return `<p class="bevinding">De categorie <strong>${e(top.label)}</strong> kreeg de meeste bijdragen op de kaart: ${getal(top.aantal)} van de ${getal(g.totalen.bijdragen)}.</p>`;
}

function kopCijfers(g) {
	const cijfers = [
		[g.totalen.deelnemers, g.totalen.deelnemers === 1 ? 'deelnemer' : 'deelnemers'],
		[g.totalen.bijdragen, g.totalen.bijdragen === 1 ? 'bijdrage op de kaart' : 'bijdragen op de kaart'],
		[g.totalen.reacties, g.totalen.reacties === 1 ? 'oordeel over een planonderdeel' : 'oordelen over planonderdelen'],
		[g.totalen.toelichtingen, g.totalen.toelichtingen === 1 ? 'geschreven toelichting' : 'geschreven toelichtingen'],
	];
	return `<dl class="cijfers">${cijfers.map(([n, label]) => `<div><dt>${getal(n)}</dt><dd>${label}</dd></div>`).join('')}</dl>`;
}

function kaartDeel(g) {
	if (!g.totalen.bijdragen && !g.onderdelen.length) return '';
	const legenda = g.categorieen
		.map(
			(c, i) =>
				`<li><button type="button" class="legenda-knop" data-categorie="${i}" aria-pressed="true">${boogSvg(c.kleur, 'boog-klein')}<span>${e(c.label)}</span><span class="legenda-getal">${getal(c.aantal)}</span></button></li>`,
		)
		.join('');
	const planKnop = g.onderdelen.length
		? `<li><button type="button" class="legenda-knop" data-plan aria-pressed="true"><span class="plan-teken" aria-hidden="true"></span><span>Planonderdelen</span><span class="legenda-getal">${getal(g.onderdelen.length)}</span></button></li>`
		: '';
	const ondergronden = g.kaart.ondergronden.map((o, i) => `<option value="${e(o.id)}"${i === 0 ? ' selected' : ''}>${e(o.naam)}</option>`).join('');
	return `<section class="deel" id="kaartdeel">
	<h2>Waar deelnemers iets over zeggen</h2>
	<p>Elke markering is een bijdrage van een deelnemer. Klik op een markering om de toelichting te lezen. Met de knoppen in de legenda zet je een categorie aan of uit.</p>
	<div class="kaartkader">
		<div class="kaartvlak">
			<div id="kaart" role="application" aria-label="Kaart met bijdragen van deelnemers"></div>
			<p class="kaart-zonder-script">De kaart heeft JavaScript en een internetverbinding nodig. De cijfers hieronder zijn ook zonder kaart te lezen.</p>
		</div>
		<div class="kaartpaneel">
			<h3>Legenda</h3>
			<ul class="legenda">${legenda}${planKnop}</ul>
			<div class="schakel" role="group" aria-label="Weergave van de bijdragen">
				<button type="button" data-weergave="punten" aria-pressed="true">Markeringen</button>
				<button type="button" data-weergave="dichtheid" aria-pressed="false">Dichtheid</button>
			</div>
			<label class="veld">Ondergrond
				<select id="ondergrond">${ondergronden}</select>
			</label>
		</div>
	</div>
</section>`;
}

function categorieDeel(g) {
	if (!g.totalen.bijdragen) return '';
	const vorm = { punt: 'punten', lijn: 'lijnen', vlak: 'vlakken' };
	const rijen = g.categorieen.map((c) => ({ label: c.label, aantal: c.aantal, kleur: c.kleur, voor: boogSvg(c.kleur, 'boog-klein') }));
	const perVorm = ['punt', 'lijn', 'vlak']
		.map((v) => [v, g.categorieen.filter((c) => c.vorm === v).reduce((s, c) => s + c.aantal, 0)])
		.filter(([, n]) => n > 0)
		.map(([v, n]) => `${getal(n)} ${vorm[v]}`);
	return `<section class="deel">
	<h2>Bijdragen per categorie</h2>
	<p>Deelnemers zetten samen ${getal(g.totalen.bijdragen)} bijdragen op de kaart: ${perVorm.join(', ').replace(/, ([^,]*)$/, ' en $1')}.</p>
	${staven(rijen, { totaal: g.totalen.bijdragen })}
</section>`;
}

function onderdelenDeel(g) {
	if (!g.onderdelen.length) return '';
	const blokken = g.onderdelen
		.map((o) => {
			const delen = OORDELEN.map(
				(oordeel) =>
					`<span class="stapel-deel" style="--deel:${o.totaal ? ((o[oordeel.id] / o.totaal) * 100).toFixed(2) : 0}%;--kleur:${oordeel.kleur}" title="${e(oordeel.label)}: ${getal(o[oordeel.id])}"></span>`,
			).join('');
			const telling = OORDELEN.map(
				(oordeel) => `<li><span class="stip" style="--kleur:${oordeel.kleur}"></span>${e(oordeel.label)} <strong>${getal(o[oordeel.id])}</strong> <small>${procent(o[oordeel.id], o.totaal)}%</small></li>`,
			).join('');
			// Gelijke toelichtingen bij hetzelfde oordeel worden één regel met een telling.
			const samen = new Map();
			for (const t of o.toelichtingen) {
				const sleutel = `${t.o}|${t.t.trim().toLowerCase()}`;
				if (samen.has(sleutel)) samen.get(sleutel).n++;
				else samen.set(sleutel, { ...t, n: 1 });
			}
			const uniek = [...samen.values()].sort((a, b) => b.n - a.n);
			const citaat = (t) => `<li><span class="stip" style="--kleur:${OORDELEN.find((x) => x.id === t.o).kleur}"></span><span>${e(t.t)}${t.n > 1 ? ` <small>${getal(t.n)} keer</small>` : ''}</span></li>`;
			const eerste = uniek.slice(0, 4).map(citaat).join('');
			const rest = uniek.slice(4).map(citaat).join('');
			return `<article class="onderdeel">
		<h3>${e(o.titel)}</h3>
		${o.tekst ? `<p>${e(o.tekst)}</p>` : ''}
		${o.totaal ? `<div class="stapel" role="img" aria-label="${OORDELEN.map((x) => `${x.label}: ${o[x.id]}`).join(', ')}">${delen}</div><ul class="stapel-uitleg">${telling}</ul>` : '<p>Hier is nog niet op gereageerd.</p>'}
		${eerste ? `<ul class="citaten">${eerste}</ul>` : ''}
		${rest ? `<details><summary>Nog ${meervoud(uniek.length - 4, 'toelichting', 'toelichtingen')}</summary><ul class="citaten">${rest}</ul></details>` : ''}
	</article>`;
		})
		.join('');
	return `<section class="deel">
	<h2>Oordeel over de planonderdelen</h2>
	<p>Deelnemers gaven per planonderdeel aan of zij het een goed idee vinden. In totaal zijn er ${getal(g.totalen.reacties)} oordelen gegeven.</p>
	<div class="onderdelen">${blokken}</div>
</section>`;
}

function vragenDeel(g) {
	if (!g.vragen.length) return '';
	const blokken = g.vragen
		.map((v) => {
			let inhoud;
			if (!v.aantal) {
				inhoud = '<p>Deze vraag is nog niet beantwoord.</p>';
			} else if (v.type === 'keuze' || v.type === 'meerkeuze') {
				inhoud = staven(v.opties, { totaal: v.aantal });
			} else if (v.type === 'schaal') {
				inhoud = `<p class="gemiddelde"><strong>${komma(v.gemiddelde)}</strong> gemiddeld${v.minLabel || v.maxLabel ? `, op een schaal van ${e(v.opties[0].label)} (${e(v.minLabel.toLowerCase())}) tot ${e(v.opties[v.opties.length - 1].label)} (${e(v.maxLabel.toLowerCase())})` : ''}</p>${staven(v.opties, { kleur: 'var(--oker)' })}`;
			} else if (v.type === 'getal') {
				inhoud = `<p class="gemiddelde"><strong>${komma(v.gemiddelde)}</strong> gemiddeld, van ${komma(v.laagste, 0)} tot ${komma(v.hoogste, 0)}</p>`;
			} else {
				// Gelijke antwoorden worden één regel met een telling, de meest gegeven bovenaan.
				const samen = new Map();
				for (const a of v.antwoorden) {
					const sleutel = a.trim().toLowerCase();
					if (samen.has(sleutel)) samen.get(sleutel).n++;
					else samen.set(sleutel, { t: a, n: 1 });
				}
				const uniek = [...samen.values()].sort((a, b) => b.n - a.n);
				const regel = (a) => `<li>${e(a.t)}${a.n > 1 ? ` <small>${getal(a.n)} keer</small>` : ''}</li>`;
				const eerste = uniek.slice(0, 6).map(regel).join('');
				const rest = uniek.slice(6).map(regel).join('');
				inhoud = `<ul class="citaten open">${eerste}</ul>${rest ? `<details><summary>Nog ${meervoud(uniek.length - 6, 'antwoord', 'antwoorden')}</summary><ul class="citaten open">${rest}</ul></details>` : ''}`;
			}
			const hoeveel = v.type === 'meerkeuze' ? `${meervoud(v.aantal, 'deelnemer', 'deelnemers')}, meerdere antwoorden mogelijk` : meervoud(v.aantal, 'antwoord', 'antwoorden');
			return `<article class="vraag"><h3>${e(v.label)}</h3><p class="bijschrift">${hoeveel}</p>${inhoud}</article>`;
		})
		.join('');
	return `<section class="deel">
	<h2>Antwoorden op de vragen</h2>
	<div class="vragen">${blokken}</div>
</section>`;
}

function deelnemersDeel(g) {
	const d = g.deelnemers;
	if (!g.totalen.deelnemers) return '';
	const blokken = [];
	if (d.leeftijdBekend) {
		blokken.push(`<article class="vraag"><h3>Leeftijd</h3><p class="bijschrift">${getal(d.leeftijdBekend)} van de ${meervoud(g.totalen.deelnemers, 'deelnemer', 'deelnemers')} vulden dit in</p>${staven(d.leeftijd, { totaal: d.leeftijdBekend })}</article>`);
	}
	if (d.postcodeBekend) {
		const top = d.postcodes.slice(0, 6);
		const overig = d.postcodes.slice(6).reduce((s, p) => s + p.aantal, 0);
		const rijen = overig ? [...top, { label: 'Overige postcodes', aantal: overig }] : top;
		blokken.push(`<article class="vraag"><h3>Postcodegebied</h3><p class="bijschrift">${getal(d.postcodeBekend)} van de ${meervoud(g.totalen.deelnemers, 'deelnemer', 'deelnemers')} vulden dit in. Alleen de vier cijfers zijn geteld.</p>${staven(rijen, { kleur: 'var(--groen)', totaal: d.postcodeBekend })}</article>`);
	}
	if (d.weken.length > 1) {
		const rijen = d.weken.map((w) => ({ label: `Week van ${dag(w.week, false)}`, aantal: w.aantal }));
		blokken.push(`<article class="vraag"><h3>Inzendingen per week</h3><p class="bijschrift">Geteld vanaf maandag</p>${staven(rijen, { kleur: 'var(--inkt)' })}</article>`);
	}
	if (!blokken.length) return '';
	return `<section class="deel">
	<h2>Wie deden mee</h2>
	<div class="vragen">${blokken.join('')}</div>
</section>`;
}

function toelichtingenDeel(g) {
	const metTekst = g.bijdragen.map((b, i) => ({ ...b, i })).filter((b) => b.t);
	if (!metTekst.length) return '';
	const opties = g.categorieen
		.map((c, i) => [c, i])
		.filter(([, i]) => metTekst.some((b) => b.c === i))
		.map(([c, i]) => `<option value="${i}">${e(c.label)}</option>`)
		.join('');
	const items = metTekst
		.map((b) => {
			const c = g.categorieen[b.c];
			return `<li data-categorie="${b.c}">${boogSvg(c.kleur, 'boog-klein')}<div><p>${e(b.t)}</p><p class="bijschrift">${e(c.label)} <button type="button" class="link" data-toon="${b.i}">Toon op de kaart</button></p></div></li>`;
		})
		.join('');
	return `<section class="deel" id="toelichtingen">
	<h2>Alle toelichtingen bij de kaart</h2>
	<p>${meervoud(metTekst.length, 'bijdrage heeft', 'bijdragen hebben')} een geschreven toelichting. Zoek op een woord of kies een categorie.</p>
	<div class="filter">
		<label class="veld">Zoeken<input type="search" id="zoek" autocomplete="off" placeholder="Bijvoorbeeld: oversteken"></label>
		<label class="veld">Categorie<select id="filter-categorie"><option value="">Alle categorieën</option>${opties}</select></label>
		<p class="bijschrift" id="filter-telling" aria-live="polite"></p>
	</div>
	<ul class="toelichtingen" id="toelichtingenlijst">${items}</ul>
	<p id="filter-leeg" hidden>Geen toelichtingen gevonden. Probeer een ander woord of een andere categorie.</p>
</section>`;
}

/** Zet de rapportgegevens om naar één HTML-document. */
export async function bouwRapport(g) {
	const o = await vasteOnderdelen();
	const gegevensJson = JSON.stringify({
		kaart: g.kaart,
		categorieen: g.categorieen.map((c) => ({ label: c.label, kleur: c.kleur })),
		bijdragen: g.bijdragen,
		onderdelen: g.onderdelen.map((x) => ({ titel: x.titel, kleur: x.kleur, geometrie: x.geometrie, goed: x.goed, twijfel: x.twijfel, niet: x.niet })),
	}).replace(/</g, '\\u003c');

	const leeg = !g.totalen.deelnemers;
	return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Resultaten: ${e(g.titel)}</title>
<style>
@font-face{font-family:'Archivo Variable';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,${o.letter}) format('woff2-variations')}
${o.leafletCss}
${o.huisstijl}
${o.rapportCss}
</style>
</head>
<body>
<header class="kop">
	<a class="logo" href="${e(g.organisatie.website)}"><img src="data:image/png;base64,${o.logo}" alt="${e(g.organisatie.naam)}" width="877" height="400"></a>
	<p class="kop-rechts">Resultaten van de omgevingsdialoog<br>Opgemaakt op ${dag(g.gemaakt)}</p>
</header>
${g.voorbeeld ? '<p class="voorbeeldmelding"><strong>Voorbeelddata.</strong> De deelnemers, bijdragen en planonderdelen in dit rapport zijn verzonnen om de werking te laten zien.</p>' : ''}
<main>
<section class="opening">
	<h1>${e(g.titel)}</h1>
	<p class="inleiding">${periodeZin(g)}${g.status === 'open' && !leeg ? ' Het traject loopt nog, dus de cijfers kunnen veranderen.' : ''}</p>
	${leeg ? '' : kopCijfers(g)}
	${bevinding(g)}
</section>
${leeg ? '<section class="deel"><h2>Nog geen resultaten</h2><p>Zodra de eerste deelnemers hebben ingezonden, staan hier de kaart en de cijfers. Maak het rapport dan opnieuw aan.</p></section>' : ''}
${kaartDeel(g)}
${categorieDeel(g)}
${onderdelenDeel(g)}
${vragenDeel(g)}
${deelnemersDeel(g)}
${toelichtingenDeel(g)}
</main>
<footer class="voet">
	<div>
		<h2>Over dit rapport</h2>
		<p>Dit rapport is opgemaakt door ${e(g.organisatie.naam)} op ${dag(g.gemaakt)} met alle inzendingen tot dat moment. De cijfers zijn rechtstreeks uit de inzendingen geteld. Deelnemers kozen zelf of zij meededen; de uitkomsten zijn daarom een beeld van wat er leeft en geen steekproef.</p>
		<p>In dit rapport staan geen namen of e-mailadressen. Van postcodes zijn alleen de vier cijfers gebruikt.</p>
	</div>
	<div>
		<h2>Contact</h2>
		<p>${e(g.organisatie.naam)}<br><a href="mailto:${e(g.organisatie.email)}">${e(g.organisatie.email)}</a><br><a href="${e(g.organisatie.website)}">${e(g.organisatie.website.replace(/^https?:\/\//, ''))}</a></p>
		<p class="bijschrift" id="kaartbron">De kaartondergrond wordt van internet geladen.</p>
	</div>
</footer>
<script type="application/json" id="gegevens">${gegevensJson}</script>
<script>${o.leafletJs}</script>
<script>${o.heatJs}</script>
<script>${boogSvg.toString()}</script>
<script>${o.rapportJs}</script>
</body>
</html>
`;
}
