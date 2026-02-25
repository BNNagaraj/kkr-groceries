const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

initializeApp();
const db = getFirestore();

// Try to get storage, but don't fail if it's not configured
let storage;
try {
  storage = getStorage();
} catch (e) {
  console.warn("Storage not initialized:", e.message);
}

/**
 * Upload product image to Storage
 * Falls back to base64 storage in Firestore if Storage bucket doesn't exist
 */
exports.uploadProductImage = onCall(async (request) => {
  try {
    const data = request.data;
    if (!data || !data.productId || !data.base64Image) {
      throw new HttpsError("invalid-argument", "Missing productId or base64Image.");
    }

    const { productId, base64Image } = data;
    
    // Validate base64 image size (max 1MB for base64, ~750KB actual)
    const base64Size = base64Image.length * 0.75; // Approximate bytes
    if (base64Size > 1024 * 1024) {
      throw new HttpsError("invalid-argument", "Image too large. Maximum size is 1MB.");
    }

    // Try Storage first, fall back to base64 in Firestore
    let imageUrl;
    let storageAvailable = false;
    
    if (storage) {
      try {
        const bucket = storage.bucket();
        // Test if bucket exists by trying to get metadata
        await bucket.getMetadata();
        storageAvailable = true;
      } catch (bucketError) {
        console.warn("Storage bucket not available:", bucketError.message);
        storageAvailable = false;
      }
    }

    if (storageAvailable) {
      // Upload to Storage
      try {
        const bucket = storage.bucket();
        const filePath = `products/${productId}-${Date.now()}.jpg`;
        const file = bucket.file(filePath);

        // Decode base64
        const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");

        // Upload to Storage
        await file.save(buffer, {
          metadata: { contentType: "image/jpeg" },
          public: true,
        });

        // Construct Public URL
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        
        console.log(`Image uploaded to Storage: ${imageUrl}`);
      } catch (storageError) {
        console.error("Storage upload failed:", storageError);
        // Fall back to base64
        imageUrl = base64Image;
        console.log("Falling back to base64 storage");
      }
    } else {
      // Store as base64 in Firestore directly
      imageUrl = base64Image;
      console.log("Storage not available, using base64 storage");
    }

    // Update Firestore
    await db.collection("products").doc(productId.toString()).update({ 
      image: imageUrl,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      url: imageUrl,
      storageType: storageAvailable ? 'storage' : 'base64'
    };
    
  } catch (error) {
    console.error("Error in uploadProductImage:", error);
    throw new HttpsError(
      error.code || "internal", 
      error.message || "Upload failed"
    );
  }
});

/**
 * Submit order - stores order and sends email notification
 */
exports.submitOrder = onCall(async (request) => {
  try {
    const data = request.data;
    if (!data || !data.cart || data.cart.length === 0) {
      throw new HttpsError("invalid-argument", "Order must contain items.");
    }
    if (!data.customerName || !data.customerPhone) {
      throw new HttpsError("invalid-argument", "Missing required customer details.");
    }

    const orderId = `ORD-${Date.now()}`;
    const orderDoc = {
      id: orderId,
      orderId: orderId,
      userId: request.auth ? request.auth.uid : "anonymous",
      customerName: data.customerName,
      phone: data.customerPhone,
      shopName: data.shopName || "Not specified",
      location: data.deliveryAddress || null,
      cart: data.cart,
      orderSummary: data.orderSummary || "",
      productCount: data.productCount || 0,
      totalValue: data.totalValue,
      timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      createdAt: FieldValue.serverTimestamp(),
      status: "Pending",
      source: "Cloud Function",
    };

    await db.collection("orders").doc(orderId).set(orderDoc);

    // Prepare Email Notification HTML
    let itemsHtml = "";
    data.cart.forEach((item) => {
      itemsHtml += `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.qty} ${item.unit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${(item.price * item.qty).toLocaleString("en-IN")}</td>
      </tr>`;
    });

    const emailHtml = `
      <h2>New Wholesale Order: ${orderId}</h2>
      <p><strong>Customer:</strong> ${data.customerName}</p>
      <p><strong>Phone:</strong> ${data.customerPhone}</p>
      <p><strong>Shop/Business:</strong> ${data.shopName || "N/A"}</p>
      <p><strong>Delivery Location:</strong> ${data.deliveryAddress || "N/A"}</p>
      <br>
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px;">Item</th>
            <th style="padding: 8px;">Quantity</th>
            <th style="padding: 8px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <h3 style="margin-top: 20px;">Total Value: ${data.totalValue}</h3>
      <p style="color: #666; font-size: 0.9em;">Log into the KKR Groceries Admin Dashboard to accept or fulfill this order.</p>
    `;

    // Queue Email Notification
    try {
      await db.collection("mail").add({
        to: ["raju2uraju@gmail.com", "kanthati.chakri@gmail.com"],
        message: {
          subject: `New Order: ${orderId} - ₹${data.totalValue}`,
          html: emailHtml,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (emailError) {
      console.error("Email queue failed:", emailError);
      // Don't fail the order if email fails
    }

    return { success: true, orderId: orderId, message: "Order placed successfully!" };
    
  } catch (error) {
    console.error("Error submitting order:", error);
    throw new HttpsError(
      error.code || "internal", 
      error.message || "An error occurred while saving the order."
    );
  }
});
