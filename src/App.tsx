import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Work } from "./components/Work";
import { Now } from "./components/Now";
import { Ask } from "./components/Ask";
import { Links } from "./components/Links";
import { Footer } from "./components/Footer";
import { MusicProvider } from "./components/MusicPlayer";
import { KanaMarquee } from "./components/AnimeFx";

export default function App() {
  return (
    <MusicProvider>
    <div className="min-h-screen overflow-x-clip bg-paper text-ink">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Work />
        <KanaMarquee />
        <Now />
        <Ask />
        <Links />
      </main>
      <Footer />
    </div>
    </MusicProvider>
  );
}
