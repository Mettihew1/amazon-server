// services/productService.js
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_API_URL}/api/prod`;

export const getProductById = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

export const getAllProducts = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};