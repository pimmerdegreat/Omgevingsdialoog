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

De demo staat op https://pimmerdegreat.github.io/Ongevingsdialoog/. Hij draait zonder server en zonder database.

- **Meedoen:** het voorbeeldtraject rond 't Goylaan in Utrecht, gevuld met 148 verzonnen deelnemers.
- **Beheer:** log in met het wachtwoord `demo`. Je kunt trajecten aanmaken en inrichten, kaartlagen en planonderdelen uit QGIS inlezen, zelf meedoen via de link en de inzendingen bekijken en verwijderen.
- **Rapport en exports:** van het voorbeeldtraject, inclusief het GeoPackage voor QGIS.

Alles wat je in de demo doet blijft in je eigen browser. Met Demo opnieuw beginnen zet je de beginstand terug. Het rapport en de exports tonen in de demo alleen de voorbeelddata; op de echte server zijn ze er voor elk traject, met alle inzendingen.

Zelf de demo bouwen en bekijken:

```
npm install
npm run demo
npx vite preview --config web/vite.config.ts --outDir ../dist/demo
```

De workflow in `.github/workflows/pages.yml` zet de demo bij elke wijziging op `main` opnieuw op GitHub Pages.

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
| `server/seed/` | Het voorbeeldtraject, de verzonnen voorbeelddata en het bouwen van de demo |
| `web/src/demo.ts` | De nagebootste server voor de demo zonder server |
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

De vormgeving is licht en rustig, naar het voorbeeld van Apple en van de kaartweergave van Maptionnaire. De accentkleuren zijn die van Buro SRO.

- De kaart vult het hele scherm. Het paneel om mee te doen zweeft er los boven; op een telefoon schuift het als blad van onderen in beeld en tijdens het tekenen weg.
- Witte vlakken op lichtgrijs, afgeronde hoeken en zachte schaduwen.
- Keuzes, schalen en tabbladen werken als de segmentknoppen en keuzelijsten van iOS.
- Het systeemlettertype van de lezer: San Francisco op Apple-apparaten, Segoe UI op Windows.
- De kaartmarkering is de boog uit het logo van Buro SRO. Donkerblauw, oker en groen zijn gereserveerd voor knoppen en gegevens.
- In het rapport zweeft de legenda met een balkje per categorie over de kaart, met de teller van alle bijdragen ernaast.
- Alle cijfers in het rapport zijn uit de inzendingen geteld.
- Elke pagina is gecontroleerd op 1440, 768 en 390 pixels breed.

## Gebruikte onderdelen

Leaflet (BSD-2-Clause), Leaflet.heat (BSD-2-Clause), Vue (MIT), Fastify (MIT). Kaartgegevens van het Kadaster via PDOK en van OpenStreetMap-bijdragers. Het logo is van Buro SRO.
