// Google Apps Script for KKR Groceries Enquiry Backend
// Deploy this as a Web App in Google Apps Script (https://script.google.com)

const SHEET_NAME = 'KKR-Orders';
const ADMIN_EMAIL = 'raju2uraju@gmail.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();
    
    // Append row
    sheet.appendRow([
      new Date(),
      data.customerName || '',
      data.phone || '',
      data.location || '',
      data.pincode || '',
      data.businessType || '',
      data.orderSummary || '',
      data.itemDetails || '',
      data.totalValue || '',
      data.productCount || 0,
      data.moqCompliant || '',
      data.source || 'Web'
    ]);

    // Send email notification
    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: `New KKR Order from ${data.customerName} - ${data.totalValue}`,
        htmlBody: `
          <h2>New Wholesale Enquiry</h2>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          <p><strong>Location:</strong> ${data.location}, ${data.pincode}</p>
          <p><strong>Business:</strong> ${data.businessType}</p>
          <hr>
          <p><strong>Order:</strong> ${data.orderSummary}</p>
          <p><strong>Total:</strong> ${data.totalValue} (${data.productCount} items)</p>
          <hr>
          <p><strong>Details:</strong><br>${(data.itemDetails || '').replace(/\|/g, '<br>')}</p>
          <br>
          <p style="color:gray;font-size:12px">Sent from KKR Groceries B2B Platform</p>
        `
      });
    } catch (emailErr) {
      console.log('Email send failed: ' + emailErr);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: 'Order received successfully' 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'ok', 
    service: 'KKR Groceries API' 
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('KKR Groceries Orders');
  }
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp', 'Customer Name', 'Phone', 'Location', 'Pincode',
      'Business Type', 'Order Summary', 'Item Details', 'Total Value',
      'Product Count', 'MOQ Compliant', 'Source'
    ]);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#064e3b').setFontColor('white');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ========== APMC PRICE PROXY ==========
// This function can be called via a doGet with ?action=apmc
// Or deployed separately as a price feed endpoint

function getAPMCPrices() {
  // Simulated Hyderabad APMC prices with realistic daily variations
  const baseDate = new Date();
  const seed = baseDate.getFullYear() * 10000 + (baseDate.getMonth() + 1) * 100 + baseDate.getDate();
  
  const commodities = [
    { name: 'Tomato', baseMin: 18, baseMax: 35 },
    { name: 'Onion', baseMin: 22, baseMax: 45 },
    { name: 'Potato', baseMin: 20, baseMax: 38 },
    { name: 'Green Chilli', baseMin: 30, baseMax: 65 },
    { name: "Lady's Finger", baseMin: 28, baseMax: 50 },
    { name: 'Brinjal', baseMin: 22, baseMax: 42 },
    { name: 'Cauliflower', baseMin: 20, baseMax: 40 },
    { name: 'Cabbage', baseMin: 15, baseMax: 30 },
    { name: 'Carrot', baseMin: 30, baseMax: 55 },
    { name: 'Spinach', baseMin: 10, baseMax: 25 },
    { name: 'Bottle Gourd', baseMin: 25, baseMax: 45 },
    { name: 'Ridge Gourd', baseMin: 28, baseMax: 50 }
  ];

  const prices = commodities.map((c, i) => {
    const hash = ((seed * (i + 7)) % 1000) / 1000;
    const min = c.baseMin + Math.floor(hash * (c.baseMax - c.baseMin) * 0.4);
    const max = c.baseMin + Math.floor(hash * (c.baseMax - c.baseMin) * 0.8) + Math.floor((c.baseMax - c.baseMin) * 0.3);
    const modal = Math.floor((min + max) / 2);
    return {
      commodity: c.name,
      market: 'Hyderabad (Bowenpally)',
      state: 'Telangana',
      minPrice: min,
      maxPrice: Math.min(max, c.baseMax),
      modalPrice: modal,
      date: baseDate.toISOString().split('T')[0],
      unit: 'Quintal'
    };
  });

  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'success',
    market: 'Hyderabad APMC (Bowenpally)',
    date: baseDate.toISOString().split('T')[0],
    prices: prices 
  })).setMimeType(ContentService.MimeType.JSON);
}
