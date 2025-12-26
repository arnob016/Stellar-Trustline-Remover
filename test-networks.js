const { Networks } = require('stellar-sdk');

console.log('typeof Networks.PUBLIC:', typeof Networks.PUBLIC);
console.log('Networks.PUBLIC:', Networks.PUBLIC);

console.log('\ntypeof Networks.TESTNET:', typeof Networks.TESTNET);
console.log('Networks.TESTNET:', Networks.TESTNET);

// Check the PUBLIC object
console.log('\nNetworks.PUBLIC properties:', Networks.PUBLIC);
console.log('Networks.PUBLIC.networkPassphrase:', Networks.PUBLIC.networkPassphrase);

console.log('\nNetworks.TESTNET properties:', Networks.TESTNET);
console.log('Networks.TESTNET.networkPassphrase:', Networks.TESTNET.networkPassphrase);

