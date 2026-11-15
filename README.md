# Dialoogkaart

Kaartgestuurde participatie voor Buro SRO. Bewoners zetten op de kaart wat zij fijn vinden, wat beter kan en wat zij van een plan vinden. De uitkomsten gaan als één HTML-rapport naar de opdrachtgever en openen direct in QGIS.

Dialoogkaart is een eigen, slank alternatief voor Maptionnaire, gebouwd voor ongeveer tien trajecten per jaar.

## Wat je ermee doet

**Deelnemers** openen een link op hun telefoon of computer. Zij doorlopen de stappen van het traject:

- punten, lijnen en vlakken op de kaart zetten, per categorie en met een toelichting;
- per planonderdeel aangeven of zij het een goed idee vinden;
- gewone vragen beantwoorden: één keuze, meer keuzes, schaal, open tekst of getal;
- als zij dat willen postcode, leeftijdsgroep en e-mailadres achterlaten.

**Jij als beheerder** maakt in beheer een traject aan en past alles zelf aan: teksten, startbeeld van de kaart, ondergronden, eigen kaartlagen, stappen, categorieën, planonderdelen en vragen. Planonderdelen teken je op de kaart of lees je in als GeoJSON uit QGIS.

**De resultaten** haal je op drie manieren op:

- als rapport: één HTML-bestand met kaart, legenda, dichtheidskaart, grafieken en alle toelichtingen, dat je als bijlage naar je klant mailt;
- in QGIS: een GeoPackage in RD New dat de bijdragen vanzelf per categorie kleurt, of een rechtstreekse PostGIS-verbinding;
- als GeoJSON en CSV voor ander gebruik.

Ondergronden: PDOK (Kaart van Nederland, grijs, pastel, water en luchtfoto) en OpenStreetMap (standaard, humanitair, fietskaart en hoogtekaart).

## Snel bekijken

Het voorbeeldtraject speelt rond 't Goylaan in Utrecht en is gevuld met verzonnen deelnemers.

```
npm install
npm run demo
npx vite preview --config web/vite.config.ts --outDir ../dist/demo
```

De demo draait zonder server en zonder database. Dezelfde demo kan op GitHub Pages staan: zet in de repository bij Settings, Pages de bron op GitHub Actions. De workflow in `.github/workflows/pages.yml` doet de rest bij elke wijziging op `main`.

## Installeren op de server

Dialoogkaart draait op Node.js met een PostgreSQL-database met PostGIS. De stappen voor een Windows-server staan in [docs/installatie-windows.md](docs/installatie-windows.md). Die beschrijving is geschreven om door te sturen naar de beheerder van de server.

Het gebruik van de resultaten in QGIS staat in [docs/qgis.md](docs/qgis.md).

## Ontwikkelen

Nodig: Node.js 22.13 of nieuwer en PostgreSQL met PostGIS.

```
npm install
copy .env.example .env      (op Linux of macOS: cp .env.example .env)
npm run dev                 de server, op poort 3000
npm run dev:web             de website met directe verversing, op poort 5173
npm test                    de tests, zonder database
npm run build               de website bouwen naar dist/web
```

De database richt je eenmalig in met `server/installatie.sql`. De tabellen en de lagen voor QGIS maakt de server bij het starten zelf aan.

| Map | Inhoud |
|---|---|
| `server/` | De server: API voor deelnemers en beheer, controle van invoer, exports en het rapport |
| `server/rapport/` | Het resultatenrapport: cijfers, opmaak en het kaartscript |
| `server/seed/` | Het voorbeeldtraject en de verzonnen voorbeelddata |
| `web/` | De website: startpagina, meedoen en beheer (Vue en Leaflet) |
| `gedeeld/` | Huisstijl, ondergronden en keuzelijsten die server, website en rapport delen |
| `docs/` | Installatie en gebruik in QGIS |

## Gegevens en privacy

- Buro SRO is verwerkingsverantwoordelijke. De privacytekst per traject is een voorzet; laat die nalopen voordat je een echt traject opent.
- Meedoen kan zonder persoonsgegevens. Postcode, leeftijdsgroep en e-mailadres zijn nooit verplicht.
- E-mailadressen staan alleen in beheer en in de CSV met antwoorden. Ze staan niet in het rapport, niet in het GeoPackage en niet in de lagen voor QGIS. Van postcodes gaan alleen de vier cijfers mee.
- Na de bewaartermijn van een gesloten traject wist de server vanzelf de e-mailadressen en de letters van de postcodes. De standaard is twaalf maanden.
- Een losse inzending verwijder je in beheer, bijvoorbeeld op verzoek van een deelnemer.
- De server bewaart geen IP-adressen.

## Wat er nog niet in zit

- Deelnemers zien elkaars bijdragen niet.
- Er is één beheerder met één wachtwoord; teams en rollen ontbreken.
- Budgetverdelen en het uploaden van foto's door deelnemers ontbreken.
- De site is Nederlandstalig.

## Ontwerp

De vormgeving volgt de uitgangspunten van Taste Skill: bouwen vanuit wat alleen bij dit bureau hoort, in plaats van een algemeen sjabloon.

- De kaartmarkering is de boog uit het logo van Buro SRO.
- De kleuren zijn het donkerblauw, oker en groen van het bureau; kleur is gereserveerd voor gegevens.
- Eén lettertype (Archivo), vlakke vlakken, geen verlopen, schaduwen, glas, emoji of icoonkaarten.
- Alle cijfers in het rapport zijn uit de inzendingen geteld.
- Elke pagina is gecontroleerd op 1440, 768 en 390 pixels breed.

## Gebruikte onderdelen

Leaflet (BSD-2-Clause), Leaflet.heat (BSD-2-Clause), Vue (MIT), Fastify (MIT), het lettertype Archivo (SIL Open Font License). Kaartgegevens van het Kadaster via PDOK en van OpenStreetMap-bijdragers. Het logo is van Buro SRO.
