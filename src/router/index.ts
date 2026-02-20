import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "overview",
      component: () => import("@/pages/FleetOverview.vue"),
      meta: { title: "Přehled flotily" },
    },
    {
      path: "/map",
      name: "map",
      component: () => import("@/pages/LiveMap.vue"),
      meta: { title: "Živá mapa" },
    },
    {
      path: "/history",
      name: "history",
      component: () => import("@/pages/TripHistory.vue"),
      meta: { title: "Historie jízd" },
    },
    {
      path: "/events",
      name: "events",
      component: () => import("@/pages/Events.vue"),
      meta: { title: "Události" },
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: { name: "overview" },
    },
  ],
});

router.afterEach((to) => {
  document.title = `${String(to.meta?.title ?? "Fleet Insights")} — GPS Dozor`;
});

export default router;
