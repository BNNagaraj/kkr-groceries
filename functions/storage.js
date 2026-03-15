/**
 * Storage Cloud Functions.
 * - uploadProductImage
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getStorage } = require("firebase-admin/storage");
const { db, FieldValue, requireAdmin, isRateLimited } = require("./utils");

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
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "uploadImage", 30, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many uploads. Try again later.");
    }

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
