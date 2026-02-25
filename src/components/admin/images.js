/**
 * Admin Image Management Module
 * Handles product image upload with drag-drop, preview, and cropper
 */

import { functions } from '../../services/firebase.js';
import { showToast } from '../../utils/dom.js';
import { logError } from '../../utils/errorHandler.js';

// State
let cropperInstance = null;
let currentProductId = null;
let pendingFile = null;

/**
 * Initialize image upload for a product row
 * @param {string|number} productId - Product ID
 */
export function initImageUpload(productId) {
    const container = document.getElementById(`img-upload-${productId}`);
    if (!container) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area on drag
    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => {
            container.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => {
            container.classList.remove('drag-over');
        }, false);
    });

    // Handle dropped files
    container.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) handleFileSelection(files[0], productId);
    }, false);

    // Handle file input change
    const fileInput = container.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFileSelection(e.target.files[0], productId);
        });
    }
}

/**
 * Handle file selection - show preview first
 * @param {File} file - Selected file
 * @param {string|number} productId - Product ID
 */
function handleFileSelection(file, productId) {
    // Validate file
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPG, PNG, WebP)', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('File is too large. Maximum size is 10MB.', 'error');
        return;
    }

    currentProductId = productId;
    pendingFile = file;

    // Show preview modal
    showImagePreview(file, productId);
}

/**
 * Show image preview modal before upload
 * @param {File} file - Image file
 * @param {string|number} productId - Product ID
 */
function showImagePreview(file, productId) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const modal = document.getElementById('imagePreviewModal');
        const previewImg = document.getElementById('previewImage');
        const productNameEl = document.getElementById('previewProductName');
        
        if (!modal || !previewImg) {
            // Fallback: open cropper directly
            openCropper(e.target.result, productId);
            return;
        }

        // Get product name
        const product = window.products?.find(p => String(p.id) === String(productId));
        if (productNameEl) productNameEl.textContent = product?.name || 'Product';

        previewImg.src = e.target.result;
        
        // Setup buttons
        const cancelBtn = document.getElementById('previewCancelBtn');
        const cropBtn = document.getElementById('previewCropBtn');
        const uploadBtn = document.getElementById('previewUploadBtn');

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                pendingFile = null;
            };
        }

        if (cropBtn) {
            cropBtn.onclick = () => {
                modal.style.display = 'none';
                openCropper(e.target.result, productId);
            };
        }

        if (uploadBtn) {
            uploadBtn.onclick = () => {
                modal.style.display = 'none';
                uploadImageDirectly(e.target.result, productId);
            };
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    reader.onerror = () => {
        showToast('Failed to read image file', 'error');
    };

    reader.readAsDataURL(file);
}

/**
 * Open cropper modal
 * @param {string} imageSrc - Image data URL
 * @param {string|number} productId - Product ID
 */
function openCropper(imageSrc, productId) {
    const modal = document.getElementById('cropperModal');
    const cropperImg = document.getElementById('cropperImage');

    if (!modal || !cropperImg) {
        showToast('Cropper not available. Uploading without crop...', 'info');
        uploadImageDirectly(imageSrc, productId);
        return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Destroy existing cropper
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    // Load image and init cropper
    cropperImg.onload = () => {
        if (typeof window.Cropper !== 'function') {
            showToast('Cropper library not loaded. Uploading original...', 'info');
            closeCropperModal();
            uploadImageDirectly(imageSrc, productId);
            return;
        }

        try {
            cropperInstance = new window.Cropper(cropperImg, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 0.9,
                responsive: true,
                background: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                minCropBoxWidth: 200,
                minCropBoxHeight: 200,
            });
        } catch (err) {
            logError(err, 'cropper init');
            showToast('Failed to initialize cropper', 'error');
            uploadImageDirectly(imageSrc, productId);
        }
    };

    cropperImg.src = imageSrc;

    // Setup save button
    const saveBtn = document.getElementById('saveCropBtn');
    if (saveBtn) {
        saveBtn.onclick = () => cropAndUpload();
    }
}

/**
 * Crop and upload image
 */
