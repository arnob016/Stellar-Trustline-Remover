#!/usr/bin/env node
/**
 * Test script to verify trustline removal API works
 */

async function testTrustlineRemoval() {
  console.log('Testing Trustline Removal API...\n');

  // This is a test with a dummy secret key - it will fail auth but shows the endpoint works
  const testPayload = {
    secretKey: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    network: "testnet",
    assetCode: "TEST",
    assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIRUBJX3H7KL25OKBYHXWXCJOU"
  };

  try {
    const response = await fetch("http://localhost:3000/api/trustlines/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload)
    });

    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
    
    if (response.status === 400 && data.error) {
      console.log('\n✓ API is properly handling request');
      console.log('Error message:', data.error);
    } else if (!response.ok) {
      console.log('\n✗ Unexpected error response');
    }
  } catch (err) {
    console.error('Network Error:', err.message);
  }
}

testTrustlineRemoval();
