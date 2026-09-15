import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { IdentityProvider } from "./contexts/IdentityContext";
import Home from "./views/Home";
import EquipmentDetail from "./views/EquipmentDetail";
import ChangeApplyNew from "./views/apply/ChangeApplyNew";
import PurchaseApplyNew from "./views/apply/PurchaseApplyNew";
import MyApplies from "./views/apply/MyApplies";
import ApprovalCenter from "./views/apply/ApprovalCenter";
import ExecutionBoard from "./views/apply/ExecutionBoard";
import AcceptancePage from "./views/apply/AcceptancePage";
import NotificationsPage from "./views/apply/NotificationsPage";
import ApplySettings from "./views/apply/ApplySettings";
import { Route, Switch } from "wouter";

function Workspace() { return <DashboardLayout><Home /></DashboardLayout>; }

function App() {
  return <ErrorBoundary><LanguageProvider><ThemeProvider defaultTheme="light"><IdentityProvider><TooltipProvider><Toaster richColors position="top-right" /><Switch><Route path="/" component={Workspace} /><Route path="/dashboard" component={Workspace} /><Route path="/equipment/:id"><DashboardLayout><EquipmentDetail /></DashboardLayout></Route><Route path="/equipment" component={Workspace} /><Route path="/maintenance" component={Workspace} /><Route path="/repairs" component={Workspace} /><Route path="/parts" component={Workspace} /><Route path="/users" component={Workspace} /><Route path="/apply/change/new" component={ChangeApplyNew} /><Route path="/apply/purchase/new" component={PurchaseApplyNew} /><Route path="/apply/mine" component={MyApplies} /><Route path="/approvals" component={ApprovalCenter} /><Route path="/apply/execution" component={ExecutionBoard} /><Route path="/apply/acceptance" component={AcceptancePage} /><Route path="/apply/settings" component={ApplySettings} /><Route path="/apply/notifications" component={NotificationsPage} /><Route component={Workspace} /></Switch></TooltipProvider></IdentityProvider></ThemeProvider></LanguageProvider></ErrorBoundary>;
}

export default App;
