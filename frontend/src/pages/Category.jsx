
import { Link } from "react-router-dom";
import "./CategoryPage.css";

const categories = [
  {
    id: 1,
    name: "Dresses",
    description: "Elegant styles for every occasion",
    image:
      "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=700",
  },
  {
    id: 2,
    name: "Tops",
    description: "Everyday fashion essentials",
    image:
      "https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=700",
  },
  {
    id: 3,
    name: "Ethnic Wear",
    description: "Traditional beauty, modern style",
    image:
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=700",
  },
  {
    id: 4,
    name: "Bottom Wear",
    description: "Comfort meets sophistication",
    image:
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=700",
  },
  {
    id: 5,
    name: "Accessories",
    description: "Complete your perfect look",
    image:
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=700",
  },
  {
    id: 6,
    name: "Bags",
    description: "Carry your style everywhere",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=700",
  },
];

function Category() {
  return (
    <div className="category-page">
      <section className="category-hero">
        <div className="category-hero-content">
          <span>EXPLORE STYLO</span>
          <h1>Find Your Style</h1>
          <p>
            Discover collections designed to celebrate your
            individuality and elegance.
          </p>
          <a href="#category-collections" className="category-hero-btn">
            Explore Collections
          </a>
        </div>
      </section>

      <section
        className="category-collections"
        id="category-collections"
      >
        <div className="category-heading">
          <span>OUR COLLECTIONS</span>
          <h2>Shop by Category</h2>
          <p>Discover something beautiful for every moment.</p>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <Link
              to={`/products?category=${category.id}`}
              className="category-card"
              key={category.id}
            >
              <div className="category-image-wrapper">
                <img
                  src={category.image}
                  alt={category.name}
                />
                <div className="category-overlay">
                  <span>EXPLORE COLLECTION</span>
                </div>
              </div>

              <div className="category-card-info">
                <div>
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                </div>
                <span className="category-arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Category;
