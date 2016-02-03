var fs = require("fs");

var jakeExecOptionBag = {
    printStdout: true,
    printStderr: true,
    breakOnError: true
};
var jakeAsyncTaskOptionBag = {
    async: true
};

desc("build-test");
task("build-test", function () {
    jake.exec(["tsc -p test-sources"], jakeExecOptionBag, function () {
        complete();
    });
}, jakeAsyncTaskOptionBag);

desc("build-testserver");
task("build-testserver", function () {
    jake.exec(["tsc -p test-server"], jakeExecOptionBag, function () {
        complete();
    });
}, jakeAsyncTaskOptionBag);

desc("test");
task("test", ["default"], function () {
    jake.exec(["mocha"], jakeExecOptionBag, function () {
        complete();
    });
}, jakeAsyncTaskOptionBag);

desc("sample");
task("sample", function () {
    jake.exec(["tsc -p sample"], jakeExecOptionBag, function () {
        complete();
    });
}, jakeAsyncTaskOptionBag);

desc("local");
task("local", function () {
    jake.exec(["tsc"], jakeExecOptionBag, function () {
        var ts = "built/cancellables.js";
        var tsContents = fs.readFileSync("built/cancellables.js");
        fs.writeFileSync("built/cancellables-modular.js", tsContents + `
if (typeof module !== "undefined" && module.exports) {
    module.exports = Cancellables;
}`);
        
        var dts = "built/cancellables.d.ts";
        var dtsContents = fs.readFileSync("built/cancellables.d.ts");
        fs.writeFileSync("built/cancellables-modular.d.ts", dtsContents + "\r\nexport = Cancellables;");
        complete();
    })
}, jakeAsyncTaskOptionBag);

task("default", ["local", "build-test", "build-testserver"], function () {

});