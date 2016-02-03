/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

function errorWaiter() {
    return new CancellableContext<void>((context) => {
        context.queue(() => {}).queue(() => {}, { revert: () => context.resolve() });
    }).feed()
};

describe("`revert` call check on queue item", function() {
    it("should call `revert`", function(done) {
        let now = Date.now();
        let logger = errorWaiter();
        logger.then(done);
    });
});