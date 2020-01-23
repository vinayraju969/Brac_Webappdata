var Applicationdata = function () {
    //var Url = "http://bracdev.firstaccess.co/#/loan";
    //login ID'S
    var username = element(by.xpath("//input[@type='text']"));
    var password = element(by.xpath("//input[@type='password']"));
    var loginbtn = element(by.xpath("//button[text()='Login']"));
    //Dashbaord Text
    var textofdashboard = element.all(by.xpath("//span[text()='Dashboard']"));

    //Application Title
    this.ApplicationTitle = function () {
        browser.getTitle().then(function (titletext) {
            console.log("Application title: " + titletext)
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
        loginbtn.click();
        browser.sleep(4000);
    }

    //Dashbaord Text
    this.dashboardtext = function () {
        textofdashboard.get(1).getText().then(function (gettext) {
            console.log("Text of dashboard: " + gettext)
        })

    }

}

module.exports = Applicationdata