async function cropAndUpload() {
    if (!cropperInstance || !currentProductId) return;

    const saveBtn = document.getElementById('saveCropBtn');
    const originalText = saveBtn?.textContent || 'Save';

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Processing...';
        }

        const canvas = cropperInstance.getCroppedCanvas({
            width: 800,
            height: 800,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        if (!canvas) throw new Error('Failed to crop image');

        const base64Image = canvas.toDataURL('image/jpeg', 0.9);
        await uploadToCloud(base64Image, currentProductId);

    } catch (err) {
        logError(err, 'cropAndUpload', true);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

/**
 * Upload image directly without cropping
 * @param {string} base64Image - Image data URL
 * @param {string|number} productId - Product ID
 */
async function uploadImageDirectly(base64Image, productId) {
    showToast('Uploading image...', 'info');
    
    // Show loading on the product row
    setImageLoading(productId, true);

    try {
        await uploadToCloud(base64Image, productId);
    } finally {
        setImageLoading(productId, false);
    }
}

/**
 * Upload image to Cloud Function
 * Falls back to direct Firestore update if Cloud Function fails
 * @param {string} base64Image - Base64 image data
 * @param {string|number} productId - Product ID
 */
async function uploadToCloud(base64Image, productId) {
    try {
        const uploadFn = functions.httpsCallable('uploadProductImage');
        const result = await uploadFn({
            productId: productId,
            base64Image: base64Image
        });

        if (!result.data?.success) {
            throw new Error(result.data?.message || 'Upload failed');
        }

        const url = result.data.url;

        // Update UI
        updateProductImage(productId, url);
        
        // Update hidden input for form save
        const hiddenInput = document.getElementById(`image-${productId}`);
        if (hiddenInput) hiddenInput.value = url;

        // Show appropriate message based on storage type
        if (result.data.storageType === 'base64') {
            showToast('Image saved (base64 mode). Click "Save All" to persist.', 'success');
        } else {
            showToast('Image uploaded successfully!', 'success');
        }
        
        closeCropperModal();

    } catch (error) {
        console.error('Cloud Function upload failed:', error);
        
        // Try client-side fallback - update Firestore directly
        try {
            showToast('Cloud upload failed. Trying direct save...', 'info');
            await clientSideFallbackUpload(base64Image, productId);
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            
            // Better error messages
            let message = 'Failed to upload image';
            if (error.code === 'unauthenticated') {
                message = 'Please sign in to upload images';
            } else if (error.code === 'permission-denied') {
                message = 'You do not have permission to upload images';
            } else if (error.message?.includes('network')) {
                message = 'Network error. Please check your connection.';
            } else if (error.message?.includes('bucket')) {
                message = 'Storage not configured. Using base64 fallback - click "Save All" to save changes.';
                // Store in local state temporarily
                updateProductImage(productId, base64Image);
                const hiddenInput = document.getElementById(`image-${productId}`);
                if (hiddenInput) hiddenInput.value = base64Image;
                closeCropperModal();
                return;
            } else if (error.message) {
                message = error.message;
            }
            
            showToast(message, 'error');
            throw error;
        }
    }
}

/**
 * Client-side fallback - update Firestore directly
 * @param {string} base64Image - Base64 image data
 * @param {string|number} productId - Product ID
 */
async function clientSideFallbackUpload(base64Image, productId) {
    try {
        const { db, firebase } = await import('../../services/firebase.js');
        
        await db.collection('products').doc(productId.toString()).update({
            image: base64Image,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update UI
        updateProductImage(productId, base64Image);
        
        // Update hidden input
        const hiddenInput = document.getElementById(`image-${productId}`);
        if (hiddenInput) hiddenInput.value = base64Image;

        showToast('Image saved directly! Click "Save All" to confirm.', 'success');
        closeCropperModal();
        
    } catch (error) {
        logError(error, 'clientSideFallbackUpload');
        throw error;
    }
}

/**
 * Update product image in the UI
 * @param {string|number} productId - Product ID
 * @param {string} url - New image URL
 */
function updateProductImage(productId, url) {
    // Update thumbnail
    const previewEl = document.getElementById(`img-preview-${productId}`);
    if (previewEl) {
        previewEl.src = url;
        previewEl.style.display = 'block';
        previewEl.classList.remove('error');
        
        // Add a flash effect to show update
        previewEl.style.animation = 'flash 0.5s ease';
        setTimeout(() => {
            previewEl.style.animation = '';
        }, 500);
    }

    // Update upload container background if it was showing placeholder
    const container = document.getElementById(`img-upload-${productId}`);
    if (container) {
        container.classList.remove('no-image');
        container.classList.add('has-image');
    }
}

/**
 * Set loading state on image upload
 * @param {string|number} productId - Product ID
 * @param {boolean} loading - Loading state
 */
function setImageLoading(productId, loading) {
    const container = document.getElementById(`img-upload-${productId}`);
    if (container) {
        container.classList.toggle('loading', loading);
    }
}

/**
 * Close cropper modal
 */
export function closeCropperModal() {
    const modal = document.getElementById('cropperModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    const previewModal = document.getElementById('imagePreviewModal');
    if (previewModal) {
        previewModal.style.display = 'none';
    }
    
    document.body.style.overflow = 'auto';

    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    
    currentProductId = null;
    pendingFile = null;
}

/**
 * Trigger file input click
 * @param {string|number} productId - Product ID
 */
export function triggerFileInput(productId) {
    const input = document.querySelector(`#img-upload-${productId} input[type="file"]`);
    if (input) input.click();
}

/**
 * Legacy upload handler - now handled by initImageUpload
 * @deprecated Use initImageUpload instead
 */
export function adminUploadImage(event, productId) {
    // This function is kept for backward compatibility
    // The new system uses initImageUpload which sets up event listeners
    if (event?.target?.files?.[0]) {
        handleFileSelection(event.target.files[0], productId);
    }
}

/**
 * Legacy crop and upload - now handled internally
 * @deprecated Cropping is now handled automatically
 */
export function cropAndUploadImage() {
    // This function is kept for backward compatibility
    // The new system handles cropping via the cropAndUpload function
    return cropAndUpload();
}

/**
 * Initialize cropper modal keyboard shortcuts
 */
export function initCropperKeyboardShortcuts() {
    // Remove any existing listener to prevent duplicates
    document.removeEventListener('keydown', handleEscapeKey);
    document.addEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        const cropperModal = document.getElementById('cropperModal');
        const previewModal = document.getElementById('imagePreviewModal');
        
        if (previewModal && previewModal.style.display !== 'none') {
            closeCropperModal();
        } else if (cropperModal && cropperModal.style.display !== 'none') {
            closeCropperModal();
        }
    }
}

// Expose to window for onclick handlers
if (typeof window !== 'undefined') {
    window.triggerFileInput = triggerFileInput;
}
