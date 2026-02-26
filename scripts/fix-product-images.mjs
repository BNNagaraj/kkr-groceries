/**
 * Fix broken product image URLs in Firestore
 * Updates Wikipedia and broken Unsplash URLs with working alternatives
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Working image URLs for vegetables (using reliable Wikipedia sources)
const imageMapping = {
    'Green Chilli': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Green_Pepper.jpg/640px-Green_Pepper.jpg',
    'Okra': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Okra_%28Abelmoschus_esculentus%29_2.jpg/640px-Okra_%28Abelmoschus_esculentus%29_2.jpg',
    'Lady\'s Finger': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Okra_%28Abelmoschus_esculentus%29_2.jpg/640px-Okra_%28Abelmoschus_esculentus%29_2.jpg',
    'Carrot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Carrots_in_bunch.jpg/640px-Carrots_in_bunch.jpg',
    'Spinach': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Spinach_leaves_%28Spinacia_oleracea%29.jpg/640px-Spinach_leaves_%28Spinacia_oleracea%29.jpg',
    'Bottle Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Lagenaria_siceraria_-_calabash_-_01.jpg/640px-Lagenaria_siceraria_-_calabash_-_01.jpg',
    'Ridge Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Ridge_gourd_or_ribbed_luffa_Luffa_acutangula.jpg/640px-Ridge_gourd_or_ribbed_luffa_Luffa_acutangula.jpg',
    'Banana': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Bananas.jpg/640px-Bananas.jpg',
    'Tomato': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/640px-Tomato_je.jpg',
    'Onion': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Onions_-_-varieties.jpg/640px-Onions_-_varieties.jpg',
    'Potato': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Potato_basket.jpg/640px-Potato_basket.jpg',
    'Brinjal': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%28%C3%81%E2%80%99%29.jpg/640px-Solanum_melongena_24_08_2012_%28%C3%81%E2%80%99%29.jpg',
    'Cauliflower': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Cauliflower_heart.jpg/640px-Cauliflower_heart.jpg',
    'Cabbage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Cabbage_in_the_market.jpg/640px-Cabbage_in_the_market.jpg'
};

// Default placeholder for unknown products
const DEFAULT_PLACEHOLDER = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Vegetable_icon.svg/640px-Vegetable_icon.svg.png';

// Initialize Firebase Admin
function initFirebase() {
    // Try to get service account from environment or file
    let serviceAccount;
    
    // Check for service account file
    try {
        const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    } catch (e) {
        // Try environment variable
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else {
            // Use application default credentials
            initializeApp({
                projectId: 'kkr-groceries-02'
            });
            return getFirestore();
        }
    }
    
    initializeApp({
        credential: cert(serviceAccount),
        projectId: 'kkr-groceries-02'
    });
    
    return getFirestore();
}

async function fixProductImages() {
    try {
        const db = initFirebase();
        
        console.log('Fetching products from Firestore...');
        const productsSnapshot = await db.collection('products').get();
        
        let updatedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        console.log(`Found ${productsSnapshot.docs.length} products\n`);
        
        for (const productDoc of productsSnapshot.docs) {
            const product = productDoc.data();
            const productName = product.name;
            const currentImage = product.image || '';
            
            // Check if image needs fixing
            const isBroken = !currentImage || 
                           currentImage.includes('photo-1604568102377') || 
                           currentImage.includes('photo-1596639556108') ||
                           (currentImage.includes('wikipedia.org') && 
                            (currentImage.includes('220px') || 
                             currentImage.includes('Green_chilli_closeup') ||
                             currentImage.includes('Okra_%28Abelmoschus_esculentus%29_%283%29') ||
                             currentImage.includes('Vegetable-Ede-carrot') ||
                             currentImage.includes('Spinach_leaves.jpg') ||
                             currentImage.includes('Bottle_gourd.jpg')));
            
            if (isBroken) {
                const newImage = imageMapping[productName] || DEFAULT_PLACEHOLDER;
                
                try {
                    await productDoc.ref.update({
                        image: newImage
                    });
                    console.log(`✅ Updated "${productName}"`);
                    updatedCount++;
                } catch (err) {
                    console.error(`❌ Failed to update "${productName}": ${err.message}`);
                    errorCount++;
                }
            } else {
                skippedCount++;
            }
        }
        
        console.log('\n========================================');
        console.log('Fix Complete!');
        console.log(`Updated: ${updatedCount} products`);
        console.log(`Skipped: ${skippedCount} products`);
        console.log(`Errors: ${errorCount} products`);
        console.log('========================================');
        
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err.message);
        process.exit(1);
    }
}

fixProductImages();
