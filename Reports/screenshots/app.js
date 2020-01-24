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
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bf71b5ff4f19cfe6a63396a32e023d3b",
        "instanceId": 16708,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ed0054-0000-0094-00d4-00d5005100df.png",
        "timestamp": 1579784267885,
        "duration": 7044
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bf71b5ff4f19cfe6a63396a32e023d3b",
        "instanceId": 16708,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb0044-002c-00cb-006c-002800a800a7.png",
        "timestamp": 1579784277188,
        "duration": 12370
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bf71b5ff4f19cfe6a63396a32e023d3b",
        "instanceId": 16708,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002e003b-002f-0002-00fe-00d50090005e.png",
        "timestamp": 1579784290057,
        "duration": 11381
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3673acdcfacbb6bde25dbb25fe571315",
        "instanceId": 5076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001c007e-00f7-0061-00d3-00dd003b00bc.png",
        "timestamp": 1579784684125,
        "duration": 7032
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3673acdcfacbb6bde25dbb25fe571315",
        "instanceId": 5076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f900b6-00aa-003c-0063-0099007000e3.png",
        "timestamp": 1579784691530,
        "duration": 10657
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3673acdcfacbb6bde25dbb25fe571315",
        "instanceId": 5076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004a00fc-003c-00ee-008c-00fa0080002f.png",
        "timestamp": 1579784702674,
        "duration": 23498
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f2ccd3ca7cd5fc129b92bf636e60fe80",
        "instanceId": 16940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ce000a-003c-0011-008a-004d00a3003b.png",
        "timestamp": 1579785422028,
        "duration": 7027
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f2ccd3ca7cd5fc129b92bf636e60fe80",
        "instanceId": 16940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008d0034-00fe-008a-0033-005c005000a5.png",
        "timestamp": 1579785429738,
        "duration": 14241
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f2ccd3ca7cd5fc129b92bf636e60fe80",
        "instanceId": 16940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004c0014-00ce-00b3-0007-005600c00012.png",
        "timestamp": 1579785444458,
        "duration": 26645
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f1d0edfbd3093a55da09ee2d1dc1eb88",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b50001-001c-009c-0074-00bf003c002c.png",
        "timestamp": 1579839818693,
        "duration": 7035
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f1d0edfbd3093a55da09ee2d1dc1eb88",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d0003-009e-00ad-00f4-002d004d005f.png",
        "timestamp": 1579839826957,
        "duration": 10387
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f1d0edfbd3093a55da09ee2d1dc1eb88",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c90036-0085-008c-008c-00c000860069.png",
        "timestamp": 1579839837835,
        "duration": 26520
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b0ad3631e531ff761948fcb4d3069e0b",
        "instanceId": 7176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0091000f-005a-00ac-001a-00e900590021.png",
        "timestamp": 1579840031966,
        "duration": 7013
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b0ad3631e531ff761948fcb4d3069e0b",
        "instanceId": 7176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a6000a-00ca-0091-00d2-006a009e0094.png",
        "timestamp": 1579840039323,
        "duration": 10199
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b0ad3631e531ff761948fcb4d3069e0b",
        "instanceId": 7176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0010007f-00d8-0065-003f-004000e80041.png",
        "timestamp": 1579840050078,
        "duration": 26681
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d1ff8e0c4a346aea03804c15eeffc98f",
        "instanceId": 9844,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00000062-00cf-0091-00f3-0057003200c8.png",
        "timestamp": 1579840331270,
        "duration": 7018
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d1ff8e0c4a346aea03804c15eeffc98f",
        "instanceId": 9844,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b1004d-00b3-009c-0043-001c00330021.png",
        "timestamp": 1579840338643,
        "duration": 11072
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d1ff8e0c4a346aea03804c15eeffc98f",
        "instanceId": 9844,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00690028-007a-008e-0033-006900800038.png",
        "timestamp": 1579840350474,
        "duration": 27338
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "9a951b54ef8bad6cfd931edcd9ec26ad",
        "instanceId": 5852,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c3001f-0042-00d6-008e-004f00580013.png",
        "timestamp": 1579840805316,
        "duration": 7015
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "9a951b54ef8bad6cfd931edcd9ec26ad",
        "instanceId": 5852,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160032-003c-0033-0066-00bf00dc0079.png",
        "timestamp": 1579840812688,
        "duration": 11454
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "9a951b54ef8bad6cfd931edcd9ec26ad",
        "instanceId": 5852,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "TypeError: Cannot read property 'have' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'have' of undefined\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:56:36\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00210094-0062-002e-00bf-0018006e00c0.png",
        "timestamp": 1579840824638,
        "duration": 12693
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0faabae1138a581843c04cda39d8106a",
        "instanceId": 16752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f70045-00ef-000d-0035-00fc00ea005e.png",
        "timestamp": 1579840954866,
        "duration": 7019
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0faabae1138a581843c04cda39d8106a",
        "instanceId": 16752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d009a-00e4-0064-00be-00a2006600e5.png",
        "timestamp": 1579840962245,
        "duration": 10564
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "0faabae1138a581843c04cda39d8106a",
        "instanceId": 16752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "TypeError: Cannot read property 'have' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'have' of undefined\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:56:36\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "005000a2-004c-0076-0004-003800490064.png",
        "timestamp": 1579840973322,
        "duration": 12474
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a8709cc2e548b6e7d3fde0e1719b06a3",
        "instanceId": 14596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002100f1-0009-00b6-0067-00f600a3002c.png",
        "timestamp": 1579841812927,
        "duration": 7024
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a8709cc2e548b6e7d3fde0e1719b06a3",
        "instanceId": 14596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d00048-0003-00a3-009b-0043007e0030.png",
        "timestamp": 1579841820333,
        "duration": 9573
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "a8709cc2e548b6e7d3fde0e1719b06a3",
        "instanceId": 14596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "ReferenceError: Dashboard is not defined"
        ],
        "trace": [
            "ReferenceError: Dashboard is not defined\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:55:41\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00da0078-00ab-0064-0078-00db006f006a.png",
        "timestamp": 1579841830393,
        "duration": 12525
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8f8593be6a42b2f927ef5c38e6a8694d",
        "instanceId": 18496,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002b0029-0052-00ee-00c0-00cc00910066.png",
        "timestamp": 1579841936048,
        "duration": 7017
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8f8593be6a42b2f927ef5c38e6a8694d",
        "instanceId": 18496,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e300ed-004b-00e6-0066-00f5001f00f7.png",
        "timestamp": 1579841943425,
        "duration": 10729
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8f8593be6a42b2f927ef5c38e6a8694d",
        "instanceId": 18496,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b400a2-00e8-00bd-002b-009f009800f5.png",
        "timestamp": 1579841954667,
        "duration": 26601
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "acb0bb5e96edfa1766f099a2ac01ec68",
        "instanceId": 18316,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009f0072-004c-0001-0061-00ce00f700a6.png",
        "timestamp": 1579842037979,
        "duration": 7013
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "acb0bb5e96edfa1766f099a2ac01ec68",
        "instanceId": 18316,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a0087-0027-003c-0030-008f00ce009b.png",
        "timestamp": 1579842045349,
        "duration": 10974
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "acb0bb5e96edfa1766f099a2ac01ec68",
        "instanceId": 18316,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "AssertionError: expected 'Dashboard' to equal 'Dasboard'"
        ],
        "trace": [
            "AssertionError: expected 'Dashboard' to equal 'Dasboard'\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:55:35\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "004c0019-00ea-0066-0061-002700210091.png",
        "timestamp": 1579842056820,
        "duration": 12474
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "137e59ad419e22b002aac522d4171aa7",
        "instanceId": 3504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ac00b1-005d-0038-00c9-003a00b600f2.png",
        "timestamp": 1579842201333,
        "duration": 7033
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "137e59ad419e22b002aac522d4171aa7",
        "instanceId": 3504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00550038-00b3-0059-0012-0070001f00a5.png",
        "timestamp": 1579842208719,
        "duration": 10239
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "137e59ad419e22b002aac522d4171aa7",
        "instanceId": 3504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Error: Invalid Chai property: toEqual. Did you mean \"equal\"?"
        ],
        "trace": [
            "Error: Invalid Chai property: toEqual. Did you mean \"equal\"?\n    at Object.proxyGetter [as get] (E:\\Protractor workspace\\node_modules\\chai\\lib\\chai\\utils\\proxify.js:75:17)\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:56:31\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f700a9-002e-0018-00fe-00e0003900ba.png",
        "timestamp": 1579842219467,
        "duration": 12522
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "40f1263caebedca7fbb36e32e84d3f11",
        "instanceId": 13820,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d600a3-00a0-0086-00ee-0036003500c1.png",
        "timestamp": 1579842256318,
        "duration": 7018
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "40f1263caebedca7fbb36e32e84d3f11",
        "instanceId": 13820,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006700e1-0095-00e1-007b-000c008d0052.png",
        "timestamp": 1579842263710,
        "duration": 10395
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "40f1263caebedca7fbb36e32e84d3f11",
        "instanceId": 13820,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b9005e-002c-0018-00ec-00ef00720086.png",
        "timestamp": 1579842274598,
        "duration": 26601
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7762b123e4df3837ad2f614041e61771",
        "instanceId": 17164,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0057001f-00fb-001f-0088-0068007f0071.png",
        "timestamp": 1579842316739,
        "duration": 7019
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7762b123e4df3837ad2f614041e61771",
        "instanceId": 17164,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004300ac-007b-00db-00d3-009c00900011.png",
        "timestamp": 1579842324106,
        "duration": 10656
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7762b123e4df3837ad2f614041e61771",
        "instanceId": 17164,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f0082-00c0-0039-0023-00030098009d.png",
        "timestamp": 1579842335250,
        "duration": 26622
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7862e9409035403f43b1aab1f216d616",
        "instanceId": 16476,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e300a9-00e5-00ef-003b-006a002100aa.png",
        "timestamp": 1579842490018,
        "duration": 7016
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "792e16f8303331646170685f45380858",
        "instanceId": 16808,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003a0047-00e7-00c1-00ab-0038000c00db.png",
        "timestamp": 1579842517306,
        "duration": 7033
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "792e16f8303331646170685f45380858",
        "instanceId": 16808,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004900de-0082-005b-003b-00db0001001c.png",
        "timestamp": 1579842524717,
        "duration": 10877
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "792e16f8303331646170685f45380858",
        "instanceId": 16808,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "TypeError: Cannot read property 'equal' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'equal' of undefined\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:55:33\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "009600d2-007a-00dc-00ea-00e4002e00a5.png",
        "timestamp": 1579842536102,
        "duration": 12479
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "826351b1e2b6e284f21c7390abf35ab2",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00720050-00cc-006f-0059-00fa00cb00b4.png",
        "timestamp": 1579842625543,
        "duration": 7034
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "826351b1e2b6e284f21c7390abf35ab2",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b00c7-007e-00f3-004b-00be004700c3.png",
        "timestamp": 1579842632957,
        "duration": 11388
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "826351b1e2b6e284f21c7390abf35ab2",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "AssertionError: expected 'Dashboard' to equal 'Dashoard'"
        ],
        "trace": [
            "AssertionError: expected 'Dashboard' to equal 'Dashoard'\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:55:34\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cf0049-00ef-0051-003e-008600e300d2.png",
        "timestamp": 1579842644825,
        "duration": 12463
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dac105279514073f696845e3398fb680",
        "instanceId": 20020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d00062-0061-000a-0005-00e700080038.png",
        "timestamp": 1579842921476,
        "duration": 7033
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dac105279514073f696845e3398fb680",
        "instanceId": 20020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006e0039-001f-00ef-00a8-003f00e70080.png",
        "timestamp": 1579842928882,
        "duration": 9938
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dac105279514073f696845e3398fb680",
        "instanceId": 20020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000b0012-004d-0093-00cb-00980042005f.png",
        "timestamp": 1579842939702,
        "duration": 26605
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "716908b06608202b0bd3a372fc69a461",
        "instanceId": 19176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001800ec-0029-0063-00ac-00f200590061.png",
        "timestamp": 1579844745766,
        "duration": 7016
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "716908b06608202b0bd3a372fc69a461",
        "instanceId": 19176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: No element found using locator: by.buttonText(\"Login\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.buttonText(\"Login\")\n    at elementArrayFinder.getWebElements.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as isDisplayed] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as isDisplayed] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:29:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"First test case for url launch \") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:18:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "001d00df-0075-0025-0032-001e004b00cc.png",
        "timestamp": 1579844753109,
        "duration": 13547
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "716908b06608202b0bd3a372fc69a461",
        "instanceId": 19176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "NoSuchElementError: No element found using locator: By(xpath, //input[@type='text'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //input[@type='text'])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Applicationdata.login (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:52:18)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:43:25)"
        ],
        "browserLogs": [],
        "screenShotFile": "0041001e-00bd-0035-00cc-005a006d00be.png",
        "timestamp": 1579844767049,
        "duration": 11490
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7e162a276e5a0d18ed1a35cb28ccdbb2",
        "instanceId": 20424,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002d001f-0077-003e-0009-006f000100a1.png",
        "timestamp": 1579844940199,
        "duration": 7017
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "7e162a276e5a0d18ed1a35cb28ccdbb2",
        "instanceId": 20424,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: No element found using locator: by.buttonText(\"Login\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.buttonText(\"Login\")\n    at elementArrayFinder.getWebElements.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as isDisplayed] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as isDisplayed] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:29:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"First test case for url launch \") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:18:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "005b006b-003e-0082-0057-009c00490061.png",
        "timestamp": 1579844947565,
        "duration": 14904
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7e162a276e5a0d18ed1a35cb28ccdbb2",
        "instanceId": 20424,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008b00ff-00cf-005a-0033-00ce00330052.png",
        "timestamp": 1579844962875,
        "duration": 46116
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a95521da163f2bbde9463f5a80c8bbd7",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd002b-00b5-0057-00f4-00a2006900f9.png",
        "timestamp": 1579845249694,
        "duration": 7036
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a95521da163f2bbde9463f5a80c8bbd7",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac006e-006b-0055-0017-00c600dc00bf.png",
        "timestamp": 1579845257116,
        "duration": 9183
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a95521da163f2bbde9463f5a80c8bbd7",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ef00ee-00e7-003b-002a-005600320070.png",
        "timestamp": 1579845266793,
        "duration": 46076
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "559bcccb3850aa8fbf7190e31c42b269",
        "instanceId": 13452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ba00da-00ea-003c-005d-004700a70074.png",
        "timestamp": 1579845784663,
        "duration": 7028
    },
    {
        "description": "First test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "559bcccb3850aa8fbf7190e31c42b269",
        "instanceId": 13452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00090059-00ef-0049-00ed-00b800960065.png",
        "timestamp": 1579845792055,
        "duration": 11215
    },
    {
        "description": "Second test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "559bcccb3850aa8fbf7190e31c42b269",
        "instanceId": 13452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c50072-00f4-0068-007f-0039005500e2.png",
        "timestamp": 1579845803765,
        "duration": 46069
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ddd9cd6ecc98cfb69fb845d31a33df0b",
        "instanceId": 16996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0047005f-00d5-0018-0074-005000dc001d.png",
        "timestamp": 1579848106962,
        "duration": 7034
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ddd9cd6ecc98cfb69fb845d31a33df0b",
        "instanceId": 16996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00870026-00bb-00af-009d-002a008800bd.png",
        "timestamp": 1579848114359,
        "duration": 9354
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "ddd9cd6ecc98cfb69fb845d31a33df0b",
        "instanceId": 16996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: Invalid Chai property: displayed"
        ],
        "trace": [
            "Error: Invalid Chai property: displayed\n    at Object.proxyGetter [as get] (E:\\Protractor workspace\\node_modules\\chai\\lib\\chai\\utils\\proxify.js:78:17)\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:45:38)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)\nFrom: Task: Run it(\"Test case for forget password\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:38:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bd00be-0042-00dd-0035-00f7006a008d.png",
        "timestamp": 1579848124209,
        "duration": 16436
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ddd9cd6ecc98cfb69fb845d31a33df0b",
        "instanceId": 16996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001c005f-0086-00e4-008f-00bf007f00e3.png",
        "timestamp": 1579848141150,
        "duration": 26599
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b688669b71285362ee1bc81478eb6e87",
        "instanceId": 9492,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd0054-0056-0005-0052-00360007009b.png",
        "timestamp": 1579848495036,
        "duration": 7037
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b688669b71285362ee1bc81478eb6e87",
        "instanceId": 9492,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da00a8-00d2-004a-008c-00de0023002e.png",
        "timestamp": 1579848502493,
        "duration": 9381
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "b688669b71285362ee1bc81478eb6e87",
        "instanceId": 9492,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: Invalid Chai property: displayed"
        ],
        "trace": [
            "Error: Invalid Chai property: displayed\n    at Object.proxyGetter [as get] (E:\\Protractor workspace\\node_modules\\chai\\lib\\chai\\utils\\proxify.js:78:17)\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:46:39)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)\nFrom: Task: Run it(\"Test case for forget password\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:38:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0031007e-00d9-00ed-00ba-0014009e0043.png",
        "timestamp": 1579848512730,
        "duration": 16500
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b688669b71285362ee1bc81478eb6e87",
        "instanceId": 9492,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ea0055-00a8-00e2-00af-007900da00f0.png",
        "timestamp": 1579848529761,
        "duration": 26572
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aa8369129fd0a594d1898efcbf52a9e6",
        "instanceId": 12764,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00be00f7-00cf-001a-00e7-00ce0041002e.png",
        "timestamp": 1579849517639,
        "duration": 7033
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aa8369129fd0a594d1898efcbf52a9e6",
        "instanceId": 12764,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00810088-0033-00ef-00b3-0047004d003e.png",
        "timestamp": 1579849525045,
        "duration": 9757
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "aa8369129fd0a594d1898efcbf52a9e6",
        "instanceId": 12764,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: expected { Object (browser_, then, ...) } to equal 'Mail sent successfully'"
        ],
        "trace": [
            "AssertionError: expected { Object (browser_, then, ...) } to equal 'Mail sent successfully'\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:47:47)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)\nFrom: Task: Run it(\"Test case for forget password\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:38:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a400b9-0076-0095-0072-003b00f700d1.png",
        "timestamp": 1579849535301,
        "duration": 19534
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aa8369129fd0a594d1898efcbf52a9e6",
        "instanceId": 12764,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bc007e-001c-0047-007d-00cb00660088.png",
        "timestamp": 1579849555328,
        "duration": 26555
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4e5c40940058562b638b2efe5c01b39c",
        "instanceId": 10608,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0077007d-00a2-007a-0021-00c400360030.png",
        "timestamp": 1579849787996,
        "duration": 7023
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4e5c40940058562b638b2efe5c01b39c",
        "instanceId": 10608,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0030003e-0008-00d8-0067-0023008900c7.png",
        "timestamp": 1579849795409,
        "duration": 10113
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "4e5c40940058562b638b2efe5c01b39c",
        "instanceId": 10608,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: expected { Object (browser_, then, ...) } to equal 'Mail sent successfully'"
        ],
        "trace": [
            "AssertionError: expected { Object (browser_, then, ...) } to equal 'Mail sent successfully'\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:48:39)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)\nFrom: Task: Run it(\"Test case for forget password\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:38:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008b0063-0096-000d-0086-00330070008c.png",
        "timestamp": 1579849806050,
        "duration": 19715
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4e5c40940058562b638b2efe5c01b39c",
        "instanceId": 10608,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004e0017-00e3-00d4-00a6-001400e9002f.png",
        "timestamp": 1579849826267,
        "duration": 26621
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "30f8ddf174639b799482ebf2cebf80af",
        "instanceId": 17732,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00130091-0016-00fd-00a9-00fc001a0027.png",
        "timestamp": 1579864145792,
        "duration": 8202
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "30f8ddf174639b799482ebf2cebf80af",
        "instanceId": 17732,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160086-00d7-0005-00ed-00f00060003e.png",
        "timestamp": 1579864157901,
        "duration": 12937
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "30f8ddf174639b799482ebf2cebf80af",
        "instanceId": 17732,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: timeout is not defined"
        ],
        "trace": [
            "ReferenceError: timeout is not defined\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:53:52)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)\nFrom: Task: Run it(\"Test case for forget password\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:38:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bc00e2-009a-0002-00ea-00dd002900b8.png",
        "timestamp": 1579864173506,
        "duration": 19558
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "30f8ddf174639b799482ebf2cebf80af",
        "instanceId": 17732,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fa003f-00e2-00a5-0077-003d004200dc.png",
        "timestamp": 1579864193591,
        "duration": 41735
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb703f087b675fbb744e330af7f9e1bb",
        "instanceId": 18152,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00060030-00ef-0004-0008-003200ab0043.png",
        "timestamp": 1579864389140,
        "duration": 7015
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb703f087b675fbb744e330af7f9e1bb",
        "instanceId": 18152,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f00c4-0034-001f-00dc-0044000d00c5.png",
        "timestamp": 1579864396520,
        "duration": 11630
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "eb703f087b675fbb744e330af7f9e1bb",
        "instanceId": 18152,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "TimeoutError: Mail sent successfully\nWait timed out after 5027ms",
            "Failed: expected { Object (browser_, then, ...) } to equal 'Mail sent successfully'"
        ],
        "trace": [
            "TimeoutError: Mail sent successfully\nWait timed out after 5027ms\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Mail sent successfully\n    at scheduleWait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at thenableWebDriverProxy.wait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:52:17)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)",
            "AssertionError: expected { Object (browser_, then, ...) } to equal 'Mail sent successfully'\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:55:39)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)\nFrom: Task: Run it(\"Test case for forget password\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:38:5)\n    at addSpecsToSuite (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "002000b6-009a-00c8-0000-008c0062000f.png",
        "timestamp": 1579864408753,
        "duration": 29580
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb703f087b675fbb744e330af7f9e1bb",
        "instanceId": 18152,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002700f0-00e6-001c-0059-00e800b900cd.png",
        "timestamp": 1579864439098,
        "duration": 41757
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4916075a8c6b9999b9288719261c47ab",
        "instanceId": 10560,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e80023-00a8-000f-0093-007c00ec00c3.png",
        "timestamp": 1579864962883,
        "duration": 7028
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4916075a8c6b9999b9288719261c47ab",
        "instanceId": 10560,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dd0013-0034-0006-0056-009d00ba0005.png",
        "timestamp": 1579864970261,
        "duration": 11629
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "4916075a8c6b9999b9288719261c47ab",
        "instanceId": 10560,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "TimeoutError: Wait timed out after 10018ms"
        ],
        "trace": [
            "TimeoutError: Wait timed out after 10018ms\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at thenableWebDriverProxy.wait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:54:43\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:938:14\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at thenableWebDriverProxy.wait (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at Applicationdata.forgetpassword (E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:54:16)\n    at UserContext.<anonymous> (E:\\Protractor workspace\\Brac_webapp\\Test_cases\\login_spec.js:40:25)"
        ],
        "browserLogs": [],
        "screenShotFile": "0075004e-003d-005e-0037-00ff00a70084.png",
        "timestamp": 1579864982416,
        "duration": 29634
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4916075a8c6b9999b9288719261c47ab",
        "instanceId": 10560,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f3002e-00d2-0091-001c-0067007e00b5.png",
        "timestamp": 1579865012537,
        "duration": 26527
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcea5ea0530972f09cba91857a98485d",
        "instanceId": 14768,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f300a5-0034-00de-008a-00f20037008f.png",
        "timestamp": 1579865397934,
        "duration": 7034
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcea5ea0530972f09cba91857a98485d",
        "instanceId": 14768,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a300ee-0099-0007-0025-003c00ec00ae.png",
        "timestamp": 1579865405351,
        "duration": 9366
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcea5ea0530972f09cba91857a98485d",
        "instanceId": 14768,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003d00bd-0052-006f-0051-007b00c70004.png",
        "timestamp": 1579865415207,
        "duration": 17525
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcea5ea0530972f09cba91857a98485d",
        "instanceId": 14768,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00dd0097-0052-00be-0054-000d00a00083.png",
        "timestamp": 1579865433319,
        "duration": 26527
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1c7c501a0f571ba25cdd9121dd787a2",
        "instanceId": 2388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005b009d-007c-0002-00f9-001d009900fb.png",
        "timestamp": 1579865701202,
        "duration": 7022
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1c7c501a0f571ba25cdd9121dd787a2",
        "instanceId": 2388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00860037-0036-0094-0049-006d00770080.png",
        "timestamp": 1579865708575,
        "duration": 9509
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1c7c501a0f571ba25cdd9121dd787a2",
        "instanceId": 2388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e30042-00e9-004d-0001-007100cd00fa.png",
        "timestamp": 1579865718538,
        "duration": 27649
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1c7c501a0f571ba25cdd9121dd787a2",
        "instanceId": 2388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b009c-0034-00fe-0080-00b100cc006c.png",
        "timestamp": 1579865747011,
        "duration": 26598
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2df8eaa3a0c6d1a30c6198630915c5cb",
        "instanceId": 12448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e400ff-0052-00b4-00b1-00610088006a.png",
        "timestamp": 1579865880372,
        "duration": 7018
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2df8eaa3a0c6d1a30c6198630915c5cb",
        "instanceId": 12448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d40051-0053-00c0-003c-007900070092.png",
        "timestamp": 1579865887751,
        "duration": 9920
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "2df8eaa3a0c6d1a30c6198630915c5cb",
        "instanceId": 12448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "AssertionError: expected '×\\nMail sent successfully' to equal 'Mail sent successfully'"
        ],
        "trace": [
            "AssertionError: expected '×\\nMail sent successfully' to equal 'Mail sent successfully'\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:49:36\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00510061-00cc-0081-0038-00e9003e0074.png",
        "timestamp": 1579865898157,
        "duration": 14489
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2df8eaa3a0c6d1a30c6198630915c5cb",
        "instanceId": 12448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ab0060-00fe-0030-0017-00b100950027.png",
        "timestamp": 1579865913117,
        "duration": 26566
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f6261d109d4d6ea5ff57a9d1874ddf70",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fe00f0-008f-00e7-00d6-000400b40071.png",
        "timestamp": 1579866047192,
        "duration": 7015
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f6261d109d4d6ea5ff57a9d1874ddf70",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c0081-00af-00f5-0019-00c9002e00e0.png",
        "timestamp": 1579866054585,
        "duration": 9388
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "f6261d109d4d6ea5ff57a9d1874ddf70",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "AssertionError: expected '×\\nMail sent successfully' to equal 'Mail sent successfully'"
        ],
        "trace": [
            "AssertionError: expected '×\\nMail sent successfully' to equal 'Mail sent successfully'\n    at E:\\Protractor workspace\\Brac_webapp\\Page_Objects\\login_page_po.js:49:36\n    at elementArrayFinder_.then (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "006e0013-00f8-004d-00f8-005900ea00f1.png",
        "timestamp": 1579866064541,
        "duration": 14538
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f6261d109d4d6ea5ff57a9d1874ddf70",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000d003b-007b-0019-000d-007c007f00b7.png",
        "timestamp": 1579866079555,
        "duration": 26504
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a4b95adfcd8379d9936e79169fd4b58",
        "instanceId": 6408,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00af007b-00a4-0005-002f-00e100de007b.png",
        "timestamp": 1579866142626,
        "duration": 7033
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a4b95adfcd8379d9936e79169fd4b58",
        "instanceId": 6408,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c004c-002c-008c-0005-0089006f00b5.png",
        "timestamp": 1579866150033,
        "duration": 10727
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a4b95adfcd8379d9936e79169fd4b58",
        "instanceId": 6408,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ef00f1-0071-0088-00be-002200e70070.png",
        "timestamp": 1579866161266,
        "duration": 17496
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4a4b95adfcd8379d9936e79169fd4b58",
        "instanceId": 6408,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006a00eb-0011-00d7-00e6-00a600cf0095.png",
        "timestamp": 1579866179341,
        "duration": 26563
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b2ffb89c25205b71180eed6dfe1e8dfe",
        "instanceId": 19680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00de0032-000b-0035-0006-0094007800c1.png",
        "timestamp": 1579866338077,
        "duration": 7013
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b2ffb89c25205b71180eed6dfe1e8dfe",
        "instanceId": 19680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e003b-00fe-001c-00e0-0050006f005a.png",
        "timestamp": 1579866345425,
        "duration": 10751
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b2ffb89c25205b71180eed6dfe1e8dfe",
        "instanceId": 19680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005b00b7-00ec-0034-00dd-00be00200070.png",
        "timestamp": 1579866356683,
        "duration": 17501
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b2ffb89c25205b71180eed6dfe1e8dfe",
        "instanceId": 19680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00aa0064-000d-00cf-0038-007700cc0013.png",
        "timestamp": 1579866374717,
        "duration": 26600
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dd1099b2b70bf092f483a872aa480ae2",
        "instanceId": 11656,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00900061-006c-00d4-00fe-00f200100026.png",
        "timestamp": 1579866819878,
        "duration": 7034
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dd1099b2b70bf092f483a872aa480ae2",
        "instanceId": 11656,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f800d7-00b1-00bc-00f1-00f80060009e.png",
        "timestamp": 1579866827299,
        "duration": 10068
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dd1099b2b70bf092f483a872aa480ae2",
        "instanceId": 11656,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee0010-00e0-0028-0089-005f005f00cc.png",
        "timestamp": 1579866837908,
        "duration": 27534
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dd1099b2b70bf092f483a872aa480ae2",
        "instanceId": 11656,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009600c0-00f0-0030-0013-00fc007d007a.png",
        "timestamp": 1579866866318,
        "duration": 29576
    },
    {
        "description": "Test case for application title |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb6c8b2f25751e5fe1f4a7d91f856fd9",
        "instanceId": 4420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f1007c-008c-008c-004b-005100e60079.png",
        "timestamp": 1579867700092,
        "duration": 7045
    },
    {
        "description": "Test case for url launch |Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb6c8b2f25751e5fe1f4a7d91f856fd9",
        "instanceId": 4420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003100e1-0060-00a1-0049-00450020004c.png",
        "timestamp": 1579867707595,
        "duration": 11100
    },
    {
        "description": "Test case for forget password|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb6c8b2f25751e5fe1f4a7d91f856fd9",
        "instanceId": 4420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007a004b-0072-004a-00fd-008200260098.png",
        "timestamp": 1579867719673,
        "duration": 27973
    },
    {
        "description": "Test case for Login page|Brac Application Test Cases ",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "eb6c8b2f25751e5fe1f4a7d91f856fd9",
        "instanceId": 4420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008000af-0041-0074-0038-000800e10031.png",
        "timestamp": 1579867748444,
        "duration": 41873
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
