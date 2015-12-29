var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, Promise, generator) {
    return new Promise(function (resolve, reject) {
        generator = generator.call(thisArg, _arguments);
        function cast(value) { return value instanceof Promise && value.constructor === Promise ? value : new Promise(function (resolve) { resolve(value); }); }
        function onfulfill(value) { try { step("next", value); } catch (e) { reject(e); } }
        function onreject(value) { try { step("throw", value); } catch (e) { reject(e); } }
        function step(verb, value) {
            var result = generator[verb](value);
            result.done ? resolve(result.value) : cast(result.value).then(onfulfill, onreject);
        }
        step("next", void 0);
    });
};
function loadListFile() {
    return __awaiter(this, void 0, Promise, function* () {
        let listFileDirectory = "../test-server/list.json";
        let fetched = yield fetch(listFileDirectory);
        return yield fetched.json();
    });
}
function importTests(...fileNames) {
    return Promise.all(fileNames.map(name => System.import(`../test/${name}`)));
}
(() => __awaiter(this, void 0, Promise, function* () {
    let list = yield loadListFile();
    yield importTests(...list);
    mocha.run();
}))().catch((err) => console.error(err));
//# sourceMappingURL=runtests.js.map