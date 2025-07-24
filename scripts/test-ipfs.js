#!/usr/bin/env node

/**
 * Test script for IPFS upload and retrieval functionality
 * Usage: node scripts/test-ipfs.js
 */

const axios = require('axios');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const API_BASE = `${SERVER_URL}/api/ipfs`;

// Sample Verifiable Credential for testing
const sampleVC = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.org"
  ],
  "id": "urn:uuid:test-credential-12345",
  "type": ["VerifiableCredential", "BachelorDegree"],
  "issuer": "did:ethr:0x123456789abcdef",
  "issuanceDate": "2025-01-20T10:00:00Z",
  "expirationDate": "2029-01-20T10:00:00Z",
  "credentialSubject": {
    "id": "did:ethr:0xstudent123456",
    "name": "Test Student",
    "degree": {
      "type": "BachelorDegree",
      "name": "B.Sc Computer Science",
      "university": "Test University"
    }
  },
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2025-01-20T10:00:00Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:ethr:0x123456789abcdef#controller",
    "jws": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
};

async function testUploadJSON() {
  console.log('\n🧪 Testing JSON payload upload...');
  
  try {
    const response = await axios.post(`${API_BASE}/upload`, sampleVC, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ JSON upload successful!');
      console.log(`📄 CID: ${response.data.data.cid}`);
      console.log(`🔗 URL: ${response.data.data.url}`);
      console.log(`📏 Size: ${response.data.data.size} bytes`);
      return response.data.data.cid;
    } else {
      console.log('❌ JSON upload failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ JSON upload error:', error.response?.data || error.message);
    return null;
  }
}

async function testRetrieveJSON(cid) {
  console.log(`\n🧪 Testing JSON retrieval for CID: ${cid}...`);
  
  try {
    const response = await axios.get(`${API_BASE}/${cid}`);

    if (response.data.success) {
      console.log('✅ JSON retrieval successful!');
      console.log(`📄 Type: ${response.data.data.type}`);
      console.log(`📏 Size: ${response.data.data.size} bytes`);
      console.log('📄 Content preview:', JSON.stringify(response.data.data.content, null, 2).substring(0, 200) + '...');
      
      // Verify the content matches what we uploaded
      if (response.data.data.content.id === sampleVC.id) {
        console.log('✅ Content verification successful - uploaded and retrieved data match!');
      } else {
        console.log('❌ Content verification failed - data mismatch');
      }
      
      return true;
    } else {
      console.log('❌ JSON retrieval failed:', response.data.error);
      return false;
    }
  } catch (error) {
    console.log('❌ JSON retrieval error:', error.response?.data || error.message);
    return false;
  }
}

async function testRetrieveRaw(cid) {
  console.log(`\n🧪 Testing raw retrieval for CID: ${cid}...`);
  
  try {
    const response = await axios.get(`${API_BASE}/${cid}?format=raw`);
    
    console.log('✅ Raw retrieval successful!');
    console.log(`📄 Content-Type: ${response.headers['content-type']}`);
    console.log(`📏 Size: ${response.data.length} characters`);
    console.log('📄 Raw content preview:', response.data.substring(0, 200) + '...');
    
    // Try to parse the raw content
    try {
      const parsed = JSON.parse(response.data);
      if (parsed.id === sampleVC.id) {
        console.log('✅ Raw content verification successful!');
      }
    } catch (parseError) {
      console.log('❌ Raw content is not valid JSON');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Raw retrieval error:', error.response?.data || error.message);
    return false;
  }
}

async function testUploadTextFile() {
  console.log('\n🧪 Testing text file upload...');
  
  const textContent = "Hello, IPFS! This is a test text file.\nIt contains multiple lines.\nAnd some special characters: 🚀✨";
  
  try {
    const response = await axios.post(`${API_BASE}/upload`, textContent, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    if (response.data.success) {
      console.log('✅ Text upload successful!');
      console.log(`📄 CID: ${response.data.data.cid}`);
      console.log(`🔗 URL: ${response.data.data.url}`);
      return response.data.data.cid;
    }
  } catch (error) {
    console.log('❌ Text upload error:', error.response?.data || error.message);
    return null;
  }
}

async function testRetrieveText(cid) {
  console.log(`\n🧪 Testing text retrieval for CID: ${cid}...`);
  
  try {
    const response = await axios.get(`${API_BASE}/${cid}`);

    if (response.data.success && response.data.data.type === 'text') {
      console.log('✅ Text retrieval successful!');
      console.log(`📄 Content: ${response.data.data.content}`);
      return true;
    }
  } catch (error) {
    console.log('❌ Text retrieval error:', error.response?.data || error.message);
    return false;
  }
}

async function testNonExistentFile() {
  console.log('\n🧪 Testing non-existent file retrieval...');
  
  const fakeCid = 'QmNonExistentFile123456789';
  
  try {
    const response = await axios.get(`${API_BASE}/${fakeCid}`);
    console.log('❌ Expected error but got success:', response.data);
    return false;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ Correctly returned 404 for non-existent file');
      console.log(`📄 Error: ${error.response.data.error}`);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
      return false;
    }
  }
}

async function main() {
  console.log('🚀 Starting IPFS functionality tests...');
  console.log(`🔗 Testing against: ${API_BASE}`);
  
  let passed = 0;
  let total = 0;

  // Test 1: Upload JSON payload
  total++;
  const jsonCid = await testUploadJSON();
  if (jsonCid) passed++;

  if (jsonCid) {
    // Test 2: Retrieve JSON
    total++;
    if (await testRetrieveJSON(jsonCid)) passed++;

    // Test 3: Retrieve as raw
    total++;
    if (await testRetrieveRaw(jsonCid)) passed++;
  }

  // Test 4: Upload text file
  total++;
  const textCid = await testUploadTextFile();
  if (textCid) passed++;

  if (textCid) {
    // Test 5: Retrieve text
    total++;
    if (await testRetrieveText(textCid)) passed++;
  }

  // Test 6: Non-existent file
  total++;
  if (await testNonExistentFile()) passed++;

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! IPFS functionality is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the server logs and IPFS configuration.');
    process.exit(1);
  }
}

// Handle errors
main().catch(error => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
});