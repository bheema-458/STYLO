import React from 'react';
import './AuthLayout.css';

const AuthLayout = ({ children, title, subtitle, badgeText = "WELCOME BACK" }) => {
  // High-fashion dark tone hero images
  const fashionImage = "https://img1.cdn.dorrisbridal.com/image/1200x0/90/1/b7c408c9d850c704/4186d3858a6dac80f852b3a1cb1e55cf.jpg?format=webp";
  // Alternative high-fashion image options:
  // "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1200&auto=format&fit=crop"
  // "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop"

  return (
    <div className="auth-layout">
      {/* LEFT VISUAL SECTION */}
      <div className="auth-visual">
        <img src={fashionImage} alt="STYLO High Fashion" className="auth-hero-image" />
        <div className="auth-visual-overlay"></div>

        <header className="auth-top-header">
          <div className="auth-logo">
            <span className="auth-logo-badge">S</span>
            STYLO
          </div>
          <span className="auth-tag-pill">AUTUMN / WINTER COLLECTION</span>
        </header>

        <main className="auth-brand-content">
          <div className="auth-sub-heading">HAUTE COUTURE & PRÊT-À-PORTER</div>
          <h2>
            “Elegance is an <span>attitude.</span>”
          </h2>
          <p>
            Discover your signature silhouette. Express timeless confidence crafted with exquisite European materials.
          </p>
        </main>

        <footer className="auth-visual-footer">
          <span>© 2026 STYLO INTERNATIONAL S.A.</span>
          <span>EXCLUSIVE ACCESS ONLY</span>
        </footer>
      </div>

      {/* RIGHT FORM SECTION */}
      <div className="auth-form-section">
        <nav className="auth-form-top-nav">
          <span>🌐 EN / EUR</span>
          <span>Client Concierge</span>
        </nav>

        <div className="auth-form-container">
          <div className="form-header">
            <span className="form-badge">• {badgeText}</span>
            <h3>{title || "Sign in to STYLO"}</h3>
            <p>{subtitle || "Your next favourite look is just a step away."}</p>
          </div>

          {/* Children renders your LoginForm or RegisterForm */}
          {children}
        </div>

        <footer className="auth-form-footer">
          <span>Privacy Policy  •  Terms of Service</span>
          <span>STYLO Luxury E-Commerce</span>
        </footer>
      </div>
    </div>
  );
};

export default AuthLayout;