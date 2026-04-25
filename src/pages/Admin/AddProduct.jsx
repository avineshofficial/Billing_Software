import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiCamera, FiLoader } from 'react-icons/fi';
import { db, storage } from '../../services/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import styles from './AddProduct.module.css';

const AddProduct = () => {
  const { id } = useParams(); // For Edit mode
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '', // Manual entry category
    mrp: '',
    salePrice: '',
    stock: '',
    gst: '0' // Default 18%
  });

  // Fetch product if in Edit mode
  useEffect(() => {
    if (id) {
      const fetchProduct = async () => {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData(data);
          if (data.image) setPreview(data.image);
        }
      };
      fetchProduct();
    }
  }, [id]);

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert("Product Name is required!");
    
    setLoading(true);
    try {
      let imageUrl = formData.image || '';

      // Upload image if a new one is selected
      if (imageFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      // Prepare data (Number defaults handle blank strings as 0)
      const productData = {
        name: formData.name,
        sku: formData.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
        category: formData.category || 'General',
        mrp: Number(formData.mrp) || 0,
        salePrice: Number(formData.salePrice) || 0,
        stock: Number(formData.stock) || 0,
        gst: Number(formData.gst) || 0,
        image: imageUrl,
        updatedAt: serverTimestamp()
      };

      if (id) {
        await updateDoc(doc(db, "products", id), productData);
      } else {
        productData.createdAt = serverTimestamp();
        await addDoc(collection(db, "products"), productData);
      }

      navigate('/admin');
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save. Check console.");
    }
    setLoading(false);
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.backLink} onClick={() => navigate('/admin')}>
        <FiChevronLeft size={16} /> BACK
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{id ? "Edit Product" : "Add New Product"}</h2>
        </div>

        <form onSubmit={handleSave} className={styles.cardBody}>
          {/* Image Section */}
          <div className={styles.imageUploadSection}>
            <label className={styles.imagePlaceholder}>
              {preview ? (
                <img src={preview} alt="Preview" />
              ) : (
                <FiCamera size={32} color="#94a3b8" />
              )}
              <input type="file" accept="image/*" hidden onChange={handleImageChange} />
            </label>
            <span className={styles.uploadLabel}>Optional Photo</span>
          </div>

          {/* Form Grid */}
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>Product Name*</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. Chocolate Milkshake"
                required 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>SKU (Optional)</label>
              <input 
                type="text" 
                value={formData.sku} 
                onChange={(e) => setFormData({...formData, sku: e.target.value})} 
                placeholder="Leave empty for AUTO"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Category (Enter Manually)</label>
              <input 
                type="text" 
                value={formData.category} 
                onChange={(e) => setFormData({...formData, category: e.target.value})} 
                placeholder="e.g. Beverages, Snacks"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>GST %</label>
              <input 
                type="number" 
                value={formData.gst} 
                onChange={(e) => setFormData({...formData, gst: e.target.value})} 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>MRP</label>
              <input 
                type="number" 
                value={formData.mrp} 
                onChange={(e) => setFormData({...formData, mrp: e.target.value})} 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Sale Price</label>
              <input 
                type="number" 
                value={formData.salePrice} 
                onChange={(e) => setFormData({...formData, salePrice: e.target.value})} 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Stock</label>
              <input 
                type="number" 
                value={formData.stock} 
                onChange={(e) => setFormData({...formData, stock: e.target.value})} 
              />
            </div>
          </div>

          <button type="submit" className={styles.btnSave} disabled={loading}>
            {loading ? <FiLoader className="spin" /> : "Save Product"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;