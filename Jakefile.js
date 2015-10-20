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

desc("test", ["local", "build-test"], function () {
    jake.exec(["mocha"], jakeExecOptionBag, function () {
        complete();
    });
}, jakeAsyncTaskOptionBag)

desc("local");
task("local", function () {
    jake.exec(["tsc"], jakeExecOptionBag, function () {
        var dts = "built/async-context.d.ts";
        var dtsContents = fs.readFileSync("built/async-context.d.ts");
        // export declare namespace AsyncChainer
        fs.writeFileSync(dts, "export " + dtsContents)
        complete();
    })
}, jakeAsyncTaskOptionBag);

task("default", ["local"], function () {

});