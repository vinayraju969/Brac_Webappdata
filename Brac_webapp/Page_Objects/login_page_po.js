var Applicationdata = function () {

    var expect = require('chai').expect

    //var Url = "http://bracdev.firstaccess.co/#/loan";
    //Forget password id
    var forgetpasswordlink = element(by.xpath("//a[contains(text(),'Forgot Password ?')]"));
    //forget password email text id
    var emailtext = element(by.name("email"));
    //Email reset button id 
    var resetemailbtn = element(by.xpath("//button[text()='Send password reset email']"));
    //email success message id
    var emailmessage = element(by.id("toast-container"));
    var actualmessage = "×\nMail sent successfully";


    //login ID'S
    var username = element(by.xpath("//input[@type='text']"));
    var password = element(by.xpath("//input[@type='password']"));
    //rememberme checkbox id
    var checkbox = element(by.xpath("//label[text()='Remember Me']"));
    // login button id
    var loginbtn = element(by.xpath("//button[text()='Login']"));

    //Dashbaord Text
    var textofdashboard = element.all(by.xpath("//span[text()='Dashboard']"));
    //comaparision of dashboard text
    var Dashboardtextdata = "Dashboard";


    //Application Title
    this.ApplicationTitle = function () {
        browser.getTitle().then(function (titletext) {
            console.log("Application title: " + titletext)
        })
    }

    //Forget password
    this.forgetpassword = function (emailid) {
        browser.sleep(2000)
        forgetpasswordlink.click();
        browser.sleep(2000)
        emailtext.sendKeys(emailid);
        browser.sleep(2000)
        resetemailbtn.click();
        browser.sleep(5000);
        emailmessage.getText().then(function (expectedtext) {
            console.log("Get text for message " + expectedtext)
            if(expect(expectedtext).to.equal(actualmessage)){
                console.log("mail sent")
            }
            else{
                console.log("mail not sent")
            }
        })


    }

    //URL of the application 
    this.getUrl = function (url) {
        browser.get(url);
        //OR using direct url
        /* this.getUrl = function () {
            browser.get(Url); */

    }
    //login details
    this.login = function (uname, upass) {
        username.sendKeys(uname);
        password.sendKeys(upass);
        browser.sleep(3000)
        checkbox.click();
        if (checkbox.isSelected) {
            console.log("checkbox selected")
        }
        else {
            console.log("checkbox Notselected")
        }

        loginbtn.click();
        browser.sleep(4000);
    }

    //Dashbaord Text
    this.dashboardtext = function () {
        textofdashboard.get(1).getText().then(function (gettext) {
            console.log("Text of dashboard: " + gettext)
            if (expect(gettext).to.equal(Dashboardtextdata)) {
                // if(expect(gettext).toEqual(Dashboardtextdata))  { 
                //if (dashboardT == gettext) {
                console.log("Test passed")
            }
            else {
                console.log("Test Fail")
            }
        })

    }

}

module.exports = Applicationdata