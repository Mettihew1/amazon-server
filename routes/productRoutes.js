import express from 'express';
import Product from '../models/ProductModel.js';
import asyncHandler from 'express-async-handler';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function for calculating average rating
const calculateAverageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, item) => acc + item.rating, 0);
  return parseFloat((sum / reviews.length).toFixed(1));
};



// Get all products (for admin)
router.get(
  '/admin',
  asyncHandler(async (req, res) => {
    try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
  })
);

// Update featured status
router.put(
  '/:id/featured',
  asyncHandler(async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { featured: req.body.featured },
        { new: true } // Return the updated document
      );
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error updating featured status:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  })
);


// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const featuredProducts = await Product.find({ featured: true })
    .select('-reviews') // Exclude reviews if not needed
    .limit(8);
    console.log(featuredProducts);
    res.json(featuredProducts);
  })
);

// @desc    Fetch all products with pagination and search
// @route   GET /api/products
// @access  Public
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const pageSize = 8;
    const page = Number(req.query.pageNumber) || 1;
    
    const keyword = req.query.keyword ? {
      $or: [
        { name: { $regex: req.query.keyword, $options: 'i' } },
        { brand: { $regex: req.query.keyword, $options: 'i' } },
        { category: { $regex: req.query.keyword, $options: 'i' } }
      ]
    } : {};

    const count = await Product.countDocuments({ ...keyword });
    const products = await Product.find({ ...keyword })
      .select('-reviews') // Exclude reviews for list view
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({ 
      products, 
      page, 
      pages: Math.ceil(count / pageSize),
      count 
    });
  })
);

// @desc    Fetch single product with populated reviews
// @route   GET /api/products/:id
// @access  Public
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
      .populate('reviews.user', 'name email'); // Populate review user info

    if (product) {
      // Ensure rating is calculated if missing
      if (!product.rating || product.rating === 0) {
        product.rating = calculateAverageRating(product.reviews);
        await product.save();
      }
      res.json(product);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  })
);

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete(
  '/:id',
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    await product.remove();
    res.json({ message: 'Product removed successfully' });
  })
);

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
router.post(
  '/',
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const product = new Product({
      name: req.body.name || 'Sample name',
      price: req.body.price || 0,
      user: req.user._id,
      image: req.body.image || '/images/sample.jpg',
      brand: req.body.brand || 'Sample brand',
      category: req.body.category || 'Sample category',
      countInStock: req.body.countInStock || 0,
      description: req.body.description || 'Sample description',
      featured: req.body.featured || false
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  })
);

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put(
  '/:id',
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    // Update only provided fields
    const updatableFields = [
      'name', 'price', 'description', 'image', 
      'brand', 'category', 'countInStock', 'featured'
    ];
    
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  })
);

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
router.post(
  '/:id/reviews',
  protect,
  asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    
    if (!rating || !comment) {
      res.status(400);
      throw new Error('Please provide both rating and comment');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const alreadyReviewed = product.reviews.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      res.status(400);
      throw new Error('You have already reviewed this product');
    }

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating = calculateAverageRating(product.reviews);

    await product.save();
    res.status(201).json({ 
      message: 'Review added successfully',
      review
    });
  })
);

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
router.get(
  '/top',
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 3;
    const products = await Product.find({})
      .sort({ rating: -1 })
      .limit(limit)
      .select('-reviews'); // Exclude reviews for performance

    res.json(products);
  })
);

export default router;