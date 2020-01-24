var jsondata = require('../Constant_data/data.json')
var Bracmethods = require('../Page_Objects/login_page_po.js')
var Bracmethodsdata = new Bracmethods();
var actualurl = "http://bracdev.firstaccess.co/#/loan"
//menubar id
var menubar = element(by.xpath("/html/body/app-root/app-page-layout/div[2]/div[1]/a"));


describe('Brac Application Test Cases ', function () {
    browser.sleep(5000);
    //To get the title of the application 
    it('Test case for application title ', function () {
        Bracmethodsdata.ApplicationTitle();
        browser.sleep(2000);
    })

    //Test case for url comparision
    it('Test case for url launch ', async function () {
        //url from json data
        Bracmethodsdata.getUrl(jsondata.url);
        await browser.sleep(7000);
        //To get the current url
        browser.waitForAngular();
        var loginbtn = element(by.buttonText('Login'))
        await browser.getCurrentUrl().then(function (url) {
            console.log("Application url: " + url);

            //expect(url).toEqual(actualurl)
            if (expect(loginbtn.isDisplayed()).toBe(true)) {
                console.log("Test passed")
            }
            else {
                console.log("Test failed")
            }
        })
    })

    it('Test case for forget password', async function () {
        await browser.sleep(3000);
        Bracmethodsdata.forgetpassword("vinay.v@thresholdsoft.com");
        await browser.sleep(3000);
    })


    //login data
    it('Test case for Login page', async function () {
        //  Bracmethodsdata.login("vinay","Brac@123");
        Bracmethodsdata.login(jsondata.username, jsondata.password);
        await browser.sleep(5000);
        Bracmethodsdata.dashboardtext();
        await browser.sleep(7000);
        //menu click
        await menubar.click();
        await browser.sleep(7000);

    })


})





