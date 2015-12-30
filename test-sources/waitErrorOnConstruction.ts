/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

function errorWaiter() {
    return new CancellableContext<void>((context) => {
        throw new Error("wow4");
    }).feed()
};

describe("Error processing on context construction", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter();
        logger.catch(err => {
            chai.assert(err.message === "wow4", "Message should be 'wow4'")
            done()
        });
    });
});