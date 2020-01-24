
exports.config = {
    specs:['brac_spec.js'],
    jasmineNodeOpts: {
        defaultTimeoutInterval: 25000000
        },
        capabilities: {
            'browserName': 'chrome',
            'goog:chromeOptions': {
               w3c: false
            }
 }
}