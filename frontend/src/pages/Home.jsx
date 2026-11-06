
import Navbar from "../components/Navbar";
import heroImage from "../assets/hero.png";
import "./Home.css";

function Home() {
  const categories = [
    "Casual Wear",
    "Ethnic Wear",
    "Office Wear",
    "Modest Wear",
    "Party Wear",
    "Accessories",
  ];

  return (
    <div className="home-page">
      <Navbar />

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <p className="hero-label">THE NEW SEASON COLLECTION</p>
            <h1>Style that speaks <br />without saying a word.</h1>
            <p className="hero-description">
              Discover outfits that celebrate your style, confidence and
              individuality.
            </p>
            <a href="/shop" className="hero-button">
              EXPLORE COLLECTION
            </a>
          </div>

          <div className="hero-image">
           <img src={heroImage} alt="STYLO fashion collection" />
          </div>
        </section>

        <section className="category-section" id="categories">
          <p className="section-label">EXPLORE STYLO</p>
          <h2>Shop by Category</h2>

          <div className="category-grid">
            {categories.map((category) => (
              <div className="category-card" key={category}>
                <span>{category}</span>
                <span className="category-arrow">↗</span>
              </div>
            ))}
          </div>
        </section>

        <section className="collection-section">
          <div>
            <p className="section-label">CURATED FOR YOU</p>
            <h2>Find your next favourite look.</h2>
            <p>
              From everyday essentials to special occasion styles,
              discover something beautiful at STYLO.
            </p>
          </div>
          <a href="/shop" className="collection-button">SHOP NOW ↗</a>
        </section>

        <section className="smart-outfit" id="smart-outfit">
          <p className="section-label">STYLO SPECIAL</p>
          <h2>One complete look. Under ₹3000.</h2>
          <p>
            Discover our Smart Outfit collection with dresses and
            matching accessories.
          </p>
          <a href="/shop" className="hero-button">DISCOVER SMART OUTFITS</a>
        </section>
      </main>

      <footer className="home-footer">
        <h2>STYLO.</h2>
        <p>Style is a way to say who you are.</p>
        <p>© 2026 STYLO. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Home;
