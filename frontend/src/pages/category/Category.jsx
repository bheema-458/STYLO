
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./Category.css";

const products = [
  {
    id: 1,
    name: "Elegant Floral Maxi Dress",
    category: "Casual Wear",
    price: 1499,
    oldPrice: 1999,
    rating: 4.8,
    stock: 12,
    description: "Beautiful floral maxi dress for everyday elegance.",
    image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=700",
  },
  {
    id: 2,
    name: "Traditional Ethnic Kurta",
    category: "Ethnic Wear",
    price: 1299,
    oldPrice: 1699,
    rating: 4.7,
    stock: 8,
    description: "Elegant traditional kurta for special occasions.",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=700",
  },
  {
    id: 3,
    name: "Premium Modest Abaya",
    category: "Modest Wear",
    price: 1899,
    oldPrice: 2499,
    rating: 4.9,
    stock: 5,
    description: "Minimal and graceful modest fashion.",
    image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=700",
  },
  {
    id: 4,
    name: "Elegant Party Wear Dress",
    category: "Party Wear",
    price: 2299,
    oldPrice: 2899,
    rating: 4.8,
    stock: 0,
    description: "A statement outfit for your special moments.",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=700",
  },
  {
    id: 5,
    name: "Classic Office Wear",
    category: "Office Wear",
    price: 1199,
    oldPrice: 1599,
    rating: 4.6,
    stock: 15,
    description: "Comfortable and stylish everyday office wear.",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700",
  },
  {
    id: 6,
    name: "Minimal Gold Necklace",
    category: "Jewellery",
    price: 499,
    oldPrice: 699,
    rating: 4.7,
    stock: 20,
    description: "A delicate accessory to complete your look.",
    image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=700",
  },
  {
    id: 7,
    name: "Classic Everyday Handbag",
    category: "Bags",
    price: 799,
    oldPrice: 1099,
    rating: 4.6,
    stock: 10,
    description: "A versatile handbag for your daily essentials.",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=700",
  },
  {
    id: 8,
    name: "Elegant Fashion Earrings",
    category: "Accessories",
    price: 249,
    oldPrice: 399,
    rating: 4.5,
    stock: 18,
    description: "Beautiful earrings for a subtle statement.",
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700",
  },
];

const categoryDetails = {
  "casual-wear": {
    name: "Casual Wear",
    description: "Discover comfortable and effortless everyday fashion.",
  },
  "ethnic-wear": {
    name: "Ethnic Wear",
    description: "Explore timeless traditional styles and elegant designs.",
  },
  "modest-wear": {
    name: "Modest Wear",
    description: "Discover graceful and comfortable modest fashion.",
  },
  "party-wear": {
    name: "Party Wear",
    description: "Find beautiful outfits for your special occasions.",
  },
  jewellery: {
    name: "Jewellery",
    description: "Complete your look with beautiful accessories.",
  },
  bags: {
    name: "Bags",
    description: "Explore stylish bags for every occasion.",
  },
};

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

export default function CategoryPage() {
  const { categorySlug } = useParams();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");

  const category = categoryDetails[categorySlug];

  const categoryProducts = useMemo(() => {
    if (!category) return [];

    let result = products.filter(
      (product) =>
        product.category.toLowerCase() === category.name.toLowerCase() &&
        product.stock > 0
    );

    if (search.trim()) {
      const query = search.toLowerCase().trim();

      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)
      );
    }

    if (sort === "low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === "az") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [category, search, sort]);

  if (!category) {
    return (
      <main className="category-page">
        <h2>Category Not Found</h2>
        <p>The category you are looking for does not exist.</p>
        <Link to="/">Back to Home</Link>
      </main>
    );
  }

  return (
    <main className="category-page">
      <header className="category-page-header">
        <Link to="/" className="category-back-link">
          ← Back to STYLO
        </Link>

        <span className="eyebrow">STYLO COLLECTION</span>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
      </header>

      <section className="category-products-section">
        <div className="category-products-toolbar">
          <p>
            Showing {categoryProducts.length} products
          </p>

          <div className="category-product-controls">
            <input
              type="search"
              placeholder="Search in this category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
              <option value="az">Name: A to Z</option>
            </select>
          </div>
        </div>

        {categoryProducts.length > 0 ? (
          <div className="category-products-grid">
            {categoryProducts.map((product) => (
              <article className="category-product-card" key={product.id}>
                <div className="category-product-image">
                  <img src={product.image} alt={product.name} />

                  {product.oldPrice > product.price && (
                    <span>
                      {Math.round(
                        ((product.oldPrice - product.price) /
                          product.oldPrice) *
                          100
                      )}
                      % OFF
                    </span>
                  )}
                </div>

                <div className="category-product-info">
                  <small>{product.category}</small>
                  <h3>{product.name}</h3>

                  <p className="category-rating">
                    ★ {product.rating}
                  </p>

                  <div className="category-product-price">
                    <strong>{formatPrice(product.price)}</strong>
                    <del>{formatPrice(product.oldPrice)}</del>
                  </div>

                  <p className="category-stock">
                    In stock: {product.stock}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        `${product.name} - Add to cart integration is the next step.`
                      )
                    }
                  >
                    VIEW PRODUCT →
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="category-empty">
            <h2>No products found</h2>
            <p>
              There are no available products matching your search.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
