// Script van het resultatenrapport: de kaart, de legenda en het zoeken in toelichtingen.
// Draait zonder bouwstap in de browser van de lezer; Leaflet en boogSvg zijn eerder in het document geladen.
(function () {
	'use strict';

	var gegevens = JSON.parse(document.getElementById('gegevens').textContent);
	var minderBeweging = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ---- Staven laten groeien zodra ze in beeld komen ----
	if (!minderBeweging && 'IntersectionObserver' in window) {
		document.body.classList.add('beweeg');
		var kijker = new IntersectionObserver(
			function (items) {
				items.forEach(function (item) {
					if (item.isIntersecting) {
						item.target.classList.add('in-beeld');
						kijker.unobserve(item.target);
					}
				});
			},
			{ rootMargin: '0px 0px -8% 0px' },
		);
		document.querySelectorAll('.staven li').forEach(function (li, i) {
			li.querySelector('.staaf').style.transitionDelay = (i % 8) * 40 + 'ms';
			kijker.observe(li);
		});
	}

	function veilig(tekst) {
		var div = document.createElement('div');
		div.textContent = tekst;
		return div.innerHTML;
	}

	// ---- Kaart ----
	var kaartEl = document.getElementById('kaart');
	var kaart = null;
	var lagenPerCategorie = [];
	var markeringen = [];
	var planLaag = null;
	var dichtheid = null;
	var weergave = 'punten';
	var aan = gegevens.categorieen.map(function () {
		return true;
	});

	function ballon(categorie, tekst) {
		return (
			'<p class="ballon-kop">' + boogSvg(categorie.kleur, 'boog-klein') + veilig(categorie.label) + '</p>' +
			'<p>' + (tekst ? veilig(tekst) : 'Zonder toelichting.') + '</p>'
		);
	}

	function midden(geometrie) {
		if (geometrie.type === 'Point') return [geometrie.coordinates[1], geometrie.coordinates[0]];
		var punten = geometrie.type === 'LineString' ? geometrie.coordinates : geometrie.coordinates[0];
		var lat = 0;
		var lng = 0;
		punten.forEach(function (p) {
			lng += p[0];
			lat += p[1];
		});
		return [lat / punten.length, lng / punten.length];
	}

	function tekenDichtheid() {
		if (dichtheid) {
			kaart.removeLayer(dichtheid);
			dichtheid = null;
		}
		if (weergave !== 'dichtheid') return;
		var punten = gegevens.bijdragen
			.filter(function (b) {
				return aan[b.c];
			})
			.map(function (b) {
				return midden(b.g).concat([1]);
			});
		dichtheid = L.heatLayer(punten, {
			radius: 30,
			blur: 24,
			minOpacity: 0.25,
			max: 3,
			gradient: { 0.25: '#f3dfa6', 0.55: '#d59800', 0.8: '#c4621f', 1: '#b4472f' },
		}).addTo(kaart);
	}

	function werkKaartBij() {
		lagenPerCategorie.forEach(function (laag, i) {
			var tonen = aan[i] && weergave === 'punten';
			if (tonen && !kaart.hasLayer(laag)) kaart.addLayer(laag);
			if (!tonen && kaart.hasLayer(laag)) kaart.removeLayer(laag);
		});
		tekenDichtheid();
	}

	function maakKaart() {
		if (!kaartEl || typeof L === 'undefined') return;
		document.body.classList.add('met-kaart');
		var k = gegevens.kaart;
		kaart = L.map(kaartEl, { scrollWheelZoom: false, zoomSnap: 0.5, zoomControl: false }).setView([k.centrum[1], k.centrum[0]], k.zoom);
		// Links ligt de legenda en rechtsboven de teller: de zoomknoppen staan daarom rechtsonder.
		L.control.zoom({ position: 'bottomright', zoomInTitle: 'Inzoomen', zoomOutTitle: 'Uitzoomen' }).addTo(kaart);
		kaart.attributionControl.setPrefix(false);
		// Scrollen over de pagina mag de kaart niet per ongeluk laten zoomen: pas na een klik op de kaart.
		kaart.on('click', function () {
			kaart.scrollWheelZoom.enable();
		});
		kaartEl.addEventListener('mouseleave', function () {
			kaart.scrollWheelZoom.disable();
		});

		var ondergrond = null;
		function kiesOndergrond(id) {
			var o = k.ondergronden.filter(function (x) {
				return x.id === id;
			})[0] || k.ondergronden[0];
			if (ondergrond) kaart.removeLayer(ondergrond);
			ondergrond = L.tileLayer(o.url, { maxZoom: 20, maxNativeZoom: o.maxZoom, attribution: o.bron }).addTo(kaart);
			ondergrond.bringToBack();
		}
		kiesOndergrond(k.ondergronden[0].id);
		var kiezer = document.getElementById('ondergrond');
		if (kiezer) {
			kiezer.addEventListener('change', function () {
				kiesOndergrond(kiezer.value);
			});
		}

		// Planonderdelen: gestreept, onder de bijdragen.
		planLaag = L.layerGroup().addTo(kaart);
		gegevens.onderdelen.forEach(function (o) {
			var tekst =
				'<p class="ballon-kop">' + veilig(o.titel) + '</p>' +
				'<p>Goed idee: ' + o.goed + '. Twijfel: ' + o.twijfel + '. Geen goed idee: ' + o.niet + '.</p>';
			var laag;
			if (o.geometrie.type === 'Point') {
				laag = L.circleMarker([o.geometrie.coordinates[1], o.geometrie.coordinates[0]], {
					radius: 13,
					color: o.kleur,
					weight: 3,
					dashArray: '5 5',
					fillColor: o.kleur,
					fillOpacity: 0.15,
				});
			} else {
				laag = L.geoJSON(o.geometrie, { style: { color: o.kleur, weight: 4, dashArray: '8 7', fillColor: o.kleur, fillOpacity: 0.15 } });
			}
			laag.bindPopup(tekst).addTo(planLaag);
		});

		// Bijdragen: één laaggroep per categorie, zodat de legenda ze kan aan- en uitzetten.
		lagenPerCategorie = gegevens.categorieen.map(function () {
			return L.layerGroup();
		});
		var grenzen = [];
		gegevens.bijdragen.forEach(function (b, i) {
			var categorie = gegevens.categorieen[b.c];
			var laag;
			if (b.g.type === 'Point') {
				laag = L.marker([b.g.coordinates[1], b.g.coordinates[0]], {
					icon: L.divIcon({ className: 'dk-marker', html: boogSvg(categorie.kleur), iconSize: [24, 32], iconAnchor: [12, 31], popupAnchor: [0, -30] }),
					keyboard: false,
				});
			} else {
				laag = L.geoJSON(b.g, { style: { color: categorie.kleur, weight: 4, opacity: 0.75, fillColor: categorie.kleur, fillOpacity: 0.2 } });
			}
			laag.bindPopup(ballon(categorie, b.t));
			laag.addTo(lagenPerCategorie[b.c]);
			markeringen[i] = laag;
			grenzen.push(midden(b.g));
		});
		gegevens.onderdelen.forEach(function (o) {
			grenzen.push(midden(o.geometrie));
		});
		if (grenzen.length > 1) {
			// Op een breed scherm ligt de legenda links over de kaart; de bijdragen komen ernaast in beeld.
			var paneel = document.querySelector('.kaartpaneel');
			var links = paneel && getComputedStyle(paneel).position === 'absolute' ? paneel.offsetWidth + 32 : 24;
			kaart.fitBounds(L.latLngBounds(grenzen), { paddingTopLeft: [links, 72], paddingBottomRight: [56, 24], maxZoom: 17 });
		}
		werkKaartBij();
	}

	try {
		maakKaart();
	} catch (fout) {
		document.body.classList.remove('met-kaart');
	}

	// ---- Legenda en weergave ----
	document.querySelectorAll('.legenda-knop').forEach(function (knop) {
		knop.addEventListener('click', function () {
			var nu = knop.getAttribute('aria-pressed') !== 'true';
			knop.setAttribute('aria-pressed', String(nu));
			if (!kaart) return;
			if (knop.hasAttribute('data-plan')) {
				if (nu) kaart.addLayer(planLaag);
				else kaart.removeLayer(planLaag);
				return;
			}
			aan[Number(knop.getAttribute('data-categorie'))] = nu;
			werkKaartBij();
		});
	});

	document.querySelectorAll('[data-weergave]').forEach(function (knop) {
		knop.addEventListener('click', function () {
			weergave = knop.getAttribute('data-weergave');
			document.querySelectorAll('[data-weergave]').forEach(function (k) {
				k.setAttribute('aria-pressed', String(k === knop));
			});
			if (kaart) werkKaartBij();
		});
	});

	// ---- Toelichtingen: zoeken, filteren en tonen op de kaart ----
	var lijst = document.getElementById('toelichtingenlijst');
	if (lijst) {
		var zoek = document.getElementById('zoek');
		var kies = document.getElementById('filter-categorie');
		var telling = document.getElementById('filter-telling');
		var leeg = document.getElementById('filter-leeg');
		var items = Array.prototype.slice.call(lijst.children);

		function filter() {
			var woord = zoek.value.trim().toLowerCase();
			var categorie = kies.value;
			var zichtbaar = 0;
			items.forEach(function (li) {
				var past = (!categorie || li.getAttribute('data-categorie') === categorie) && (!woord || li.textContent.toLowerCase().indexOf(woord) !== -1);
				li.hidden = !past;
				if (past) zichtbaar++;
			});
			telling.textContent = zichtbaar + ' van ' + items.length + ' toelichtingen';
			leeg.hidden = zichtbaar !== 0;
		}
		zoek.addEventListener('input', filter);
		kies.addEventListener('change', filter);
		filter();

		lijst.addEventListener('click', function (gebeurtenis) {
			var knop = gebeurtenis.target.closest('[data-toon]');
			if (!knop || !kaart) return;
			var nr = Number(knop.getAttribute('data-toon'));
			var bijdrage = gegevens.bijdragen[nr];
			var laag = markeringen[nr];
			if (!laag) return;
			// Zorg dat de categorie zichtbaar is en de markeringen getoond worden.
			aan[bijdrage.c] = true;
			weergave = 'punten';
			document.querySelectorAll('.legenda-knop[data-categorie="' + bijdrage.c + '"]').forEach(function (k) {
				k.setAttribute('aria-pressed', 'true');
			});
			document.querySelectorAll('[data-weergave]').forEach(function (k) {
				k.setAttribute('aria-pressed', String(k.getAttribute('data-weergave') === 'punten'));
			});
			werkKaartBij();
			document.getElementById('kaartdeel').scrollIntoView({ behavior: minderBeweging ? 'auto' : 'smooth', block: 'start' });
			var plek = midden(bijdrage.g);
			kaart.setView(plek, Math.max(kaart.getZoom(), 17));
			laag.openPopup(plek);
		});
	}
})();
