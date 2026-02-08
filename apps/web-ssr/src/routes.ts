import type { RouteRecordRaw } from 'vue-router';
import LayoutDefault from './layouts/LayoutDefault.vue';
import LayoutPortal from './layouts/LayoutPortal.vue';
import HomePage from './pages/HomePage.vue';
import LoginPage from './pages/LoginPage.vue';
import UiKitPage from './pages/UiKitPage.vue';
import PortalDashboard from './pages/portal/PortalDashboard.vue';
import PortalReports from './pages/portal/PortalReports.vue';
import PortalRoles from './pages/portal/PortalRoles.vue';
import PortalCompetitors from './pages/portal/PortalCompetitors.vue';
import PortalTemplate from './pages/portal/PortalTemplate.vue';
import PortalTeam from './pages/portal/PortalTeam.vue';
import PortalBilling from './pages/portal/PortalBilling.vue';
import PortalSettings from './pages/portal/PortalSettings.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: LayoutDefault,
    children: [
      { path: '', component: HomePage },
      { path: 'login', component: LoginPage },
      { path: 'ui-kit', component: UiKitPage }
    ]
  },
  {
    path: '/portal',
    component: LayoutPortal,
    children: [
      { path: '', component: PortalDashboard },
      { path: 'reports', component: PortalReports },
      { path: 'roles', component: PortalRoles },
      { path: 'competitors', component: PortalCompetitors },
      { path: 'template', component: PortalTemplate },
      { path: 'team', component: PortalTeam },
      { path: 'billing', component: PortalBilling },
      { path: 'settings', component: PortalSettings }
    ]
  }
];

export default routes;
