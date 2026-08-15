import { Switch, Route, Router as WouterRouter } from "wouter"
import IndexPage from "@/pages/Index"
import PrivacyPage from "@/pages/Privacy"
import TermsPage from "@/pages/Terms"
import GuidePage from "@/pages/Guide"
import NotFound from "@/pages/not-found"

function Router() {
  return (
    <Switch>
      <Route path="/" component={IndexPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/guide" component={GuidePage} />
      <Route component={NotFound} />
    </Switch>
  )
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  )
}

export default App
