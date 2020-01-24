
describe('Brac login functionality', function () {
    /*  browser.ignoreSynchronization = true; // for non-angular websites
     it('Excel File Operations', function() {
     browser.get("http://demo.automationtesting.in/Frames.html") */

    it('Login with valid data', function () {

        browser.manage().timeouts().implicitlyWait(30000);
        browser.get("http://bracdev.firstaccess.co/#/loan")
        browser.manage().window().maximize();

        //To get current URL
        /*  browser.getCurrentUrl().then(function(url1){
         console.log(url1);
         }) */
        //(or)
        browser.waitForAngular();
        browser.getCurrentUrl().then(function (url) {
            console.log("Application url: " + url);
        });

        //To get application title 
        browser.getTitle().then(function (title) {
            console.log("Application title: " + title);
        })

        //login page
        element(by.xpath("//input[@type='text']")).sendKeys("vinay");
        element(by.xpath("//input[@type='password']")).sendKeys("Brac@123");
        element(by.xpath("//button[text()='Login']")).click();
        browser.sleep(4000);

    });

    it('Dashboard page', function () {
        // To get text for dashboard
        /*  element(by.xpath("//span[text()='Dashboard']")).getText().then(function (dashboardtext) {
             console.log("Text of dashboard: " + dashboardtext);
             browser.sleep(2000);
         }) */

        //or (To avoid morethan one element)

        var dashboardtitle = element.all(by.xpath("//span[text()='Dashboard']"));
        dashboardtitle.get(0).getText().then(function (dashboardtext) {
            console.log("Text of dashboard: " + dashboardtext);
            browser.sleep(3000);
        })

        //menu click
        element(by.xpath("/html/body/app-root/app-page-layout/div[2]/div[1]/a")).click();

        // Survey module
        element(by.xpath("//span[text()='Survey']")).click();
        browser.sleep(3000);

        // Add new survey
        element(by.xpath("//button[text()='Add Survey']")).click();
        browser.sleep(3000);

        // Survey Basic information
        var Basicinfo = element(by.xpath("//div[text()='BASIC INFORMATION']"))
        Basicinfo.getText().then(function (isVisible) {
            if (expect(Basicinfo.isDisplayed()).toBe(true)) {

                console.log('Basic info text displayed:' + isVisible)
            } else {
                console.log('Basic info text is displaying:' + isVisible)
            }
            element(by.id("entrepreneur")).sendKeys("vinay");
            element(by.id("name")).sendKeys("steel");
            browser.sleep(2000);

            //Industry sector dropdown
            element(by.xpath("//*[@id='formly_1_select_industry_sector_3']/div/label")).click();
            browser.sleep(2000);
            element(by.xpath("/html/body/div[3]/div[1]/input")).sendKeys("trade");
            browser.sleep(2000);
            browser.actions().sendKeys(protractor.Key.ARROW_DOWN).perform();
            browser.sleep(2000);
            browser.actions().sendKeys(protractor.Key.ENTER).perform();
            browser.sleep(2000);

            //dropdown
            element(by.xpath("//*[@id='formly_1_select_know_about_brac_4']/div/label")).click();
            browser.sleep(2000);
            element(by.xpath("/html/body/div[4]/div[1]/input")).sendKeys("newspapers");
            browser.sleep(2000);
            browser.actions().sendKeys(protractor.Key.ARROW_DOWN).perform();
            browser.sleep(2000);
            browser.actions().sendKeys(protractor.Key.ENTER).perform();
            browser.sleep(2000);

            //scroll down
            browser.executeScript('window.scrollTo(0,300)');

            //Questions
            element(by.xpath("//span[text()='Less than 2 years ago']")).click();
            browser.sleep(1000);
            element(by.xpath("//span[text()='Rented']")).click();
            browser.sleep(1000);
            element(by.xpath("//form/formly-form/formly-field[11]/zc-wrapper-label/zc-wrapper-fieldset/div/zc-wrapper-validation-messages/zc-field-radio/div/div[1]/label/span[1]")).click();
            browser.sleep(1000);
            element(by.xpath("//span[text()='Married']")).click();
            browser.sleep(1000);
            element(by.xpath("//formly-form/formly-field[16]/zc-wrapper-label/zc-wrapper-fieldset/div/zc-wrapper-validation-messages/zc-field-radio/div/div[1]/label")).click();
            browser.sleep(1000);
            element(by.xpath("//span[text()='< 2m']")).click();
            browser.sleep(1000);
            element(by.xpath("//span[text()='Non-agricultural']")).click();
            browser.sleep(1000);
            element(by.xpath("//formly-form/formly-field[12]/zc-wrapper-label/zc-wrapper-fieldset/div/zc-wrapper-validation-messages/zc-field-radio/div/div[1]/label")).click();
            element(by.id("outstanding_installments_of_loan")).sendKeys("3");
            browser.sleep(1000);
            //scroll down
            browser.executeScript('window.scrollTo(0,100)');
            element(by.xpath("//formly-form/formly-field[15]/zc-wrapper-label/zc-wrapper-fieldset/div/zc-wrapper-validation-messages/zc-field-radio/div/div[1]/label/span[1]")).click();
            browser.sleep(1000);
            element(by.xpath("//formly-field[17]/zc-wrapper-label/zc-wrapper-fieldset/div/zc-wrapper-validation-messages/zc-field-radio/div/div[1]/label/span[1]")).click();
            browser.sleep(3000);
            //Requested amount
            element(by.id("amount")).sendKeys("10000000");
            browser.sleep(3000);

            //Date
             element(by.xpath("//span[@class='ui-button-icon-left ui-clickable icon-calendar']")).click();
             browser.sleep(3000);
             var SelectWrapper = require('./select.ts');
             var mySelect = new SelectWrapper(by.className("ui-datepicker-month ng-tns-c12-3 ng-star-inserted"));
 
                mySelect.selectByPartialText("Sep")
        });

        //Cancel
        element(by.buttonText("Cancel")).click();
        browser.sleep(3000);
        //Alert 


    })

});

