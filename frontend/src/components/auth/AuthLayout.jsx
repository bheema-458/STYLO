
import "./AuthLayout.css";
import heroImage from "../../assets/hero.png";

function AuthLayout({ children }) {
  return (
    <main className="auth-layout">

      {/* Left Fashion Image Section */}
      <section className="auth-visual">
        <img
          src={heroImage}
          alt="STYLO fashion collection"
          className="auth-hero-image"
        />

        <div className="auth-visual-overlay"></div>

        <div className="auth-brand-content">
          <h1>STYLO<span>.</span></h1>

          <h2>Elegance is an attitude.</h2>

          <p>
            Discover your style.
            <br />
            Express your confidence.
          </p>
        </div>

        <p className="auth-image-caption">
          THE ART OF PERSONAL STYLE
        </p>
      </section>

      {/* Right Form Section */}
      <section className="auth-form-section">
        {children}
      </section>

    </main>
  );
}

export default AuthLayout;
