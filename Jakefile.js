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
    jake.exec(["tsc -p test"], jakeExecOptionBag, function () {
        complete();
    });
}, jakeAsyncTaskOptionBag);

desc("build-testutil");
task("build-testutil", function () {
    jake.exec(["tsc -p testutil"], jakeExecOptionBag, function () {
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
        var ts = "built/async-context.js";
        var tsContents = fs.readFileSync("built/async-context.js");
        fs.writeFileSync("built/async-context-modular.js", tsContents + `
if (typeof module !== "undefined" && module.exports) {
    module.exports.default = AsyncChainer;
}`);
        
        var dts = "built/async-context.d.ts";
        var dtsContents = fs.readFileSync("built/async-context.d.ts");
        fs.writeFileSync("built/async-context-modular.d.ts", dtsContents + "\r\nexport default AsyncChainer;");
        complete();
    })
}, jakeAsyncTaskOptionBag);

task("default", ["local", "build-test", "build-testutil", "sample"], function () {

});