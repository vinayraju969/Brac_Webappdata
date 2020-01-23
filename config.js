 var HtmlReporter = require('protractor-beautiful-reporter');
 
 exports.config = {
 //framework: 'jasmine',
  seleniumAddress: 'http://localhost:4444/wd/hub',
  specs: [

  './Brac_webapp/Test_cases/login_spec.js'
  ],
  jasmineNodeOpts: {
    showColors: true, // Use colors in the command line report.
    defaultTimeoutInterval: 2500000
    },
  onPrepare: async function()   {
    await browser.waitForAngularEnabled(false);
    browser.manage().window().maximize();
    // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
    jasmine.getEnv().addReporter(new HtmlReporter({
    baseDirectory: 'Reports/screenshots',
     docTitle: 'Brac Reports' // Title of report
    }).getJasmine2Reporter());
    }
  
  };