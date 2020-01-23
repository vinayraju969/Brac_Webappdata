var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ea62449310f56f10ed9f0053a7082843",
        "instanceId": 11740,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00690053-00ad-006f-000f-004d0053001e.png",
        "timestamp": 1579762314021,
        "duration": 21473
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ea62449310f56f10ed9f0053a7082843",
        "instanceId": 11740,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009f0052-00b1-0050-00ed-005400460002.png",
        "timestamp": 1579762336010,
        "duration": 9400
    },
    {
        "description": "To get applliction title |Brac Application Test Cases",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "81c5f060e87f81fdc41d3e6e9dcfeb95",
        "instanceId": 15804,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"To get applliction title \") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:10:2)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e40011-007c-0049-0083-00d8006700b7.png",
        "timestamp": 1579764841077,
        "duration": 4471
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "81c5f060e87f81fdc41d3e6e9dcfeb95",
        "instanceId": 15804,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e00b1-00b9-009f-0031-0035000b00d0.png",
        "timestamp": 1579764845916,
        "duration": 20354
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "81c5f060e87f81fdc41d3e6e9dcfeb95",
        "instanceId": 15804,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007d003d-0071-00b9-0090-0063002f00e2.png",
        "timestamp": 1579764867167,
        "duration": 9367
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "44f8cffac42b1168d4bf63b2147ddae3",
        "instanceId": 15028,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"To get appliction title \") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:10:2)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00000096-00fd-001d-002f-00fe005f0054.png",
        "timestamp": 1579765116209,
        "duration": 4167
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "44f8cffac42b1168d4bf63b2147ddae3",
        "instanceId": 15028,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0035001b-00cb-00fb-0092-0003006f009e.png",
        "timestamp": 1579765120702,
        "duration": 21120
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "44f8cffac42b1168d4bf63b2147ddae3",
        "instanceId": 15028,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d40078-008b-0058-00fb-00ec00a4008f.png",
        "timestamp": 1579765142293,
        "duration": 9315
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fb5ff3a1c64e04a1b5b894321b6f452e",
        "instanceId": 1084,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"To get appliction title \") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:10:2)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0083000f-00e3-007f-00ee-002e00500050.png",
        "timestamp": 1579770849787,
        "duration": 9285
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fb5ff3a1c64e04a1b5b894321b6f452e",
        "instanceId": 1084,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c40083-0058-00d3-0065-00e900fc005d.png",
        "timestamp": 1579770859427,
        "duration": 11776
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fb5ff3a1c64e04a1b5b894321b6f452e",
        "instanceId": 1084,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002a00f4-0082-0075-0043-00e800330066.png",
        "timestamp": 1579770871746,
        "duration": 9323
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a8ab68676e721a32b297ba9c32cc30d",
        "instanceId": 13480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0069001a-005f-005d-00dc-0056009a009b.png",
        "timestamp": 1579771144737,
        "duration": 5014
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a8ab68676e721a32b297ba9c32cc30d",
        "instanceId": 13480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00c9-0039-0007-00f1-00ee009e00e6.png",
        "timestamp": 1579771150104,
        "duration": 8793
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a8ab68676e721a32b297ba9c32cc30d",
        "instanceId": 13480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00240016-00f9-002e-000f-009500b70035.png",
        "timestamp": 1579771159541,
        "duration": 9234
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ca94e6be932bb339a0b2147c072448c0",
        "instanceId": 13976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008d00d4-0081-00b1-0044-0066005b00bb.png",
        "timestamp": 1579771440125,
        "duration": 7030
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ca94e6be932bb339a0b2147c072448c0",
        "instanceId": 13976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003100a3-0020-00fd-004e-0010008100d7.png",
        "timestamp": 1579771447502,
        "duration": 8738
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ca94e6be932bb339a0b2147c072448c0",
        "instanceId": 13976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a000ed-009e-0053-0085-0060003500c8.png",
        "timestamp": 1579771456681,
        "duration": 9387
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "53282044d83700bfc136bdb4a13222dc",
        "instanceId": 12564,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e600fb-002f-0088-0057-00a4003f00a8.png",
        "timestamp": 1579771891628,
        "duration": 7014
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "53282044d83700bfc136bdb4a13222dc",
        "instanceId": 12564,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00060017-0029-0054-00fa-008500c200dc.png",
        "timestamp": 1579771899006,
        "duration": 8532
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "53282044d83700bfc136bdb4a13222dc",
        "instanceId": 12564,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0005001e-0008-00ce-0019-00cc00a60051.png",
        "timestamp": 1579771908084,
        "duration": 9465
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "6df004ebacb2dd351eae4629379ee52a",
        "instanceId": 17028,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00590042-001d-005c-0043-00a200170021.png",
        "timestamp": 1579772019508,
        "duration": 7015
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "6df004ebacb2dd351eae4629379ee52a",
        "instanceId": 17028,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb000d-0058-0015-0017-00c800400086.png",
        "timestamp": 1579772026834,
        "duration": 8735
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "6df004ebacb2dd351eae4629379ee52a",
        "instanceId": 17028,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001000c5-004e-0014-0062-006a00570054.png",
        "timestamp": 1579772036099,
        "duration": 9248
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4aff8ba41cec003f89815e3edf78b5ee",
        "instanceId": 18488,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003500b1-0039-0068-00f1-00cb008f0066.png",
        "timestamp": 1579772132809,
        "duration": 7032
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4aff8ba41cec003f89815e3edf78b5ee",
        "instanceId": 18488,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0083008d-0047-009c-000a-0083009400f8.png",
        "timestamp": 1579772140219,
        "duration": 9168
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4aff8ba41cec003f89815e3edf78b5ee",
        "instanceId": 18488,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bb008e-00d4-00ec-005c-008700c400c4.png",
        "timestamp": 1579772150021,
        "duration": 9281
    },
    {
        "description": "To get appliction title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0e90e5949dbfb69e9aa99e3a5ad0b149",
        "instanceId": 15388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e60081-00e2-0046-0045-00e2000b0022.png",
        "timestamp": 1579772242538,
        "duration": 5014
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0e90e5949dbfb69e9aa99e3a5ad0b149",
        "instanceId": 15388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006700f9-0015-0004-0008-00f7002700c5.png",
        "timestamp": 1579772247913,
        "duration": 8741
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0e90e5949dbfb69e9aa99e3a5ad0b149",
        "instanceId": 15388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00aa00a7-00dc-0007-00af-008a00fd00d7.png",
        "timestamp": 1579772257339,
        "duration": 9272
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f5f13797d0887a02fbf869dfd20cae78",
        "instanceId": 16724,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d300ef-0042-009d-0023-002f00190002.png",
        "timestamp": 1579773090542,
        "duration": 7020
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "f5f13797d0887a02fbf869dfd20cae78",
        "instanceId": 16724,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: No element found using locator: by.buttonText(\"Login\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.buttonText(\"Login\")\n    at elementArrayFinder.getWebElements.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as isDisplayed] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as isDisplayed] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:29:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"First test case for url launch \") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:18:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "002400b5-000d-0096-00e7-008300ca00b6.png",
        "timestamp": 1579773097924,
        "duration": 9184
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f5f13797d0887a02fbf869dfd20cae78",
        "instanceId": 16724,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd00f3-004a-00be-0022-00da006a0071.png",
        "timestamp": 1579773107605,
        "duration": 9286
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fd0ca18baedefbe90daa28f58e3e1d7f",
        "instanceId": 7544,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fb003f-00d5-0067-0043-0062009200c8.png",
        "timestamp": 1579773481600,
        "duration": 7047
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fd0ca18baedefbe90daa28f58e3e1d7f",
        "instanceId": 7544,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bf0003-00ec-008b-003c-00a800020015.png",
        "timestamp": 1579773489051,
        "duration": 11563
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fd0ca18baedefbe90daa28f58e3e1d7f",
        "instanceId": 7544,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00340059-00cd-007a-0054-006800ad00be.png",
        "timestamp": 1579773501424,
        "duration": 9281
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b07a6ad996da026ccdeebccd55a4aaf5",
        "instanceId": 11584,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009000a0-00a5-00ab-0097-006a00c30078.png",
        "timestamp": 1579773561854,
        "duration": 7013
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b07a6ad996da026ccdeebccd55a4aaf5",
        "instanceId": 11584,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0065003a-00f8-00e5-0013-00db008c0022.png",
        "timestamp": 1579773569283,
        "duration": 11725
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b07a6ad996da026ccdeebccd55a4aaf5",
        "instanceId": 11584,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0038004b-00b8-00f2-00ef-00030081002a.png",
        "timestamp": 1579773581804,
        "duration": 9322
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0ed3164e5943b5d9ed9295ce2b4d2e2a",
        "instanceId": 5020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009b0036-0004-008b-00e5-002200350050.png",
        "timestamp": 1579773614440,
        "duration": 7015
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0ed3164e5943b5d9ed9295ce2b4d2e2a",
        "instanceId": 5020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c300ba-0079-00ed-0045-007500b9004b.png",
        "timestamp": 1579773621795,
        "duration": 9819
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0ed3164e5943b5d9ed9295ce2b4d2e2a",
        "instanceId": 5020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f80089-002c-002a-0080-0012007e0076.png",
        "timestamp": 1579773632177,
        "duration": 9361
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5c0a8ac8aee1f6dd0ee88d54dc71b416",
        "instanceId": 13156,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00300080-0070-00f4-00f5-002b003e00dc.png",
        "timestamp": 1579774861425,
        "duration": 7030
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5c0a8ac8aee1f6dd0ee88d54dc71b416",
        "instanceId": 13156,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e900ef-0074-008a-00f5-004300ce0053.png",
        "timestamp": 1579774868832,
        "duration": 10184
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5c0a8ac8aee1f6dd0ee88d54dc71b416",
        "instanceId": 13156,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f3001a-008e-00d5-0028-00fb00d500a6.png",
        "timestamp": 1579774879526,
        "duration": 12321
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3bc9b19167627c175eb32f6f4b621e7c",
        "instanceId": 9156,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b0077-00d3-00b9-00cb-00a100560043.png",
        "timestamp": 1579774953289,
        "duration": 7020
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3bc9b19167627c175eb32f6f4b621e7c",
        "instanceId": 9156,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00aa0034-008f-001b-004b-0019007d00e4.png",
        "timestamp": 1579774960669,
        "duration": 9446
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3bc9b19167627c175eb32f6f4b621e7c",
        "instanceId": 9156,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005500a2-00c3-000f-007b-00cc00790024.png",
        "timestamp": 1579774970662,
        "duration": 11402
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "75900fbd87e0381cc34417086fffd52e",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f2006a-00f7-0068-00fd-00a900b0008d.png",
        "timestamp": 1579775274447,
        "duration": 7053
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "75900fbd87e0381cc34417086fffd52e",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002000d0-00a6-0041-0061-00aa00980080.png",
        "timestamp": 1579775281877,
        "duration": 9664
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "75900fbd87e0381cc34417086fffd52e",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c90071-0029-00db-00b9-0050007f001a.png",
        "timestamp": 1579775292044,
        "duration": 11330
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ecb9e23dd789a5394c31ad698b02c033",
        "instanceId": 9540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00310037-0099-003a-0071-001100280090.png",
        "timestamp": 1579775364933,
        "duration": 7018
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ecb9e23dd789a5394c31ad698b02c033",
        "instanceId": 9540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cb007e-00e9-0005-0011-004600e20061.png",
        "timestamp": 1579775372302,
        "duration": 9282
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "ecb9e23dd789a5394c31ad698b02c033",
        "instanceId": 9540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(xpath, //span[text()='Dashoard'])"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(xpath, //span[text()='Dashoard'])\n    at selenium_webdriver_1.promise.all.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Applicationdata.dashboardtext (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:35:28)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:43:25)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fd0050-0047-00c2-00ef-00e900bb0044.png",
        "timestamp": 1579775382101,
        "duration": 9398
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3e0af9704855bdac01df833a556ded55",
        "instanceId": 18292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007900b6-002c-0043-0056-0066007f00b9.png",
        "timestamp": 1579775524533,
        "duration": 7020
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3e0af9704855bdac01df833a556ded55",
        "instanceId": 18292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00af000d-000c-00d0-00f6-001c00ee00b2.png",
        "timestamp": 1579775531919,
        "duration": 9319
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3e0af9704855bdac01df833a556ded55",
        "instanceId": 18292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fb0017-00d6-004a-007c-0078000400d9.png",
        "timestamp": 1579775541785,
        "duration": 11355
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2ea83bc4124ea644831e0fd522147ee5",
        "instanceId": 5736,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000600b1-00a4-0035-00b9-001e00630036.png",
        "timestamp": 1579775584907,
        "duration": 7014
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2ea83bc4124ea644831e0fd522147ee5",
        "instanceId": 5736,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b00cf-00cc-00e5-0061-00be0001002b.png",
        "timestamp": 1579775592255,
        "duration": 9228
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2ea83bc4124ea644831e0fd522147ee5",
        "instanceId": 5736,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a7009d-009b-0009-00ab-0039004900f8.png",
        "timestamp": 1579775602002,
        "duration": 11401
    },
    {
        "description": "Test case for application title |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ec999c6d4df69a16d7be152fd92adf34",
        "instanceId": 14416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009b00e5-0008-00b6-00e7-003d003600fd.png",
        "timestamp": 1579775698713,
        "duration": 7033
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ec999c6d4df69a16d7be152fd92adf34",
        "instanceId": 14416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00750012-00b3-002f-00bb-00cc00190088.png",
        "timestamp": 1579775706103,
        "duration": 9578
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ec999c6d4df69a16d7be152fd92adf34",
        "instanceId": 14416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004d0016-00c0-0028-000d-005c0045006b.png",
        "timestamp": 1579775716192,
        "duration": 11329
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
