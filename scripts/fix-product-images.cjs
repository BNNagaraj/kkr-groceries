/**
 * Fix broken product image URLs in Firestore
 * Updates Wikipedia and broken Unsplash URLs with working alternatives
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Firebase config (same as in your app)
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "kkr-groceries-02.firebaseapp.com",
    projectId: "kkr-groceries-02",
    storageBucket: "kkr-groceries-02.firebasestorage.app",
    messagingSenderId: "35899821878",
    appId: "1:35899821878:web:aa5c1eb95e70aa98eb6f04"
};

// Working image URLs for vegetables (using reliable sources)
const imageMapping = {
    // Wikipedia images that work
    'Green Chilli': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Green_Pepper.jpg/640px-Green_Pepper.jpg',
    'Okra': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Okra_%28Abelmoschus_esculentus%29_2.jpg/640px-Okra_%28Abelmoschus_esculentus%29_2.jpg',
    'Carrot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Carrots_in_bunch.jpg/640px-Carrots_in_bunch.jpg',
    'Spinach': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Spinach_leaves_%28Spinacia_oleracea%29.jpg/640px-Spinach_leaves_%28Spinacia_oleracea%29.jpg',
    'Bottle Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Lagenaria_siceraria_-_calabash_-_01.jpg/640px-Lagenaria_siceraria_-_calabash_-_01.jpg',
    'Ridge Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Ridge_gourd_or_ribbed_luffa_Luffa_acutangula.jpg/640px-Ridge_gourd_or_ribbed_luffa_Luffa_acutangula.jpg',
    'Banana': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Bananas.jpg/640px-Bananas.jpg',
    'Tomato': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/640px-Tomato_je.jpg',
    'Onion': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Onions_-_-varieties.jpg/640px-Onions_-_varieties.jpg',
    'Potato': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Potato_basket.jpg/640px-Potato_basket.jpg',
    'Lady\'s Finger': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Okra_%28Abelmoschus_esculentus%29_2.jpg/640px-Okra_%28Abelmoschus_esculentus%29_2.jpg',
    'Brinjal': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%28%C3%81%E2%80%99%29.jpg/640px-Solanum_melongena_24_08_2012_%28%C3%81%E2%80%99%29.jpg',
    'Cauliflower': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Cauliflower_heart.jpg/640px-Cauliflower_heart.jpg',
    'Cabbage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Cabbage_in_the_market.jpg/640px-Cabbage_in_the_market.jpg',
    'Capsicum': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Bell_Pepper_Images.jpg/640px-Bell_Pepper_Images.jpg',
    'Beetroot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Beetroot_%28Beta_vulgaris%29.jpg/640px-Beetroot_%28Beta_vulgaris%29.jpg',
    'Radish': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Daikon_Radish.jpg/640px-Daikon_Radish.jpg',
    'Cucumber': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Cucumbers.jpg/640px-Cucumbers.jpg',
    'Garlic': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Garlic_bulbs_and_cloves.jpg/640px-Garlic_bulbs_and_cloves.jpg',
    'Ginger': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Ginger_root.jpg/640px-Ginger_root.jpg',
    'Coriander': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Coriander_fresh.jpg/640px-Coriander_fresh.jpg',
    'Curry Leaves': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Curry_leaves.jpg/640px-Curry_leaves.jpg',
    'Mint': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Mint_leaves.jpg/640px-Mint_leaves.jpg',
    'Fenugreek': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Fenugreek_leaves.jpg/640px-Fenugreek_leaves.jpg',
    'Drumstick': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Moringa_oleifera_pods.jpg/640px-Moringa_oleifera_pods.jpg',
    'Tinda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Praecitrullus_fistulosus.jpg/640px-Praecitrullus_fistulosus.jpg',
    'Kohlrabi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Kohlrabi_plant.jpg/640px-Kohlrabi_plant.jpg',
    'Lettuce': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Iceberg_lettuce_in_BS_supermarket.jpg/640px-Iceberg_lettuce_in_BS_supermarket.jpg',
    'Broccoli': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Broccoli_and_cross_section_edit.jpg/640px-Broccoli_and_cross_section_edit.jpg',
    'Mushroom': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Button_mushrooms.jpg/640px-Button_mushrooms.jpg',
    'Sweet Potato': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/640px-Ipomoea_batatas_006.JPG',
    'Tapioca': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Manihot_esculenta_001.JPG/640px-Manihot_esculenta_001.JPG',
    'Yam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Dioscorea_alata.jpg/640px-Dioscorea_alata.jpg',
    'Pumpkin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Pumpkins.jpg/640px-Pumpkins.jpg',
    'Ash Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Winter_melon_1.jpg/640px-Winter_melon_1.jpg',
    'Ivy Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Coccinia_grandis.jpg/640px-Coccinia_grandis.jpg',
    'Snake Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Trichosanthes_cucumerina.jpg/640px-Trichosanthes_cucumerina.jpg',
    'Pointed Gourd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Trichosanthes_dioica.jpg/640px-Trichosanthes_dioica.jpg',
    'Elephant Foot Yam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Elephant_foot_yam.jpg/640px-Elephant_foot_yam.jpg',
    'Colocasia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Colocasia_esculenta_003.JPG/640px-Colocasia_esculenta_003.JPG',
    'Raw Mango': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mangoes.jpg/640px-Mangoes.jpg',
    'Lemon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Lemon.jpg/640px-Lemon.jpg',
    'Green Peas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Peas_in_pods.jpg/640px-Peas_in_pods.jpg',
    'Beans': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/French_beans.jpg/640px-French_beans.jpg',
    'Cluster Beans': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Cluster_beans.jpg/640px-Cluster_beans.jpg',
    'Broad Beans': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Fava_beans.jpg/640px-Fava_beans.jpg',
    'Sprouts': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Mung_bean_sprouts.jpg/640px-Mung_bean_sprouts.jpg',
    'Corn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Corn_cobs.jpg/640px-Corn_cobs.jpg',
    'Baby Corn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Baby_corn.jpg/640px-Baby_corn.jpg',
    'Green Gram': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Mung_beans.jpg/640px-Mung_beans.jpg',
    'Bengal Gram': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Chickpeas.jpg/640px-Chickpeas.jpg',
    'Red Gram': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Pigeon_peas.jpg/640px-Pigeon_peas.jpg',
    'Black Gram': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Black_gram.jpg/640px-Black_gram.jpg',
    'Horse Gram': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Macrotyloma_uniflorum.jpg/640px-Macrotyloma_uniflorum.jpg',
    'Double Beans': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lima_beans.jpg/640px-Lima_beans.jpg'
};

// Default placeholder for unknown products
const DEFAULT_PLACEHOLDER = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Vegetable_icon.svg/640px-Vegetable_icon.svg.png';

async function fixProductImages() {
    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        
        console.log('Fetching products from Firestore...');
        const productsSnapshot = await getDocs(collection(db, 'products'));
        
        let updatedCount = 0;
        let errorCount = 0;
        
        console.log(`Found ${productsSnapshot.docs.length} products`);
        
        for (const productDoc of productsSnapshot.docs) {
            const product = productDoc.data();
            const productName = product.name;
            const currentImage = product.image || '';
            
            // Check if image needs fixing
            const needsFix = !currentImage || 
                           currentImage.includes('photo-1604568102377') || 
                           currentImage.includes('photo-1596639556108') ||
                           (currentImage.includes('wikipedia.org') && 
                            (currentImage.includes('220px') || 
                             currentImage.includes('Green_chilli_closeup') ||
                             currentImage.includes('Okra_%28Abelmoschus_esculentus%29_%283%29') ||
                             currentImage.includes('Vegetable-Ede-carrot') ||
                             currentImage.includes('Spinach_leaves.jpg') ||
                             currentImage.includes('Bottle_gourd.jpg')));
            
            if (needsFix) {
                const newImage = imageMapping[productName] || DEFAULT_PLACEHOLDER;
                
                try {
                    await updateDoc(doc(db, 'products', productDoc.id), {
                        image: newImage
                    });
                    console.log(`✅ Updated "${productName}" with new image`);
                    updatedCount++;
                } catch (err) {
                    console.error(`❌ Failed to update "${productName}":`, err.message);
                    errorCount++;
                }
            } else {
                console.log(`⏭️ Skipped "${productName}" - image OK`);
            }
        }
        
        console.log('\n========================================');
        console.log('Fix Complete!');
        console.log(`Updated: ${updatedCount} products`);
        console.log(`Errors: ${errorCount} products`);
        console.log('========================================');
        
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

fixProductImages();
