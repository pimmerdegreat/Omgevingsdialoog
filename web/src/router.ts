import { createRouter, createWebHashHistory } from 'vue-router';

// Adressen achter een hekje (#/p/naam): zo werkt de site op elke plek zonder serverinstellingen.
export const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', component: () => import('./paginas/Start.vue') },
		{ path: '/p/:slug', component: () => import('./paginas/Meedoen.vue') },
		{ path: '/beheer', component: () => import('./beheer/Beheer.vue') },
		{ path: '/beheer/t/:id', component: () => import('./beheer/TrajectBeheer.vue') },
		{ path: '/:overig(.*)*', redirect: '/' },
	],
	scrollBehavior: () => ({ top: 0 }),
});
