import { parseOrderDetailsResponse } from './lib/agent';

async function testArabicDecoding() {
    console.log('--- Testing Arabic Decoding ---');
    const rawResponse = `{
    "isOrderIntent": true,
    "items": [
      { 
        "product_title": "\\u062a\\u064a\\u0634\\u064a\\u0631\\u062a \\u0623\\u0633\\u0648\\u062f", 
        "quantity": 2,
        "unit_price": 250
      }
    ]
  }`;

    const result = parseOrderDetailsResponse(rawResponse);
    console.log('Raw:', rawResponse);
    console.log('Parsed:', JSON.stringify(result, null, 2));

    if (result.items[0]?.product_title === 'تيشيرت أسود') {
        console.log('✅ Arabic decoding successful');
    } else {
        console.log('❌ Arabic decoding failed');
    }
}

testArabicDecoding();
