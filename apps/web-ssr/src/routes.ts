import type { RouteRecordRaw } from 'vue-router';
import LayoutDefault from './layouts/LayoutDefault.vue';
import LayoutPortal from './layouts/LayoutPortal.vue';
import HomePage from './pages/HomePage.vue';
import LoginPage from './pages/LoginPage.vue';
import UiKitPage from './pages/UiKitPage.vue';
import B2BPage from './pages/B2BPage.vue';
import ReportsPage from './pages/ReportsPage.vue';
import NewsPage from './pages/NewsPage.vue';
import PricingPage from './pages/PricingPage.vue';
import FaqPage from './pages/FaqPage.vue';
import ContactsPage from './pages/ContactsPage.vue';
import PortalDashboard from './pages/portal/PortalDashboard.vue';
import PortalReports from './pages/portal/PortalReports.vue';
import PortalRoles from './pages/portal/PortalRoles.vue';
import PortalCompetitors from './pages/portal/PortalCompetitors.vue';
import PortalTemplate from './pages/portal/PortalTemplate.vue';
import PortalTeam from './pages/portal/PortalTeam.vue';
import PortalBilling from './pages/portal/PortalBilling.vue';
import PortalSettings from './pages/portal/PortalSettings.vue';
import PortalLeads from './pages/portal/PortalLeads.vue';
import PortalAudit from './pages/portal/PortalAudit.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: LayoutDefault,
    children: [
      { path: '', component: HomePage },
      { path: 'b2b', component: B2BPage },
      { path: 'reports', component: ReportsPage },
      { path: 'news', component: NewsPage },
      { path: 'pricing', component: PricingPage },
      { path: 'faq', component: FaqPage },
      { path: 'contacts', component: ContactsPage },
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
      { path: 'leads', component: PortalLeads },
      { path: 'audit', component: PortalAudit },
      { path: 'billing', component: PortalBilling },
      { path: 'settings', component: PortalSettings }
    ]
  }
];

export default routes;
